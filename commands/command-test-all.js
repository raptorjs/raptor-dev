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

        var modulesToTest = [];
        var failedModules = {};
        var failed = false;

        for (var i=0; i<children.length; i++) {
            var childDir = children[i];
            if (childDir.getName() !== 'raptor-samples' && (childDir.getName().startsWith('raptor-') || childDir.getName() === 'rapido') || childDir.getName().startsWith('optimizer') || childDir.getName().startsWith('marko')) {
                var gitDir = new File(childDir, '.git');
                if (gitDir.exists()) {
                    modulesToTest.push(childDir.getName());
                }
            }
        }

        modulesToTest.sort();

        console.log('Testing the following modules:\n- ' + modulesToTest.join('\n- '));

        var promiseChain = raptorPromises.resolved();

        modulesToTest.forEach(function(moduleName) {
            promiseChain = promiseChain.then(function() {
                var moduleDir = new File(dir, moduleName);
                var promise = rapido.runCommand('module', 'test', {
                        cwd: moduleDir.getAbsolutePath()
                    });

                return promise.fail(function(e) {
                    failed = true;
                    failedModules[moduleName] = e;
                });
            });
        });

        return promiseChain
            .then(function() {
                rapido.log();

                if (failed) {
                    var message = Object.keys(failedModules).sort().map(function(moduleName) {
                        return 'Module name: ' + moduleName + '\nReason: ' + failedModules[moduleName];
                    }).join('\n\n');

                    console.error('The following modules have failing tests:\n\n' + message);
                    process.exit(1);
                } else {
                    rapido.log.success('All test cases are passing!');
                }
            })
            .done();
    }
};
