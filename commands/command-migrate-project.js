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
            var projectDir = file;
            var projectSrcDir = path.resolve(file, './src');
            var componentsDir = path.resolve(file, './src/ui/components');

            var shell = require('shelljs');
            // console.log('cnt:', contentDir);
            if (fs.existsSync(projectDir) && fs.existsSync(projectSrcDir) ) {

                var r ;
                console.log('---: Migrate ebay 4cb content file to Property file');
                r = shell.exec('raptor-dev migrate ecbcontent ' + projectDir);
                console.log('---: Migrate AMD module to CommonsJS module');
                r = shell.exec('raptor-dev migrate javascript ' + projectSrcDir);
                console.log('---: Migrate from package.json to optimizer.json');
                r = shell.exec('raptor-dev migrate packages ' + projectSrcDir);
                console.log('---: Migrate RTLD files to raptor-taglib.json');
                r = shell.exec('raptor-dev migrate taglibs ' + projectSrcDir);
                console.log('---: Migrate Raptor Template files from XML(raptorjs2) to HTML(raptorjs3)');
                r = shell.exec('raptor-dev migrate templates ' + projectSrcDir);
                console.log('---: Migrate UI components to the RaptorJS 3 style');
                r = shell.exec('raptor-dev migrate components ' + componentsDir);
                console.log('---: Migrate inline javascript to widget');
                r = shell.exec('raptor-dev migrate inlinescript ' + projectSrcDir);

                console.log('All files migrated to Unified Stack files.');
            } else {
                console.log('Project Dir or Project/src Dir does not exist');
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
