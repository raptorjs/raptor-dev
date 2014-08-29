'use strict';

var path = require('path');
var git = require('../lib/git');
var npm = require('../lib/npm');
var parallel = require('raptor-async/parallel');
var fs = require('fs');
var rimraf = require('rimraf');

function removeDir(absFilePath, logger, callback) {
    var stat = fs.lstatSync(absFilePath);

    function onRemove(err) {
        if (err) {
            logger.error('Unable to remove unused module: ' + absFilePath, err);
        } else {
            logger.info('Removed unused module: ' + absFilePath);
        }
        callback();
    }

    if (stat.isDirectory()) {
        rimraf(absFilePath, onRemove);
    } else if (stat.isSymbolicLink()) {
        fs.unlink(absFilePath, onRemove);
    } else {
        // ignore
        return callback();
    }
}

function removeUnneeded(repos, reposDir, logger, callback) {
    var createJob = function(repo, repoDir) {
        return function(callback) {
            fs.readFile(path.join(repoDir, 'package.json'), 'utf8', function(err, json) {
                if (err) {
                    return callback();
                }

                var known = {};

                var packageObj = JSON.parse(json);
                var moduleName;
                if (packageObj.dependencies) {
                    for (moduleName in packageObj.dependencies) {
                        known[moduleName] = true;
                    }
                }

                if (packageObj.devDependencies) {
                    for (moduleName in packageObj.devDependencies) {
                        known[moduleName] = true;
                    }
                }

                var node_modulesDir = path.join(repoDir, 'node_modules');
                fs.readdir(node_modulesDir, function(err, files) {
                    if (err) {
                        return callback();
                    }

                    var work = [];

                    files.forEach(function(filePath) {
                        if (!known[filePath] && (filePath.charAt(0) !== '.')) {
                            work.push(function(callback) {
                                var absFilePath = path.join(node_modulesDir, filePath);
                                removeDir(absFilePath, logger, callback);
                            });
                        }
                    });

                    parallel(work, callback);
                });
            });
        };
    };

    var work = [];
    for (var i = 0; i < repos.length; i++) {
        var repo = repos[i];
        var repoDir = path.join(reposDir, repo.name);

        work.push(createJob(repo, repoDir));
    }

    parallel(work, callback);
}

function runSetup(args, logger) {
    var org = require('../lib/raptorjs-github-org');

    logger.info('Repositories for ' + org + ' will be cloned to ' + args.dir);

    // STEP 1: Find all of the RaptorJS repos on GitHub
    require('../lib/github').fetchRepos(org, function(err, repos) {
        if (err) {
            logger.error('Error fetching GitHub repositories.', err);
            process.exit(1);
            return;
        }

        var dir = args.dir;
        var i;
        var repo;

        logger.info('Found the following ' + org + ' repositories on GitHub:');
        for (i = 0; i < repos.length; i++) {
            repo = repos[i];
            logger.info(repo.name);
        }

        logger.info('Cloning or updating raptorjs repositories to ' + dir + '...');

        // STEP 2: Run "git clone" or "git pull -u" for each repo
        git.updateRepos(repos, args.dir, logger, function(err) {
            if (err) {
                logger.error('Error cloning one or more repos.');
                return;
            }

            logger.info('All raptorjs repositories cloned or updated successfully.');

            // STEP 3: Remove unneeded isntalled modules (former dependencies)
            removeUnneeded(repos, args.dir, logger, function() {

                if (args.link !== false) {
                    // STEP 4: Use "npm link" to link all of the modules for development
                    npm.linkModules(repos, args.dir, logger, function(err) {

                        if (err) {
                            logger.error('Error linking modules.', err);
                            return;
                        }

                        logger.info('All raptorjs modules linked successfully.');
                    });
                }
            });
        });
    });
}
module.exports = {
    usage: 'Usage: $0 $commandName [dir]',

    options: {
        'org': {
            'description': 'GitHub organization',
            'default': require('../lib/raptorjs-github-org')
        },
        'link': {
            'description': 'Disable/enable npm link of modules',
            type: 'boolean',
            default: true
        }
    },

    validate: function(args, rapido) {
        args.org = args.org || 'raptorjs3';
        args.dir = args._[0];

        if (args.dir) {
            args.dir = path.resolve(process.cwd(), args.dir);
        } else {
            if (__dirname.indexOf('node_modules') === -1) {
                args.dir = path.normalize(path.join(__dirname, '../..'));
            } else {
                args.dir = process.cwd();
            }
        }

        return args;
    },

    run: function(args, config, rapido) {
        var org = args.org;

        var logger = rapido.log;

        logger.info('GitHub organization: ' + org);

        var prompt = rapido.prompt;
        prompt.start();
        prompt.get({
            properties: {
                dir: {
                    name: 'dir',
                    description: 'Enter location for ' + org + ' repositories',
                    default: args.dir
                }
            }
        }, function(err, result) {
            if (err) {
                logger.error(err);
                return;
            }
            
            args.dir = path.resolve(result.dir);
            runSetup(args, rapido.log);
        });
    }
};