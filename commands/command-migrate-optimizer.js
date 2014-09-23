'use strict';

require('raptor-polyfill');
var fs = require('fs');
var walk = require('../lib/walk');

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

                    var src;

                    if (file.endsWith('.js')) {
                        console.log('Processing "' + file + '"...');
                        src = fs.readFileSync(file, 'utf8');
                        src = src.replace(/raptor\-optimizer/g, 'optimizer');
                        src = src.replace(/raptorOptimizer/g, 'optimizer');
                        fs.writeFileSync(file, src, 'utf8');
                    } else if (file.endsWith('package.json') || file.endsWith('optimizer.json')) {
                        console.log('Processing "' + file + '"...');
                        src = fs.readFileSync(file, 'utf8');
                        src = src.replace(/raptor\-optimizer/g, 'optimizer');
                        fs.writeFileSync(file, src, 'utf8');
                    } else if (file.endsWith('.md')) {
                        console.log('Processing "' + file + '"...');
                        src = fs.readFileSync(file, 'utf8');
                        src = src.replace(/raptor\-optimizer/g, 'optimizer');
                        src = src.replace(/raptorOptimizer/g, 'optimizer');
                        fs.writeFileSync(file, src, 'utf8');
                    }
                }
            },
            function(err) {
                if (err) {
                    console.error('Error while migrating JavaScript: ' + (err.stack || err));
                    return;
                }

                console.log('Migration from raptor-optimizer to optimizer completed!');
            });
    }
};
