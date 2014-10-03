'use strict';

require('raptor-polyfill');
var File = require('raptor-files/File');
var raptorPromises = require('raptor-promises');

var nodePath = require('path');

module.exports = {
    usage: 'Usage: $0 $commandName [dir]',

    options: {
    },

    validate: function(args, rapido) {
        var dir = args._[0];
        if (dir) {
            dir = nodePath.resolve(process.cwd(), dir);
        }
        else {
            dir = process.cwd();
        }

        return {
            dir: dir
        };
    },

    run: function(args, config, rapido) {
        var dir = args.dir;

        dir = new File(dir);

        var children = dir.listFiles();

        var modulesToPublish = [];
        var failedModules = {};
        var failed = false;

        for (var i=0; i<children.length; i++) {
            var childDir = children[i];
            if (childDir.getName() === 'raptor-samples') {
                continue;
            }

            if (childDir.getName() === 'raptor-dev-util') {
                continue;
            }

            if (childDir.getName().startsWith('raptor-') || childDir.getName() === 'rapido' || childDir.getName().startsWith('optimizer') || childDir.getName().startsWith('marko')) {
                var gitDir = new File(childDir, '.git');
                if (gitDir.exists()) {
                    modulesToPublish.push(childDir.getName());
                }
            }
        }

        modulesToPublish.sort();

        // modulesToPublish = ['raptor-async'];

        console.log('Publishing the following modules:\n- ' + modulesToPublish.join('\n- '));

        var promiseChain = raptorPromises.resolved();

        modulesToPublish.map(function(moduleName) {
            promiseChain = promiseChain.then(function() {
                console.log('Publishing "' + moduleName + '"...');

                var moduleDir = new File(dir, moduleName);
                var promise = rapido.runCommand('module', 'publish', {
                        cwd: moduleDir.getAbsolutePath()
                    });

                promise.fail(function(e) {
                    failed = true;
                    failedModules[moduleName] = e;
                });

                return promise;
            });

        });

        promiseChain
            .then(function() {

                if (failed) {
                    var message = Object.keys(failedModules).sort().map(function(moduleName) {
                        var err = failedModules[moduleName];
                        return 'Module name: ' + moduleName + '\nReason: ' + (err.stack || err);
                    }).join('\n\n');

                    throw 'The following modules failed to publish:\n\n' + message;
                } else {
                    rapido.log();
                    rapido.log.success('All modules successfully published!');
                }
            });
    }
};
