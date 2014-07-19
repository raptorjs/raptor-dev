'use strict';

require('raptor-polyfill');
var walk = require('../lib/walk');
var nodePath = require('path');
var fs = require('fs');
var packageTransformer = require('../lib/package-transformer');

function readJsonFile(path) {
    var json = fs.readFileSync(path, {encoding: 'utf8'});
    return JSON.parse(json);
}

function writeJsonFile(path, pkg) {
    var json = JSON.stringify(pkg, null, 4);
    fs.writeFileSync(path, json, {encoding: 'utf8'});
}

function isEmpty(o) {
    for (var k in o) {
        if (o.hasOwnProperty(k)) {
            return false;
        }
    }
    return true;
}

module.exports = {
    usage: 'Usage: $0 $commandName [dir]',

    options: {
        'preserve-orig': {
            description: 'Do not modify or delete the original package.json',
            type: 'boolean',
            default: false
        },
        'root-dir': {
            description: 'The root directory to resolve "absolute" paths relative to',
            type: 'string'
        },
        'project-root-dir': {
            description: 'The root directory for the project',
            type: 'string'
        }
    },

    validate: function(args, rapido) {
        args.files = args._;
        if (!args.files || !args.files.length) {
            throw 'one or more files is required';
        }

        var rootDir = args['root-dir'];
        
        if (rootDir) {
            rootDir = nodePath.resolve(process.cwd(), rootDir);
        } else {
            rootDir = process.cwd();
        }

        var projectRootDir = args['project-root-dir'];
        
        if (projectRootDir) {
            projectRootDir = nodePath.resolve(process.cwd(), projectRootDir);
        }

        args.rootDir = rootDir;
        args.projectRootDir = projectRootDir;

        return args;
    },

    run: function(args, config, rapido) {
        var files = args.files;
        var rootDir = args.rootDir;
        var projectRootDir = args.projectRootDir;

        // console.log(JSON.stringify(args, null, ' '));

        walk(
            files,
            {
                file: function(file) {

                    var basename = nodePath.basename(file);
                    var dirname = nodePath.dirname(file);

                    if (basename !== 'package.json' &&
                        !basename.endsWith('-package.json') &&
                        basename !== 'optimizer.json' &&
                        !basename.endsWith('-optimizer.json')) {
                        return;
                    }

                    var pkg;
                    try {
                        pkg = readJsonFile(file);
                    }
                    catch(e) {
                        rapido.log.error('WARN', 'Unable to parse JSON file at path "' + file + '". Skipping!');
                        return;
                    }
                    
                    
                    var isOptimizerManifest = pkg.raptor ||
                        pkg['raptor-optimizer'] ||
                        Array.isArray(pkg.dependencies) ||
                        Array.isArray(pkg.includes) ||
                        pkg.extensions;

                    if (isOptimizerManifest) {
                        rapido.log.info('Migrating "' + file + '"...');
                        var transformedPkg = packageTransformer.transform(pkg, file, rootDir, projectRootDir);
                        
                        var outputName;

                        if (basename.endsWith('-package.json')) {
                            outputName = basename.slice(0, 0-'-package.json'.length) + '-optimizer.json';
                        }
                        else if (basename === 'package.json') {
                            outputName = 'optimizer.json';
                        }
                        else {
                            outputName = basename;
                        }

                        var outputFile = nodePath.join(dirname, outputName);
                        var alreadyExists = fs.existsSync(outputFile);

                        writeJsonFile(outputFile, transformedPkg);

                        if (alreadyExists) {
                            rapido.log.info('updated', outputFile);
                        }
                        else {
                            rapido.log.info('added', outputFile);
                        }

                        if ((args['preserve-orig'] === false) && (outputFile !== file)) {
                            delete pkg.raptor;
                            delete pkg['raptor-optimizer'];

                            if (Array.isArray(pkg.dependencies)) {
                                delete pkg.dependencies;
                            }

                            delete pkg.extensions;

                            if (pkg.type === 'raptor-module' || pkg.type === 'module') {
                                pkg = {}; // Delete all of the metadata... not actually a Node.js module
                            }

                            
                            if (isEmpty(pkg)) {
                                rapido.log.info('deleted', file);
                                fs.unlinkSync(file);
                            }
                            else {
                                rapido.log.info('updated', file);
                                writeJsonFile(file, pkg);
                            }
                        }
                    }
                }
            },
            function(err) {
                if (err) {
                    console.error('Error while migrating to optimizer.json: ' + (err.stack || err));
                    return;
                }
                
                console.log('All package.json migrated to optimizer.json');
            });
    }
};
