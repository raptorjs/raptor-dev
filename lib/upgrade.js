var async = require('raptor-async');
var fs = require('fs');
var path = require('path');
var npm = require('../lib/npm.js');
var github = require('../lib/github');
var prompt = require('prompt');
var DataHolder = require('raptor-async/DataHolder');
var org = require('../lib/raptorjs-github-org');
var moduleVersionByName = {};

var repos = new DataHolder({
    loader: function(callback) {
        github.fetchRepos(org, function(err, repos) {

            if (err) {
                return callback(err);
            }

            var repoByName = {};

            for (var i = 0; i < repos.length; i++) {
                var repo = repos[i];
                repoByName[repo.name] = repo;
            }

            callback(null, repoByName);
        });
    }
});

function getModuleVersion(moduleName, callback) {
    var versionDataHolder = moduleVersionByName[moduleName];
    if (versionDataHolder === undefined) {
        moduleVersionByName[moduleName] = versionDataHolder = new DataHolder();
        github.raw(org, moduleName, '/master/package.json', function(err, packageJsonStr) {
            if (err) {
                return versionDataHolder.reject(err);
            }

            var packageObj = JSON.parse(packageJsonStr);
            versionDataHolder.resolve(packageObj.version);
        });
    }

    versionDataHolder.done(callback);
}
function fetchRaptorModuleVersions(org, moduleNames, logger, callback) {
    var work = [];
    var versionByModuleName = {};

    moduleNames.forEach(function(moduleName) {
        work.push(function(callback) {
            getModuleVersion(moduleName, function(err, version) {
                if (err) {
                    return callback(err);
                }

                versionByModuleName[moduleName] = version;
                callback();
            });
        });
    });

    async.parallel(work, function(err, results) {
        callback(err, versionByModuleName);
    });
}

function installLatest(moduleNames, dir, logger, callback) {

    var work = [];
    var modulesToBeInstalled = [];

    moduleNames.forEach(function(moduleName) {
        var moduleDir = path.join(dir, 'node_modules', moduleName);
        work.push(function(callback) {
            fs.lstat(moduleDir, function(err, stats) {
                if (err) {
                    modulesToBeInstalled.push(moduleName);
                } else if (!stats.isSymbolicLink()) {
                    modulesToBeInstalled.push(moduleName);
                } else {
                    logger.info('Skipping installing ' + moduleName + ' because it is linked into directory.');
                }

                callback();
            });
        });
    });
    
    async.parallel(work, function(err) {
        if (err) {
            return callback(err);
        }

        if (modulesToBeInstalled.length > 0) {
            npm.install(moduleNames, dir, logger, callback);
        } else {
            callback();
        }
    });
}

module.exports.upgradePackage = function(dir, shouldPrompt, logger, callback) {
    var packageFilePath = path.normalize(path.join(dir, 'package.json'));
    var packageObj;

    try {
        packageObj = JSON.parse(fs.readFileSync(packageFilePath));

    } catch(err) {
        logger.error('Error reading ' + packageFilePath);
        return callback(err);
    }

    repos.done(function(err, repoByName) {

        var dir = process.cwd();
        var moduleNames = [];

        for (var moduleName in packageObj.dependencies) {
            if (repoByName[moduleName]) {
                moduleNames.push(moduleName);
            }
        }

        logger.info('Fetching latest versions for: ' + moduleNames.join(', '));
        fetchRaptorModuleVersions(org, moduleNames, logger, function(err, versions) {
            if (err) {
                logger.error('Error fetching latest versions for following modules.');
                return callback(err);
            }

            var prompts;
            var changedModules = [];
            var versionRegex = /^[\^\~]?(.+)$/;
            var validate;

            if (shouldPrompt) {
                prompts = [];
                validate = function(value) {
                    value = value.toUpperCase();
                    switch(value) {
                        case 'Y':
                        case 'N':
                        case 'YES':
                        case 'NO':
                            return true;
                    }

                    return false;
                };
            }

            function doWork() {
                if (changedModules.length === 0) {
                    logger.success('No raptorjs modules upgraded.');
                    callback();
                    return;
                }

                changedModules.forEach(function(moduleName) {
                    packageObj.dependencies[moduleName] = '^' + versions[moduleName];
                });

                var packageJsonStr = JSON.stringify(packageObj, null, '  ');
                try {
                    fs.writeFileSync(packageFilePath, packageJsonStr);
                } catch(e) {
                    logger.error('Error writing to ' + packageFilePath);
                    return callback(e);
                }

                logger.success('Changes written to ' + packageFilePath);

                installLatest(changedModules, dir, logger, function(err) {
                    if (err) {
                        logger.error('Error installing latest module.');
                        return callback(err);
                    }

                    logger.success('Done upgrading raptorjs modules referenced in ' + packageFilePath + '.');
                    callback();
                });
            }
            
            for (var moduleName in versions) {
                var latestVersion = versions[moduleName];
                var currentVersion = versionRegex.exec(packageObj.dependencies[moduleName])[1];
                
                logger.info(moduleName + ':\n  Current = ' + currentVersion + '\n  Latest = ' + latestVersion);

                if (currentVersion !== latestVersion) {
                    if (shouldPrompt) {
                        prompts.push({
                            'name': moduleName,
                            'description': 'Upgrade ' + moduleName + ' from ' + currentVersion + ' from ' + latestVersion + '? (Y/N)',
                            'default': 'Y',
                            'conform': validate
                        });
                    } else {
                        changedModules.push(moduleName);
                    }
                }
            }

            if (shouldPrompt) {
                prompt.message = '';
                prompt.delimiter = '';

                prompt.get(prompts, function(err, result) {
                    if (err) {
                        logger.error('Error reading inut.', err);
                        callback();
                    }

                    for (var moduleName in result) {
                        var accept = result[moduleName].toUpperCase();
                        if (accept.charAt(0) === 'Y') {
                            changedModules.push(moduleName);
                        }
                    }

                    doWork();
                });
            } else {
                doWork();
            }
        });
    });
};