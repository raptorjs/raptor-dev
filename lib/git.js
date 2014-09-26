'use strict';
var fs = require('fs');
var async = require('raptor-async');
var path = require('path');

function runGitCommand(gitArgs, dir, callback) {
    var spawn = require('child_process').spawn;

    var git = spawn('git', gitArgs, {
        cwd: dir
    });

    //git.stdout.setEncoding('utf8');
    //git.stderr.setEncoding('utf8');

    var stdout = [];
    var stderr = [];


    // pipe stdout to our own console
    git.stdout.on('data', function (data) {
        stdout.push(data);
        process.stdout.write(data);
    });

    // pipe stderr to our own console
    git.stderr.on('data', function (data) {
        stderr.push(data);
        process.stderr.write(data);
    });

    // catch errors
    git.on('error', function(err) {
        callback(err);
    });

    git.on('close', function (code) {
        var err = stderr.join('').trim();
        if (!err) {
            err = null;
        }
        callback(err, stdout.join(''));
    });
}

module.exports = {
    /**
     * Tell the OS to run the "git" command with the given arguments and in the given directory
     */
    runGitCommand: runGitCommand,

    isClean: function(repoDir, callback) {
        runGitCommand(['status', '--porcelain'], repoDir, function(err, stdout) {
            if (err) {
                return callback(err);
            }

            callback(null, (stdout.trim().length === 0));
        });
    },

    updateRepos: function(repos, dir, logger, callback) {
        var self = this;
        var raptorModuleDirs = [];

        var createGitJob = function(repo) {
            var repoDir = path.join(dir, repo.name);
            raptorModuleDirs.push(repoDir);

            return function(callback) {

                if (fs.existsSync(repoDir)) {

                    self.isClean(repoDir, function(err, clean) {
                        if (err) {
                            logger.error('Error checking clean status of git repo "' + repo.name + '". ' + err);
                            return callback(err);
                        }

                        if (!clean) {
                            logger.warn('Local Git repository "' + repo.name + '" is not clean. Skipping.');
                            return callback();
                        }

                        logger.info('Updating ' + repo.name + '...');
                        runGitCommand(['pull', '-u', '-q', '--no-progress'], repoDir, function(err) {
                            if (err) {
                                logger.warn('Error updating repo at ' + repoDir + '. ' + err);
                            }
                            callback();
                        });
                    });
                } else {
                    logger.info('Repo ' + repo.name + ' does not exist at "' + repoDir + '".');

                    logger.info('Cloning ' + repo.name + ' from URL "' + repo.clone_url + '"...');
                    runGitCommand(['clone', '-q', repo.clone_url], dir, function(err) {
                        if (err) {
                            logger.error('Error cloning "' + repo.name + '" to "' + repoDir + '"');
                        }
                        callback(err);
                    });
                }
            };
        };

        var gitWork = [];
        for (var i = 0; i < repos.length; i++) {
            var repo = repos[i];
            gitWork.push(createGitJob(repo));
        }

        async.series(gitWork, callback);
    }
};
