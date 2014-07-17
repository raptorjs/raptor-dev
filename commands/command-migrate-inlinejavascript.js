'use strict';

require('raptor-polyfill');
var nodePath = require('path');
var jsTransformer = require('../lib/uniapi/inline-javascript-transformer');
var fs = require('fs');
var walk = require('../lib/walk');
var _ = require('underscore');
var path = require('path');

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





        function transformFile(file) {
            moduleOptions.file = file;
            var fileArr = file.split('/');
            // console.log(fileArr);
            var migratePath = 'migrate';
            var findSrc = false;
            for (var i = fileArr.length - 1; i >= 0; i--) {
                if (fileArr[i - 1] === 'src') {
                    findSrc = true;
                    break;
                }
                migratePath = '../' + migratePath;
            }
            if (findSrc === true) {
                moduleOptions.migratePath = migratePath;
            }

            var src = fs.readFileSync(file, {
                encoding: 'utf8'
            });

            console.log('Transforming ' + file + '...');
            fileCount++;
            // return;
            args.from = nodePath.dirname(file);

            var transformed = jsTransformer.transform(src, args, moduleOptions);

            fs.writeFileSync(file, transformed, {
                encoding: 'utf8'
            });


        }

        function transformInlineJs(file) {
            if (file.endsWith('.js')) {
                transformFile(file);
            }
        }

        function addToOptimizer(optimizerFile, depFile) {
            var obj = {}
            if(fs.existsSync(optimizerFile)){
                obj = require(optimizerFile);
            }

            obj.dependencies = obj.dependencies || [];
            if(! _.contains(obj.dependencies, depFile) ) {
                obj.dependencies.push(depFile);
                fs.writeFileSync(optimizerFile, JSON.stringify(obj, null, 4) );
            }
        }

        walk(
            files, {
                file: function(file) {
                    if(file.endsWith('.rhtml') ) {
                        var basename = path.basename(file,'.rhtml');

                        var src = fs.readFileSync(file, {
                            encoding: 'utf8'
                        });

                        // console.log(src);
                        var curDir = path.dirname(file);


                        var jsArrs = null;

                        // jsArrs = src.match(/<script.+?<\/script>/g);
                        var re = /<script([\s\S])*?>([\s\S])*?<\/script>/gmi;
                        jsArrs = src.match(re)

                        // console.log(jsArrs);

                        var len = 0;
                        if(jsArrs && jsArrs.length) {
                            len = jsArrs.length;
                        }
                        // len = 0;
                        for(var i = 0; i < len; i++ ) {
                            var fileNo = '000' + i;
                            fileNo = fileNo.slice(-3);
                            var shortFileName = basename + '-inlineWidget' + fileNo + '.js';
                            var fileName = path.resolve(path.dirname(file), shortFileName);
                            var jsSrc = jsArrs[i];
                            jsSrc = jsSrc.replace(/<script([\s\S])*?>/mi,'');
                            jsSrc = jsSrc.replace(/<\/script>/i,'');
                            fs.writeFileSync(fileName, jsSrc, {
                                encodeing: 'utf8'
                            });

                            transformInlineJs(fileName);

                            var widgetDiv = '  <div id="inlineWidget'+fileNo+'" w-bind="./'+ shortFileName +'"></div> ';
                            // console.log(widgetDiv);

                            src = src.replace(/<script([\s\S])*?<\/script>/mi, '  <div id="inlineWidget'+fileNo+'" w-bind="./'+ shortFileName +'"></div> ');

                            var optimizerFile = path.resolve(curDir, './optimizer.json');
                            addToOptimizer(optimizerFile, 'require: ./' + shortFileName);

                        }

                        src = require('html').prettyPrint(src, {indent_size: 4});

                        fs.writeFileSync(file, src, {
                            encoding: 'utf8'
                        });


                    }


                }
            },
            function(err) {
                if (err) {
                    console.error('Error while migrating JavaScript: ' + (err.stack ||
                        err));
                    return;
                }

                console.log('All ' + fileCount +
                    ' Inline JavaScript files migrated to Widget javascript file');
            });
    }
};
