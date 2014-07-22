var nodePath = require('path');

function hasParentDir(path, parentDir) {
    return path === parentDir || path.startsWith(parentDir + '/');
}

function fixRelativePath(path, file, fromDir, toDir, rootDir) {
    var dir = nodePath.dirname(file);
    var originalPath = path;

    var log = function() {};

    // if (path.endsWith('metaAPI')) {
    //     log = function() {
    //         console.log.apply(console, arguments);
    //     };
    // }


    log('[fixRelativePath] path: ', path);
    log('[fixRelativePath] file: ', file);
    log('[fixRelativePath] fromDir: ', fromDir);
    log('[fixRelativePath] toDir: ', toDir);
    log('[fixRelativePath] rootDir: ', rootDir);
    log('[fixRelativePath] dir: ', dir);

    var absolutePath;
    var relToFromDir;
    var newAbsolutePath;

    if (path.charAt(0) !== '.' && rootDir) {
        // Treat this as a path that might be relative to the root dir
        absolutePath = nodePath.join(rootDir, path);
        log('[fixRelativePath] * absolutePath: ', absolutePath);

        // Was the old path moved? 
        if (hasParentDir(absolutePath, fromDir)) {
            relToFromDir = absolutePath.substring(fromDir.length);
            newAbsolutePath = nodePath.join(toDir, relToFromDir);
            if (hasParentDir(newAbsolutePath, rootDir)) {
                path = nodePath.relative(rootDir, newAbsolutePath);
            }
        }
        
        log('[fixRelativePath] fixedPath (3): ', path);

        return path;
    }

    if (path.charAt(0) !== '.') {
        return path;
    }

    var baseDir = dir;
    if (hasParentDir(file, toDir)) { // Was the source manifest file also moved?
        // If so, calculate relative paths relative to the manifests old location
        baseDir = nodePath.dirname(nodePath.join(fromDir, file.substring(toDir.length)));
        log('[fixRelativePath] *baseDir: ', baseDir);
    }

    absolutePath = nodePath.join(baseDir, path);

    log('[fixRelativePath] absolutePath: ', absolutePath);
    

    if (hasParentDir(absolutePath, fromDir)) {
        // The path was in a directory that was moved...
        relToFromDir = nodePath.relative(fromDir, absolutePath);
        log('[fixRelativePath] relToFromDir: ', relToFromDir);
        newAbsolutePath = nodePath.join(toDir, relToFromDir);
        log('[fixRelativePath] newAbsolutePath: ', newAbsolutePath);

        // log('[fixRelativePath] newAbsolutePath: ', newAbsolutePath);
        // Calculate a path relative to the directory of the manifest
        path = nodePath.relative(dir, newAbsolutePath);
        log('[fixRelativePath] fixedPath ' + originalPath + ' (1): ', path);
    } else if (hasParentDir(file, toDir)) {
        // The manifest was in a directory that was moved so we need to recalculate the relative path
        // based on the new location
        path = nodePath.relative(dir, absolutePath);
        log('[fixRelativePath] fixedPath ' + originalPath + ' (2): ', path);
    }

    log('[fixRelativePath]');

    return path;
}

module.exports = fixRelativePath;