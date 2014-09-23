'use strict';

require('raptor-polyfill');
var fs = require('fs');
var walk = require('../lib/walk');
var nodePath = require('path');

module.exports = {
    usage: 'Usage: $0 $commandName [dir]',

    options: {
    },

    validate: function(args, rapido) {
        var files = args._;
        if (!files || !files.length) {
            files = [process.cwd()];
        }

        return {
            files: files
        };
    },

    run: function(args, config, rapido) {
        var files = args.files;
        var modified = false;

        function fixVersions(pkg, type) {
            var dependencies = pkg[type];
            if (!dependencies) {
                return;
            }

            Object.keys(dependencies).forEach(function(moduleName) {
                var version = dependencies[moduleName];
                if (moduleName.endsWith('-inc') || moduleName.endsWith('-ebay')) {
                    return;
                }

                if (moduleName.startsWith('raptor-') || moduleName.startsWith('marko') || moduleName.startsWith('optimizer') || moduleName.startsWith('view-engine')) {
                    if (!version.startsWith('^1')) {
                        modified = true;
                        dependencies[moduleName] = '^1.0.0';
                    }
                }
            });
        }

        walk(
            files,
            {
                file: function(file) {

                    var filename = nodePath.basename(file);
                    var src;

                    if (filename === 'package.json') {
                        console.log('Processing "' + file + '"...');
                        src = fs.readFileSync(file, 'utf8');
                        var pkg = JSON.parse(src);
                        modified = false;
                        fixVersions(pkg, 'dependencies');
                        fixVersions(pkg, 'devDependencies');
                        fixVersions(pkg, 'peerDependencies');
                        if (modified) {
                            src = JSON.stringify(pkg, null, 2);
                            fs.writeFileSync(file, src, 'utf8');
                        }
                    }
                }
            },
            function(err) {
                if (err) {
                    console.error('Error while migrating JavaScript: ' + (err.stack || err));
                    return;
                }

                console.log('Module versions updated');
            });
    }
};
