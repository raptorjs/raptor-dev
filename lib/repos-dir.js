var path = require('path');

var reposDir;
if (__dirname.indexOf('node_modules') === -1) {
    reposDir = path.normalize(path.join(__dirname, '../..'));
} else {
    reposDir = process.cwd();
}

module.exports = reposDir;