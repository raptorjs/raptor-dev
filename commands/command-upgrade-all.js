'use strict';

var fs = require('fs');
var series = require('raptor-async/series');
var upgrade = require('../lib/upgrade');
var path = require('path');

function upgradeRepo(dir, args, logger, callback) {
    fs.stat(dir, function(err, stats) {
        if (err) {
            logger.warn('Ignoring "' + dir + '".', err.toString());
            return callback();
        }

        if (!stats.isDirectory()) {
            return callback();
        }

        var shouldPrompt = (args['no-prompt'] === false);

        logger.info('Upgrading "' + dir + '"...');
        upgrade.upgradePackage(dir, shouldPrompt, logger, function(err) {
            if (err) {
                logger.warn('Error while upgrading "' + dir + '".', err.toString());
            } else {
                logger.success('Upgraded "' + dir + '".');
            }

            callback();
        });
    });
}

module.exports = {
    usage: 'Usage: $0 $commandName [dir]',

    options: {
        'no-prompt': {
            description: 'Do not prompt for each upgrade',
            type: 'boolean',
            default: true
        }
    },

    validate: function(args, rapido) {
        args.dir = args._[0];

        if (args.dir) {
            args.dir = path.resolve(process.cwd(), args.dir);
        } else {
            args.dir = process.cwd();
        }

        return args;
    },

    run: function(args, config, rapido) {
        var org = require('../lib/raptorjs-github-org');

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
            
            var dir = path.resolve(result.dir);

            fs.readdir(dir, function(err, files) {
                var work = [];
                files.forEach(function(dir) {
                    work.push(function(callback) {
                        upgradeRepo(dir, args, logger, callback);
                    });
                });

                series(work, function(err) {
                    if (err) {
                        logger.error('Error upgrading "' + dir + '"', err);
                    } else {
                        logger.success('Done');
                    }
                });
            });
        });
    }
};