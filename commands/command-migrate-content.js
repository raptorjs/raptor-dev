'use strict';

require('raptor-polyfill');
var nodePath = require('path');
var jsTransformer = require('../lib/uniapi-transformer');
var fs = require('fs');
var walk = require('../lib/walk');
var _ = require('underscore');

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
        // console.log(files);
        files.forEach(function(file) {
            var fs = require('fs');
            var path = require('path');
            var contentDir = path.resolve(file, './content');
            var localeDir = path.resolve(file, './locale');
            var shell = require('shelljs');
            // console.log('cnt:', contentDir);
            if (fs.existsSync(contentDir)) {
                var r = shell.exec('mkdir -p ' + localeDir);
                // console.log(r);
                var contentJar = path.resolve(__dirname, '../content-utils.jar');
                // console.log(contentJar);
                r = shell.exec('java -jar ' + contentJar + ' -from-ecb ' + contentDir + ' -to-prop ' + localeDir);
                // console.log(r && r.output);
                console.log('All 4cb files migrated to property file.');
            } else {
                console.log('Content Dir does not exist');
            }
        });


        // function transformFile(file) {
        //
        //
        // }
        //
        // walk(
        //     files, {
        //         file: function(file) {
        //
        //
        //         }
        //     },
        //     function(err) {
        //         if (err) {
        //             console.error('Error while migrating 4cb: ' + (err.stack ||
        //                 err));
        //             return;
        //         }
        //
        //         console.log('All 4cb files migrated to property file.');
        //     });

    }
};
