'use strict';

require('raptor-polyfill');
var github = require('../lib/github');
var series = require('raptor-async/series');

var nodePath = require('path');

var BLACKLIST = {
    'atom-language-marko': true,
    'branding': true,
    'raptor-samples': true,
    'raptor-sample-ui-components': true,
    'raptorjs.github.com': true,
    'templating-benchmarks': true,
    'website': true,
    'markoify': true
};

function createPublishJob(repo, rapido, failed) {
    return function(callback) {
        rapido.runCommand('module', 'publish', {
            cwd: repo.localDir
        }).then(function() {
            callback();
        }).fail(function(err) {
            rapido.log.error('Error publishing: ' + repo.name, err);
            failed.push(repo.name + ' failed. Reason: ' + err);
            callback();
        });
    };
}

module.exports = {
    usage: 'Usage: $0 $commandName [dir]',

    options: {
    },

    validate: function(args, rapido) {
        var dir = args._[0];
        if (dir) {
            dir = nodePath.resolve(process.cwd(), dir);
        }
        else {
            dir = process.cwd();
        }

        return {
            dir: dir
        };
    },

    run: function(args, config, rapido) {
        github.fetchLocalRepos(function(err, repos) {
            var work = [];
            var failed = [];

            repos.sort(function(r1, r2) {
                return r1.name.localeCompare(r2.name);
            });

            for (var i = 0; i < repos.length; i++) {
                var repo = repos[i];
                var name = repo.name;
                if (BLACKLIST[name]) {
                    continue;
                }

                console.log('Publishing: ' + repo.name);

                work.push(createPublishJob(repo, rapido, failed));
            }

            series(work, function(err) {
                if (err || failed.length > 0) {
                    rapido.log.error('Error publishing modules. ' + (err ? err + '. ' : '') + 'Failed modules:\n' + failed.join('\n'));
                    return;
                }

                rapido.log.success('All modules successfully published!');
            });
        });
    }
};
