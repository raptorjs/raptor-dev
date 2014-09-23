var xmlTransformer = require('../lib/taglib-xml-transformer');
var jsonTransformer = require('../lib/taglib-json-transformer');
var nodePath = require('path');
var fs = require('fs');
var walk = require('../lib/walk');

require('raptor-polyfill');

module.exports = {
    usage: 'Usage: $0 $commandName <file>',

    options: {
        'taglib-name': {
            'default': 'raptor-taglib.json'
        }
    },

    validate: function(args, rapido) {
        var files = args._;
        if (!files || !files.length) {
            throw 'one or more files is required';
        }

        args.files = files;
        return args;
    },

    run: function(args, config, rapido) {
        var files = args.files;

        var foundRtldFiles = [];

        walk(
            files,
            {
                file: function(file) {

                    var taglib;

                    var dirname = nodePath.dirname(file);
                    var outputFile = nodePath.join(dirname, args['taglib-name']);

                    try {
                        if (file.endsWith('.rtld')) {
                            var importedPaths = [];
                            var prefix;

                            var options = {
                                onNamespace: function(namespace) {
                                    // use the shortest prefix that we find
                                    if (prefix == null || namespace.length < prefix.length) {
                                        prefix = namespace;
                                    }
                                },
                                importHandler: function(taglibPath) {
                                    importedPaths.push(taglibPath);
                                }
                            };

                            taglib = xmlTransformer.transform(file, options);

                            if (!prefix) {
                                rapido.log.warn('Ignoring ' + file + ' because it has no prefix');
                                return;
                            }

                            foundRtldFiles.push(file);

                            if (importedPaths.length) {
                                var tags = taglib.tags || (taglib.tags = {});

                                importedPaths.forEach(function(importPath) {
                                    var importedTaglib = xmlTransformer.transform(importPath, {
                                        prefix: prefix
                                    });

                                    var tagNames = Object.keys(importedTaglib.tags);
                                    var importedDirname = nodePath.dirname(importPath);

                                    if (tagNames.length === 1) {
                                        var importedTagName = tagNames[0];
                                        var tagDef = importedTaglib.tags[importedTagName];
                                        var tagFile = nodePath.join(importedDirname, 'raptor-tag.json');

                                        // delete the origName property before writing tag file
                                        delete tagDef.origName;

                                        fs.writeFileSync(tagFile, JSON.stringify(tagDef, null, 4), 'utf8');
                                        tags[importedTagName] = nodePath.relative(dirname, tagFile);
                                    } else {
                                        tagNames.forEach(function(importedTagName) {
                                            var tagDef = importedTaglib.tags[importedTagName];
                                            var tagFile = nodePath.join(importedDirname, tagDef.origName + '.raptor-tag.json');

                                            // delete the origName property before writing tag file
                                            delete tagDef.origName;

                                            fs.writeFileSync(tagFile, JSON.stringify(tagDef, null, 4), 'utf8');
                                            tags[importedTagName] = nodePath.relative(dirname, tagFile);
                                        });
                                    }
                                });
                            }
                            // if (fs.existsSync(outputFile)) {
                            //     return;
                            // }
                        } else if (file.endsWith('raptor-taglib.json')) {
                            taglib = jsonTransformer.transform(file);
                        } else {
                            return;
                        }

                        fs.writeFileSync(outputFile, JSON.stringify(taglib, null, 4), 'utf8');
                        console.log('Migrated "' + rapido.relativePath(file) + '" to "' + rapido.relativePath(outputFile) + '"');
                    } catch(e) {
                        console.error('Unable to migrate "' + rapido.relativePath(file) + '". Error: ' + (e.stack || e));
                    }

                }
            },
            function(err) {
                if (err) {
                    console.error('Error while migrating taglibs: ' + (err.stack || err));
                    return;
                }

                foundRtldFiles.forEach(function(file) {
                    //fs.unlinkSync(file);
                });

                console.log('All taglibs migrated');
            });


    }
};
