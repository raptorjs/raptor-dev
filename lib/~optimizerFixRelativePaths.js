require('raptor-polyfill/string/startsWith');
var nodePath = require('path');
var requirePathRegExp = /^require(?:[:]?\s*|\s+)([^: ]+)$/;
var cwd = process.cwd();
var fixRelativePath = require('./fixRelativePath');

function optimizerFixRelativePaths(manifest, file, fromDir, toDir) {
    file = nodePath.resolve(cwd, file);
    fromDir = nodePath.resolve(cwd, fromDir);
    toDir = nodePath.resolve(cwd, toDir);

    // console.log('dir: ', dir);

    function fixPath(path) {

        var isRequire = false;

        var requireMatches = requirePathRegExp.exec(path);
        if (requireMatches) {
            isRequire = true;
            path = requireMatches[1];

            if (path.charAt(0) !== '.') {
                return 'require: ' + path;
            }
        }
        path = fixRelativePath(path, file, fromDir, toDir);

        if (isRequire) {
            if (path.charAt(0) !== '.') {
                path = './' + path;
            }
            path = 'require: ' + path;
        }

        // console.log();

        return path;
    }

    if (!manifest.dependencies) {
        return;
    }

    manifest.dependencies = manifest.dependencies.map(function(d) {
        if (typeof d === 'string') {
            return fixPath(d);
        }

        if (d.path) {
            d.path = fixPath(d.path);
        }

        return d;
    });

    return manifest;
}

module.exports = optimizerFixRelativePaths;