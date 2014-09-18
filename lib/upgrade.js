require('raptor-polyfill/string/startsWith');

var raptorPromises = require('raptor-promises');
var request = require('request');
var npmRegistry = 'http://registry.npmjs.org/';
var semver = require('semver');
var async = require('raptor-async');
var fs = require('fs');

function requestRetry(url, callback) {
    var attemptCount = 0;

    function attempt() {
        attemptCount++;

        console.log('Requesting "' + url + '" (attempt ' + attemptCount + ')');

        request({
                url: url,
                timeout: 5000
            },
            function(err, response) {
                if (err || response.statusCode !== 200) {

                    if (attemptCount === 3) {
                        callback(err || new Error('Unable get valid response for "' + url + '"'));
                        return;
                    } else {
                        attempt();
                    }
                } else {
                    callback.apply(this, arguments);
                }
            });
    }

    attempt();
}

exports.upgradePackageLatest = function(path) {
    console.log('[upgrade package.json] Upgrading modules in package "' + path + '"...');

    function getAsyncTasks(dependencies) {
        if (!dependencies || dependencies.length === 0) {
            return [];
        }

        return Object
            .keys(dependencies)
            .filter(function(moduleName) {
                return moduleName.startsWith('raptor-');
            })
            .map(function(moduleName) {
                return function(callback) {

                    var url = npmRegistry + moduleName;
                    requestRetry(url, function(err, response, json) {
                        if (err || response.statusCode !== 200) {
                            callback(err);
                            return;
                        }

                        var meta = JSON.parse(json);

                        var versions = Object.keys(meta.versions);

                        versions.sort(semver.compare);


                        var newVersion = versions[versions.length-1];

                        newVersion = '^' + newVersion;
                        console.log('[upgrade package.json] Updated version for "' + moduleName + '" to ' + newVersion);
                        dependencies[moduleName] = newVersion;
                        callback();
                    });
                };
            });
    }
    var deferred = raptorPromises.defer();
    var pkg = require(path);

    var asyncTasks = getAsyncTasks(pkg.dependencies).concat(getAsyncTasks(pkg.devDependencies));


    async.parallel(asyncTasks, function(err) {

        if (err) {
            deferred.reject(err);
            return;
        }

        console.log('[upgrade package.json] Updated all versions');
        fs.writeFileSync(path, JSON.stringify(pkg, null, 2), 'utf8');
        deferred.resolve();
    });

    return deferred.promise;
};
