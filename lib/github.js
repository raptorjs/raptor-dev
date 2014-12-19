'use strict';

var https = require('https');
var url = require('url');
var path = require('path');
var fs = require('fs');

var linkRegex = /<([^\>]+)>; rel=\"next\"/;
var DataHolder = require('raptor-async/DataHolder');

var _githubBasicAuth = new DataHolder({
    loader: function(callback) {
        console.log('GitHub login required.');
        
        var prompt = require('prompt');
        prompt.start();

        var properties = [
            {
                name: 'username',
                description: 'Enter github username',
                required: true
            },
            {
                name: 'password',
                description: 'Enter github password',
                required: true,
                hidden: true
            }
        ];

        prompt.get(properties, function(err, result) {
            if (err) {
                delete err.stack;
                return callback(err);
            }
            var auth = 'Basic ' + new Buffer(result.username + ':' + result.password).toString('base64');
            callback(null, auth);
        });
    }
});

function findNext(response) {
    var linkHeader = response.headers['link'];
    if (!linkHeader) {
        return null;
    }

    var match = linkRegex.exec(linkHeader);
    return match && match[1];
}

function fetch(urlStr, callback) {
    _githubBasicAuth.done(function(err, auth) {
        if (err) {
            _githubBasicAuth.unsettle();
            return callback(err);
        }
        
        var urlObj = url.parse(urlStr);
    
        var requestOptions = {
            host: urlObj.host,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.path,
            method: 'GET',
            headers: {
                // GitHub API requires User-Agent
                'User-Agent': 'raptor-dev setup',
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': auth
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
                    console.error(dataStr);
                    return callback(new Error('Received response status code that was not OK'), dataStr, response);
                }
    
                callback(null, dataStr, response);
            });
        });
    
        // send the request
        request.end();
    });
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
            
            console.log(repos);

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
