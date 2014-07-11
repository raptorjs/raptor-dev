var walk = require('../lib/walk');
var nodePath = require('path');
var fs = require('fs');
require('raptor-polyfill');

var mkdirp = require('mkdirp');
var raptorAsync = require('raptor-async');

module.exports = {
    usage: 'Usage: $0 $commandName <dir>',

    options: {
    },

    validate: function(args, rapido) {
        var dirs = args._;
        if (!dirs || !dirs.length) {
            dirs = [process.cwd()];
        }

        return {
            dirs: dirs
        };
    },

    run: function(args, config, rapido) {


        function migrateComponent(sourceDir, targetDir) {
            console.log('Migrating "' + sourceDir + '" to "' + targetDir + '"...');

            mkdirp.sync(targetDir);

            var sourceFiles = fs.readdirSync(sourceDir);
            var oldShortName = nodePath.basename(sourceDir);

            function transformOptimizer(optimizer) {
                var dependencies = optimizer.dependencies;

                if (dependencies) {
                    var out = [];
                    dependencies.forEach(function(d) {
                        if (typeof d !== 'string') {
                            return;
                        }

                        if (d === oldShortName + 'Widget.js') {
                            out.push('require: ./widget');
                        } else if (d === oldShortName + '.rhtml') {
                            out.push('template.rhtml');
                        } else if (d === oldShortName + '.css') {
                            out.push('style.css');
                        } else if (d === oldShortName + 'Renderer.js') {
                            out.push('renderer.js');
                        } else if (d === 'raptor/renderer/optimizer.json') {

                        } else if (d.endsWith(oldShortName + '/optimizer.json')) {
                            out.push('./optimizer.json');
                        } else {
                            out.push(d);
                        }
                    });

                    optimizer.dependencies = out;
                }

                return JSON.stringify(optimizer, null, 4);
            }


            sourceFiles.forEach(function(filename) {

                if (filename.startsWith('.')) {
                    return;
                }
                var file = nodePath.join(sourceDir, filename);
                var targetFile;
                var code;



                if (filename === 'raptor-tag.json') {
                    var raptorTag = require(file);
                    raptorTag.renderer = './renderer';
                    code = JSON.stringify(raptorTag, null, 4);
                } else if (filename === oldShortName + '.css') {
                    targetFile = nodePath.join(targetDir, 'style.css');
                } else if (filename === oldShortName + 'Widget.js') {
                    targetFile = nodePath.join(targetDir, 'widget.js');
                    code = fs.readFileSync(file, 'utf8');
                    var oldClassNameRegExp = new RegExp(nodePath.basename(sourceDir) + 'Widget', 'g');
                    code = code.replace(oldClassNameRegExp, 'Widget');
                } else if (filename === oldShortName + '.rhtml') {
                    targetFile = nodePath.join(targetDir, 'template.rhtml');
                    code = fs.readFileSync(file, 'utf8');
                    code = code.replace(/w[:-]widget="([^"]+)"/g, 'w-widget="./widget"');
                } else if (filename === oldShortName + 'Renderer.js') {
                    targetFile = nodePath.join(targetDir, 'renderer.js');
                    code = fs.readFileSync(file, 'utf8');
                    code = code.replace(/templating/g, 'raptorTemplates');
                    code = code.replace(/require\('raptor-templates'\);/g, function(match) {
                        return match + '\n' + 'var templatePath = require.resolve(\'./template.rhtml\');\n';
                    });
                    code = code.replace(/raptorTemplates.render\([^,]+/g, 'raptorTemplates.render(templatePath');
                } else if (filename.endsWith('optimizer.json')) {
                    code = transformOptimizer(require(file));
                }

                if (code == null) {
                    code = fs.readFileSync(file, 'utf8');
                }

                if (!targetFile) {
                    targetFile = nodePath.join(targetDir, filename);
                }

                fs.writeFileSync(targetFile, code, 'utf8');

            });
        }

        var dirs = args.dirs;


        var componentNameMappings = {};

        function migrateComponents(callback) {
            console.log('---migrate components---:');
            console.log('dir:', dirs);

            walk(
                dirs,
                {
                    file: function(file) {

                        var basename = nodePath.basename(file);
                        var taglibDir = nodePath.dirname(file);

                        console.log('file:', file);
                        console.log('basename:', basename);
                        console.log('taglibdir:', taglibDir);

                        if (basename === 'raptor-taglib.json') {
                            var taglib = require(file);
                            if (taglib.tags) {
                                var tagNames = Object.keys(taglib.tags);
                                tagNames.forEach(function(tagName) {
                                    var tagFile = taglib.tags[tagName];
                                    if (typeof tagFile !== 'string') {
                                        return;
                                    }



                                    tagFile = nodePath.join(taglibDir, tagFile);

                                    var sourceDir = nodePath.dirname(tagFile);
                                    var relPath = nodePath.relative(taglibDir, sourceDir);
                                    componentNameMappings[relPath] = tagName;


                                    var targetDir = nodePath.join(taglibDir, 'components', tagName);

                                    migrateComponent(sourceDir, targetDir);
                                });
                            }
                        }
                    }
                },
                callback);
        }


        function fixPaths(callback) {
            console.log('componentNameMappings: ', componentNameMappings);
            walk(
                dirs,
                {
                    file: function(file) {

                        var basename = nodePath.basename(file);
                        if (basename.endsWith('optimizer.json')) {
                            var optimizer = require(file);

                            if (!optimizer.dependencies) {
                                return;
                            }

                            optimizer.dependencies.forEach(function(d) {
                                if (typeof d !== 'string') {

                                }
                            });
                        }
                    }
                },
                callback);
        }

        raptorAsync.series([
                migrateComponents,
                fixPaths
            ],
            function(err) {
                if (err) {
                    console.error('Error while migrating components: ' + (err.stack || err));
                    return;
                }

                console.log('All components migrated');
            });
    }
};
