'use strict';

var https = require('https');
var url = require('url');
var path = require('path');
var fs = require('fs');

var linkRegex = /<([^\>]+)>; rel=\"next\"/;

function findNext(response) {
    var linkHeader = response.headers['link'];
    if (!linkHeader) {
        return null;
    }

    var match = linkRegex.exec(linkHeader);
    return match && match[1];
}

function fetch(urlStr, callback) {
    var urlObj = url.parse(urlStr);

    var requestOptions = {
        host: urlObj.host,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.path,
        method: 'GET',
        headers: {
            // GitHub API requires User-Agent
            'User-Agent': 'raptor-dev setup'
        }
    };

    var chunks = [];

    var request = https.request(requestOptions, function(response) {

        response.setEncoding('utf8');

        response.on('error', function(err) {
            callback(err);
        });

        response.on('data', function(chunk) {
            chunks.push(chunk);
        });

        response.on('end', function() {
            var dataStr = chunks.join('');

            if (response.statusCode !== 200) {
                return callback(new Error('Received response status code that was not OK'), dataStr, response);
            }

            callback(null, dataStr, response);
        });
    });

    // send the request
    request.end();
}

function fetchPage(githubUrl, callback) {
    fetch(githubUrl, function(err, data, response) {
        if (err) {
            return callback(err);
        }

        data = JSON.parse(data);
        callback(null, data, findNext(response));
    });
}

module.exports = {

    fetchLocalRepos: function(callback) {
        this.fetchRepos(function(err, repos) {
            if (err) {
                return callback(err);
            }

            var reposDir = require('./repos-dir');
            var localRepos = [];

            for (var i = 0; i < repos.length; i++) {
                var repo = repos[i];

                var localDir = path.join(reposDir, repo.name);
                if (fs.existsSync(localDir)) {
                    repo.localDir = localDir;
                    localRepos.push(repo);
                }
            }

            callback(null, localRepos);
        });
    },

    fetchRepos: function(org, callback) {
        if (arguments.length === 1) {
            callback = arguments[0];
            org = require('./raptorjs-github-org');
        }

        var url = 'https://api.github.com/orgs/' + org + '/repos';

        var result = [];

        function onFetchPage(err, data, next) {
            if (err) {
                return callback(err, data);
            }
            
            result = result.concat(data);

            if (next) {
                fetchPage(next, onFetchPage);
            } else {
                callback(null, result);
            }
        }

        fetchPage(url, onFetchPage);
    },

    raw: function(org, module, path, callback) {
        var url = 'https://raw.githubusercontent.com/' + org + '/' + module + path;
        fetch(url, callback);
    }
};
