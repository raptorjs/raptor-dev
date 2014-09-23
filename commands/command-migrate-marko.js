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

        walk(
            files,
            {
                file: function(file) {

                    var filename = nodePath.basename(file);
                    var dir = nodePath.dirname(file);
                    var src;

                    if (file.endsWith('.rhtml')) {
                        console.log('Processing "' + file + '"...');
                        src = fs.readFileSync(file, 'utf8');
                        src = src.replace(/c\-(if|var|require|for|def||invoke|attrs|include|with|for\-each)/g, '$1');
                        src = src.replace(/data-provider="\$\{([^}]+)\}"/g, 'data-provider="$1"');
                        src = src.replace(/data-provider="\$([^"]+)"/g, 'data-provider="$1"');
                        src = src.replace(/rhtml/g, 'marko');
                        fs.writeFileSync(file, src, 'utf8');
                        fs.renameSync(file, file.replace(/\.rhtml$/g, '.marko'));

                    } else if (file.endsWith('.rxml')) {
                        console.log('Processing "' + file + '"...');
                        fs.renameSync(file, file.replace(/\.rxml$/g, '.marko.xml'));
                    } else if (filename === 'raptor-taglib.json') {
                        console.log('Processing "' + file + '"...');
                        fs.renameSync(file, nodePath.join(dir, 'marko-taglib.json'));
                    } else if (filename === 'raptor-tag.json') {
                        console.log('Processing "' + file + '"...');
                        fs.renameSync(file, nodePath.join(dir, 'marko-tag.json'));
                    } else if (filename.indexOf('.rhtml.') !== -1) {
                        console.log('Processing "' + file + '"...');
                        fs.renameSync(file, nodePath.join(dir, filename.replace(/\.rhtml\./g, '.marko.')));
                    } else if (filename.indexOf('.rxml.') !== -1) {
                        console.log('Processing "' + file + '"...');
                        fs.renameSync(file, nodePath.join(dir, filename.replace(/\.rxml\./g, '.marko.xml.')));
                    } else if (file.endsWith('.js')) {
                        console.log('Processing "' + file + '"...');
                        src = fs.readFileSync(file, 'utf8');
                        src = src.replace(/rhtml/g, 'marko');
                        src = src.replace(/raptorTemplates/g, 'marko');
                        src = src.replace(/raptor\-templates/g, 'marko');
                        src = src.replace(/raptorWidgets/g, 'markoWidgets');
                        src = src.replace(/raptor\-widgets/g, 'marko-widgets');
                        fs.writeFileSync(file, src, 'utf8');
                    } else if (file.endsWith('package.json') || file.endsWith('optimizer.json')) {
                        console.log('Processing "' + file + '"...');
                        src = fs.readFileSync(file, 'utf8');
                        src = src.replace(/raptor\-templates/g, 'marko');
                        src = src.replace(/raptor\-widgets/g, 'marko-widgets');
                        fs.writeFileSync(file, src, 'utf8');
                    } else if (file.indexOf('ignore') != -1) {
                        console.log('Processing "' + file + '"...');
                        src = fs.readFileSync(file, 'utf8');
                        src = src.replace(/rhtml/g, 'marko');
                        fs.writeFileSync(file, src, 'utf8');
                    } else if (file.endsWith('.md')) {
                        console.log('Processing "' + file + '"...');
                        src = fs.readFileSync(file, 'utf8');
                        src = src.replace(/Raptor Templates/g, 'Marko');
                        src = src.replace(/raptor templates/g, 'Marko');
                        src = src.replace(/raptor\-templates/g, 'marko');
                        src = src.replace(/rhtml/g, 'marko');
                        fs.writeFileSync(file, src, 'utf8');
                    }
                }
            },
            function(err) {
                if (err) {
                    console.error('Error while migrating JavaScript: ' + (err.stack || err));
                    return;
                }

                console.log('Migration from Raptor Templates to Marko completed!');
            });
    }
};
