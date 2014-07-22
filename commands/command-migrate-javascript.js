'use strict';

require('raptor-polyfill');
var nodePath = require('path');
var jsTransformer = require('../lib/js-transformer');
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
        'relative-to-root': {
            description: 'If false (default), paths will be calculated relative to the containing directory. Otherwise, paths will be relative to the project root',
            type: 'boolean',
            default: false
        },
        'root-dir': {
            description: 'Project root directory',
            type: 'string'
        },
        'require-only': {
            type: 'boolean',
            default: false  
        },
        'require-mappings': {
            description: 'Path to a JSON file that maps a require path from one to another',
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

        var relativeToRoot = args['relative-to-root'] === true;
        var rootDir = args['root-dir'];

        if (rootDir) {
            rootDir = nodePath.resolve(process.cwd(), rootDir);
        }

        var requireOnly = args['require-only'] === true;

        var requireMappings = args['require-mappings'];

        return {
            searchPath: searchPath,
            files: files,
            skipTransformRequire: args['skip-transform-require'],
            rootDir: rootDir,
            relativeToRoot: relativeToRoot,
            requireOnly: requireOnly,
            requireMappings: requireMappings
        };
    },

    run: function(args, config, rapido) {
        var files = args.files;
        var requireMappings = args.requireMappings;
        if (requireMappings) {
            args.requireMappings = require(nodePath.resolve(process.cwd(), requireMappings));
        }

        function transformFile(file) {
            if (/^jquery/.test(nodePath.basename(file))) {
                // Don't bother transforming jquery and jquery plugins
                return;
            }

            var src = fs.readFileSync(file, {encoding: 'utf8'});
            console.log('Transforming ' + file + '...');
            args.from = nodePath.dirname(file);
            var transformed = jsTransformer.transform(src, args);
            fs.writeFileSync(file, transformed, {encoding: 'utf8'});
        }

        console.log('Transforming files in the following directories: ' + files.join(', '));

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
                
                console.log('All JavaScript files migrated to CommonJS');
            });
    }
};
