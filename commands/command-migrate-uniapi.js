'use strict';

require('raptor-polyfill');
var nodePath = require('path');
var jsTransformer = require('../lib/uniapi-transformer');
var fs = require('fs');
var walk = require('../lib/walk');

module.exports = {
    usage: 'Usage: $0 $commandName [dir]',

    options: {
        'skip-transform-require': {
            description: 'Skip transforming non-raptor module paths in calls to require() to relative paths',
            type: 'boolean',
            default: false
        },

        file: {
            description: 'Only transform a single file',
            type: 'string'
        }
    },

    validate: function(args, rapido) {
        var files = args._;
        if (!files || !files.length) {
            files = [process.cwd()];
        }

        var searchPath = files.filter(function(path) {
            var stat = fs.statSync(path);
            return stat.isDirectory();
        });


        return {
            searchPath: searchPath,
            files: files,
            skipTransformRequire: args['skip-transform-require']
        };
    },

    run: function(args, config, rapido) {
        var files = args.files;
        var fileCount = 0;
        var moduleOptions = {};
        moduleOptions.moduleNames = {};

        function hasModuleConfig(src) {
            var r = src && src.indexOf("require('module-config')") > -1 ;
            if(r) {
                moduleOptions.moduleNames['module-config'] = true;
            }
            return r;
        }

        function hasCubejsAPI(src) {
            if( hasModuleConfig(src) ) {
                return true;
            }

            return false;
        }

        function transformFile(file) {
            moduleOptions.file = file;
            var fileArr = file.split('/');
            // console.log(fileArr);
            var migratePath = 'migrate';
            var findSrc = false;
            for(var i= fileArr.length-1; i>=0; i--) {
                if(fileArr[i-1] === 'src') {
                    findSrc = true;
                    break;
                }
                migratePath = '../' + migratePath;
            }
            if( findSrc === true ) {
                moduleOptions.migratePath = migratePath;
            }

            var src = fs.readFileSync(file, {encoding: 'utf8'});
            if(hasCubejsAPI(src)) {
                console.log('Transforming ' + file + '...');
                fileCount++;
                // return;
                args.from = nodePath.dirname(file);
                var transformed = jsTransformer.transform(src, args, moduleOptions);
                fs.writeFileSync(file, transformed, {encoding: 'utf8'});
            }

        }

        walk(
            files,
            {
                file: function(file) {

                    if (file.endsWith('.js')) {
                        transformFile(file);
                    }
                }
            },
            function(err) {
                if (err) {
                    console.error('Error while migrating JavaScript: ' + (err.stack || err));
                    return;
                }

                console.log('All '+fileCount+' JavaScript files migrated to Unified Node.js API');
            });
    }
};
