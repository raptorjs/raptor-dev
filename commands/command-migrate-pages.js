var walk = require('../lib/walk');
var optimizerFixRelativePaths = require('../lib/optimizerFixRelativePaths');
var commonjsFixRelativePaths = require('../lib/commonjsFixRelativePaths');

var nodePath = require('path');
var fs = require('fs');
require('raptor-polyfill');

var mkdirp = require('mkdirp');
var raptorAsync = require('raptor-async');

function removeDir(dir) {
    try {
        var children = fs.readdirSync(dir);
        for (var i = 0; i < children.length; i++) {
            var file = nodePath.join(dir, children[i]);
            var stat = fs.statSync(file);
            
            if (stat.isDirectory()) {
                console.log('Removing directory: ' + dir);
                removeDir(file);
            } else {
                fs.unlinkSync(file);
            }
        }

        fs.rmdirSync(dir);
    } catch(e) {}
}

module.exports = {
    usage: 'Usage: $0 $commandName <dir>',

    options: {
        'target-dir': {
            'description': 'Target directory'
        },
        'root-dir': {
            description: 'Project root directory',
            type: 'string'
        }
    },

    validate: function(args, rapido) {
        var dirs = args._;
        if (!dirs || !dirs.length) {
            dirs = [process.cwd()];
        }

        var targetDir = args['target-dir'];
        if (!targetDir) {
            throw '"target-dir" is required' ;
        }

        var rootDir = args['root-dir'];

        if (rootDir) {
            rootDir = nodePath.resolve(process.cwd(), rootDir);
        }
        
        return {
            targetDir: targetDir,
            dirs: dirs,
            rootDir: rootDir
        };
    },

    run: function(args, config, rapido) {

        
        var targetDir = args.targetDir;
        var rootDir = args.rootDir;

        function migratePage(sourceDir, targetDir) {
            console.log('Migrating page from "' + sourceDir + '" to "' + targetDir + '"...');

            mkdirp.sync(targetDir);

            var sourceFiles = fs.readdirSync(sourceDir);
            var oldShortName = nodePath.basename(sourceDir);

            function transformOptimizer(optimizer) {
                var dependencies = optimizer.dependencies;

                if (dependencies) {
                    optimizer.dependencies = optimizer.dependencies.map(function(d) {
                        if (typeof d !== 'string') {
                            return d;
                        }

                        if (d === oldShortName + 'Widget.js') {
                            return 'require: ./widget';
                        } else if (d === oldShortName + '.rhtml') {
                            return 'template.rhtml';
                        } else if (d === oldShortName + '.css') {
                            return 'style.css';
                        } else {
                            return d;
                        }
                    });
                }

                return JSON.stringify(optimizer, null, 4);
            }

            function copyDir(dir, targetDir) {
                try {
                    fs.mkdirSync(targetDir);    
                } catch(e) {}
                
                var filenames = fs.readdirSync(dir);
                filenames.forEach(function(filename) {
                    var file = nodePath.join(dir, filename);

                    var stat = fs.statSync(file);
                    if (stat.isDirectory()) {
                        copyDir(file, nodePath.join(targetDir, filename));
                        return;
                    } else {
                        var targetFile = nodePath.join(targetDir, filename);
                        var src = fs.readFileSync(file);
                        fs.writeFileSync(targetFile, src);
                    }
                });
            }


            sourceFiles.forEach(function(filename) {
                var file = nodePath.join(sourceDir, filename);

                if (file.startsWith(targetDir)) {
                    return;
                }

                var targetFile;
                var code;

                var stat = fs.statSync(file);
                if (stat.isDirectory()) {
                    copyDir(file, nodePath.join(targetDir, filename));
                    return;
                }

                if (filename === oldShortName + '.css') {
                    targetFile = nodePath.join(targetDir, 'style.css');
                } else if (filename === oldShortName + 'Widget.js' || filename === 'widget.js') {
                    targetFile = nodePath.join(targetDir, 'widget.js');
                    code = fs.readFileSync(file, 'utf8');
                    var className = nodePath.basename(sourceDir) + 'Widget';
                    var ctorRegExp = new RegExp('function\\s+' + className, 'g');
                    if (ctorRegExp.test(code)) {
                        var oldClassNameRegExp = new RegExp(nodePath.basename(sourceDir) + 'Widget', 'g');
                        code = code.replace(oldClassNameRegExp, 'Widget');
                    }
                } else if (filename === oldShortName + '.rhtml') {
                    targetFile = nodePath.join(targetDir, 'template.rhtml');
                    code = fs.readFileSync(file, 'utf8');
                    code = code.replace(/w[:-]widget="([^"]+)"/g, 'w-bind="./widget"');
                } else if (filename === 'index.js') {
                    targetFile = nodePath.join(targetDir, 'index.js');
                    code = fs.readFileSync(file, 'utf8');

                    var foundRaptorTemplatesRender = false;

                    // raptorContext.renderTemplate
                    code = code.replace(/(raptorContext\s*.renderTemplate\(['"]([^'"]+)['"],\s*)(((?:.|\s)+?)(?=\s*\}\s*\);)\s*\}\s*\);)/g, function(match, firstPart, templatePath, everythingElse) {
                        foundRaptorTemplatesRender = true;
                        everythingElse = everythingElse.replace(/\}\s*\)\s*;$/, '}, res);');
                        return 'template.render(' + everythingElse;
                    });

                    if (foundRaptorTemplatesRender) {
                        code = "var template = require('raptor-templates').load(require.resolve('./template.rhtml'));\n" + code;
                    }
                } else if (filename.endsWith('optimizer.json')) {
                    code = transformOptimizer(JSON.parse(fs.readFileSync(file, 'utf8')));
                }

                if (!targetFile) {
                    targetFile = nodePath.join(targetDir, filename);
                }

                if (code == null) {
                    fs.writeFileSync(targetFile, fs.readFileSync(file));
                    return;
                    
                }

                fs.writeFileSync(targetFile, code, 'utf8');

            });
        }

        var dirs = args.dirs;


        var pageDirs = [];
        
        function findPages(callback) {
            walk(
                dirs,
                {
                    file: function(file) {

                        var basename = nodePath.basename(file);
                        if (basename === 'index.js' && file.indexOf('pages/') !== -1) {
                            pageDirs.push(nodePath.dirname(file));
                        }
                    }
                },
                callback); 
        }

        function fixRelativePaths(fromDir, toDir, callback) {
            walk(
                rootDir,
                {
                    file: function(file) {
                        // if (toDir.endsWith('pages/explorer')) {

                        // }
                        
                        console.log('Fixing relative paths in file "' + file + '"');

                        var basename = nodePath.basename(file);
                        if (basename.endsWith('optimizer.json')) {
                            var optimizerManifest = JSON.parse(fs.readFileSync(file, 'utf8'));
                            // console.log(module.id, 'fixRelativePaths: ', file, fromDir,);
                            optimizerManifest = optimizerFixRelativePaths(optimizerManifest, file, fromDir, toDir, rootDir); 
                            fs.writeFileSync(file, JSON.stringify(optimizerManifest, null, 4), 'utf8');
                        } else if (basename.endsWith('.js')) {
                            commonjsFixRelativePaths(file, fromDir, toDir, rootDir);
                        }
                    }
                },
                callback);
        }

        function migratePages(callback) {

            var migrateTasks = [];

            pageDirs.forEach(function(pageDir) {
                
                var targetPageDir = nodePath.join(targetDir, nodePath.basename(pageDir));

                migrateTasks.push(function(callback) {
                    migratePage(pageDir, targetPageDir);
                    removeDir(pageDir);
                    fixRelativePaths(pageDir, targetPageDir, callback);
                });
            });

            raptorAsync.series(migrateTasks, callback);
        }        

        raptorAsync.series([
                findPages,
                migratePages
            ],
            function(err) {
                if (err) {
                    console.error('Error while migrating pages: ' + (err.stack || err));
                    return;
                }

                console.log('All pages migrated');
            });
    }
};
