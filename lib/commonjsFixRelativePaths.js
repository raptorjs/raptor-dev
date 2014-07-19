require('raptor-polyfill/string/startsWith');
require('raptor-polyfill/string/endsWith');

var fs = require('fs');
var nodePath = require('path');
var cwd = process.cwd();
var fixRelativePath = require('./fixRelativePath');

var requireRegExp = /require\((?:["]([^"]+)["]|[']([^']+)['])\)/g;

function commonjsFixRelativePaths(file, fromDir, toDir, rootDir) {
    file = nodePath.resolve(cwd, file);
    fromDir = nodePath.resolve(cwd, fromDir);
    toDir = nodePath.resolve(cwd, toDir);

    // console.log('dir: ', dir);

    function fixPath(path) {

        if (path.endsWith('.json')) {
            return path;
        }

        var isRelative = path.charAt(0) === '.';
        
        path = fixRelativePath(path, file, fromDir, toDir, rootDir);

        if (path.endsWith('.js')) {
            path = path.slice(0, -3);
        }

        if (isRelative && path.charAt(0) !== '.') {
            path = './' + path;
        }
        
        return path;
    }

    var src = fs.readFileSync(file, 'utf8');
    src = src.replace(requireRegExp, function(match, path1, path2) {
        var path = path1 || path2;

        if (!path.startsWith('.') && !rootDir) {
            return match;
        } else {
            var replacement = "require('" + fixPath(path) + "')";
            // console.log('Replacement: ', replacement);
            return replacement;
        }
    });

    fs.writeFileSync(file, src, 'utf8');
}

module.exports = commonjsFixRelativePaths;