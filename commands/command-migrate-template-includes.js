require('raptor-polyfill');
var nodePath = require('path');
var fs = require('fs');
var walk = require('../lib/walk');
var findTemplateIncludes = require('../lib/find-template-includes');
var extend = require('raptor-util/extend');
var raptorAsync = require('raptor-async');
var optimizerFixRelativePaths = require('../lib/optimizerFixRelativePaths');
var commonjsFixRelativePaths = require('../lib/commonjsFixRelativePaths');

function copyDir(dir, targetDir) {
    try {
        console.log('Creating directory "' + targetDir + '"...') ;
        fs.mkdirSync(targetDir);
        console.log('Created directory "' + targetDir + '"') ;
    } catch(e) {
        // console.log('Unable to create directory "' + targetDir + '". Exception: ', e.stack || e);
    }

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

function removeDir(dir) {
    try {
        var children = fs.readdirSync(dir);
        for (var i = 0; i < children.length; i++) {
            var file = nodePath.join(dir, children[i]);
            var stat = fs.statSync(file);

            if (stat.isDirectory()) {
                removeDir(file);
            } else {
                fs.unlinkSync(file);
            }
        }

        fs.rmdirSync(dir);
    } catch(e) {}
}

module.exports = {
    usage: 'Usage: $0 $commandName [dir]',

    options: {
        'root-dir': {
            description: 'The root directory to resolve "absolute" paths relative to',
            type: 'string'
        }
    },

    validate: function(args, rapido) {
        var files = args._;
        if (!files || !files.length) {
            throw 'one or more files is required';
        }

        var rootDir = args['root-dir'];

        if (rootDir) {
            rootDir = nodePath.resolve(process.cwd(), rootDir);
        } else {
            rootDir = process.cwd();
        }

        return {
            files: files,
            rootDir: rootDir
        };

    },



    run: function(args, config, rapido) {
        var rootDir = args.rootDir;
        console.log('--------------');
        console.log('Configuration:');
        for (var key in args) {
            console.log(key + ': ' + args[key]);
        }
        console.log('--------------');

        var taglibFile = null;

        var newTagFiles = {};


        function fixRelativePaths(fromDir, toDir, callback) {
            walk(
                files,
                {
                    file: function(file) {

                        var basename = nodePath.basename(file);
                        if (basename.endsWith('optimizer.json')) {
                            var optimizerManifest = JSON.parse(fs.readFileSync(file, 'utf8'));
                            // console.log(module.id, 'fixRelativePaths: ', file, fromDir,);
                            optimizerManifest = optimizerFixRelativePaths(optimizerManifest, file, fromDir, toDir);
                            fs.writeFileSync(file, JSON.stringify(optimizerManifest, null, 4), 'utf8');
                        } else if (basename.endsWith('.js')) {
                            commonjsFixRelativePaths(file, fromDir, toDir);
                        }
                    }
                },
                callback);
        }

        function transformFile(file) {
            var src = fs.readFileSync(file, {encoding: 'utf8'});
            console.log('Transforming ' + file + '...');

             var transformed = findTemplateIncludes.replace(src, function(match) {
                var attributes = extend({}, match.attributes);
                var template = attributes.template;
                if (template.charAt(0) === '.') {
                    return null; // Template path is a relative path... that is okay
                }

                var targetFile = nodePath.join(rootDir, template);
                var stat;

                try {
                    stat = fs.statSync(targetFile);
                } catch(e) {
                    if (!targetFile.endsWith('.rhtml')) {
                        targetFile += '.rhtml';
                        try {
                            stat = fs.statSync(targetFile);
                        } catch(e) {}
                    }
                }

                if (stat && stat.isDirectory()) {
                    targetFile = targetFile + '/' + nodePath.basename(template) + '.rhtml';

                    try {
                        stat = fs.statSync(targetFile);
                    } catch(e) {}
                }

                if (!stat) {
                    console.log('Include template of "' + template + '" referenced in "' + file + '" does not exist.');
                    return null;
                }

                var body = match.body;


                var ext = nodePath.extname(template);

                console.log(nodePath.basename(template) + '\n' + ext.length + '\n' + nodePath.basename(template).slice(0, ext.length ? 0-ext.length : undefined));

                var tagName = 'app-' + nodePath.basename(template).slice(0, ext.length ? 0-ext.length : undefined);

                delete attributes.template;


                console.log('Converting template "' + template + '" to tag "' + tagName);
                newTagFiles[tagName] = targetFile;

                return {
                    tagName: tagName,
                    body: body,
                    attributes: attributes
                };
            });

            // transformedTemplateFiles[file] = transformed;
            fs.writeFileSync(file, transformed, {encoding: 'utf8'});
        }

        var files = args.files;

        function transformTemplates(callback) {
            walk(
                files,
                {
                    file: function(file) {

                        var basename = nodePath.basename(file);

                        if (basename.endsWith('.rhtml')) {
                            transformFile(file);
                        } else if (basename === 'raptor-taglib.json') {
                            taglibFile = file;
                        }
                    }
                },
                callback);
        }

        function transformIncludeTargetsToCustomTags(callback) {
            if (!Object.keys(newTagFiles).length) {
                console.log('No includes found');
                return callback();
            }

            var componentsDir = nodePath.join(rootDir, 'components');

            try {
                fs.mkdirSync(componentsDir);
                console.log('Created directory "' + componentsDir + '"') ;
            } catch(e) {}

            var taglib;

            if (taglibFile) {
                taglib = JSON.parse(fs.readFileSync(taglibFile, 'utf8'));
            } else {
                taglibFile = nodePath.join(rootDir, 'raptor-taglib.json');
                if (fs.existsSync(taglibFile)) {
                    taglib = JSON.parse(fs.readFileSync(taglibFile, 'utf8'));
                } else {
                    taglib = {};
                }
            }

            taglib.tags = taglib.tags || {};



            var migrateTasks = Object.keys(newTagFiles).map(function(tagName) {
                return function(callback) {
                    var templateFile = newTagFiles[tagName];

                    console.log('Creating component for "' + tagName + '" using template at path "' + nodePath.relative(process.cwd(), templateFile) + '"...');
                    var targetComponentDir = nodePath.join(componentsDir, tagName);
                    console.log('Target directory: ' + targetComponentDir);

                    try {
                        fs.mkdirSync(targetComponentDir);
                    } catch(e) {}

                    var basename = nodePath.basename(templateFile);
                    var dirname = nodePath.dirname(templateFile);

                    var dirMoved = false;

                    if (nodePath.basename(dirname) === basename.slice(0, 0-'.rhtml'.length)) {
                        // Use the entire directory as the custom tag implementation
                        // Copy the entire directory...
                        copyDir(dirname, targetComponentDir);
                        var targetTemplateFile = nodePath.join(targetComponentDir, basename);

                        fs.renameSync(targetTemplateFile, nodePath.join(targetComponentDir, 'template.rhtml'));
                        removeDir(dirname);
                        dirMoved = true;
                    } else {
                        // Just copy the individual template
                        var targetFile = nodePath.join(targetComponentDir, 'template.rhtml');
                        fs.writeFileSync(targetFile, fs.readFileSync(templateFile));
                        fs.unlinkSync(templateFile);
                    }

                    var raptorTagFile = nodePath.join(targetComponentDir, 'raptor-tag.json');
                    taglib.tags[tagName] = nodePath.relative(nodePath.dirname(taglibFile), raptorTagFile);

                    console.log('Added tag "' + tagName + '" to taglib. Target: ' + nodePath.relative(nodePath.dirname(taglibFile), raptorTagFile), taglib);

                    console.log('Writing file "' + raptorTagFile + '"...');
                    var raptorTagJSON = JSON.stringify({
                            template: './template.rhtml'
                        }, null, 4);

                    fs.writeFileSync(raptorTagFile, raptorTagJSON, 'utf8');

                    if (dirMoved) {
                        fixRelativePaths(dirname, targetComponentDir, callback);
                    } else {
                        callback();
                    }
                };

            });



            raptorAsync.series(migrateTasks, function(err) {
                if (err) {
                    return callback(err);
                }

                console.log('Writing updated taglib to file "' + taglibFile + '"...');
                fs.writeFileSync(taglibFile, JSON.stringify(taglib, null, 4), 'utf8');

                callback();
            });
        }

        raptorAsync.series([
                transformTemplates,
                transformIncludeTargetsToCustomTags
            ],
            function(err) {


                if (err) {
                    console.error('Error while transforming includes: ' + (err.stack || err));
                    return;
                }

                console.log('All template includes migrated to custom tags. New tags: ' + Object.keys(newTagFiles).join(', '));
            });

    }
};
