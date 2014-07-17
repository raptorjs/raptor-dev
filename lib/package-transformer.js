var nodePath = require('path');
var fs = require('fs');
require('raptor-polyfill');
var isCommonJSModule = require('./isCommonJSModule');

function transformDependency(d, file, rootDir) {

    // console.log();
    // console.log('dependency: ', d);
    var dir = file ? nodePath.dirname(file) : null;

    function normalizePackagePath(path) {
        path = path.replace(/package\.json$/g, 'optimizer.json');

        if (!path.endsWith('.json') && !path.startsWith('.')) {
            path = path.replace(/[.]/g, '/');
        }

        // console.log('normalizePackagePath: ', path);

        if (!path.endsWith('.json')) {
            path += '/optimizer.json';
        }
        // console.log('normalizePackagePath: ', path, '\n');

        if (rootDir) {
            var absolutePath = nodePath.join(rootDir, path);
            if (fs.existsSync(absolutePath)) {
                path = nodePath.relative(dir, absolutePath);
            } else if (path.endsWith('optimizer.json')) {
                var originalPath = path.slice(0, 0-'optimizer.json'.length) + 'package.json';
                absolutePath = nodePath.join(rootDir, originalPath);

                if (fs.existsSync(absolutePath)) {
                    path = nodePath.relative(dir, absolutePath).replace(/package\.json$/, 'optimizer.json');
                }
            }
        }

        return path;
    }

    function normalizeDependency() {
        var basename;
        var ext;

        if (typeof d === 'string') {

            if (d.endsWith('package.json') || d.endsWith('optimizer.json')) {
                d = {
                    type: 'module',
                    path: d
                };
            } else {
                basename = nodePath.basename(d);
                ext = nodePath.extname(basename);
                if (ext) {
                    d = {
                        type: ext.substring(1),
                        path: d
                    };
                } else {
                    d = {
                        type: 'module',
                        path: d
                    };
                }
            }
            
        } else {
            if (d.type) {
                if (d.type === 'package' || d.type === 'module') {
                    d.type = 'module';
                    d.path = d.path || d.name;
                    delete d.name;
                }
            } else {
                if (d.package || d.module) {
                    d.type = 'module';
                    d.path = d.package || d.module || d.name;
                    delete d.package;
                    delete d.module;
                    delete d.name;
                } else if (d.path) {
                    if (d.path.endsWith('package.json')) {
                        d.type = 'module';
                    } else {
                        basename = nodePath.basename(d.path);
                        ext = nodePath.extname(basename);

                        if (ext) {
                            d.type = ext.substring(1);
                        } else {
                            d.type = 'module';
                        }    
                    }
                    
                }
            }
        }

        if (d.type === 'js' && d.path && dir) {

            // This JS file may be a CommonJS module or a standard JavaScript file.
            // If it is a CommonJS module then we need to change its type to "require"
            var src;
            var absolutePath = nodePath.join(dir, d.path);

            try {
                src = fs.readFileSync(absolutePath);
            } catch(e) {}

            if (src && isCommonJSModule(src)) {
                var relativePath = nodePath.relative(dir, absolutePath.slice(0, -3));
                if (relativePath.charAt(0) !== '.') {
                    relativePath = './' + relativePath;
                }

                d.type = 'require';
                d.path = relativePath; // Remove the file extension    
            }
            
        }

        if (d.type === 'module' && d.path) {
            if (d.path === 'jquery') {
                d.type = 'require';
            } else if (d.path === 'raptor/widgets') {
                d.type = 'require';
                d.path = 'raptor-widgets';
            } else {
                d.path = normalizePackagePath(d.path);
            }
        }

        if (d.extension) {
            d['if-extension'] = d.extension;
            delete d.extension;
        }

        delete d.async;

        return d;
    }

    function simplifyDependency(d) {
        var keyCount = Object.keys(d).length;

        if (d.type === 'module') {
            if (keyCount === 2 && d.path && (d.path.endsWith('/optimizer.json') || d.path === 'optimizer.json')) {
                d = d.path;
            } else  {
                delete d.type;
                d.package = d.path;
                delete d.path;
            }
        } else if (d.type === 'require') {
            if (keyCount === 2 && d.path) {
                d = 'require: ' + d.path;
            }
        } else {

            if (d.path) {
                var basename = nodePath.basename(d.path);
                var ext = nodePath.extname(basename);
                if (ext && ext.substring(1) === d.type) {
                    // Path extension matches the type... no need to include type...
                    if (keyCount === 2 && d.path) {
                        // only type and path...
                        d = d.path;
                    } else {
                        // type and path and some other stuff...
                        delete d.type;
                    } 
                }    
            }
        }

        return d;
    }

    d = normalizeDependency(d);
    // console.log('normalized dependency: ', d);

    if (d.type === 'module' &&
        d.path && (d.path === 'raptor' || d.path.startsWith('raptor/')) &&
        !d.path.startsWith('raptor/client')) {

        // Remove raptor dependencies
        return null;
    }

    d = simplifyDependency(d);

    // console.log('simplified dependency: ', d);

    return d;
}

function transform(pkg, file, rootDir) {
    var optimizerManifest = pkg.raptor || pkg['raptor-optimizer'] || pkg;
    var dependencies = optimizerManifest.dependencies ||
        optimizerManifest['browser-dependencies'] ||
        optimizerManifest.includes;
    var extensions = optimizerManifest.extensions;

    var outputDependencies = [];
    if (dependencies) {
        dependencies.forEach(function(d) {
            d = transformDependency(d, file, rootDir);
            if (d) {
                outputDependencies.push(d);
            }
        });
    }

    if (extensions) {
        if (!Array.isArray(extensions)) {
            extensions = Object.keys(extensions).map(function(key) {
                var ext = extensions[key];

                return {
                    name: key,
                    dependencies: ext.dependencies || ext.includes
                };
            });
        }

        extensions.forEach(function(ext) {
            var condition = ext.condition;
            var name = ext.name;
            var dependencies = ext.dependencies || ext.includes;

            if (dependencies) {
                dependencies.forEach(function(d) {
                    d = transformDependency(d, file, rootDir);
                    if (!d) {
                        return;
                    }

                    if (typeof d === 'string') {
                        d = { path: d};
                    }

                    if (condition) {
                        d['if'] = condition;
                    }
                    else if (name) {
                        d['if-extension'] = name;
                    }

                    outputDependencies.push(d);
                });
            }
        });
    }

    var transformed = {};
    transformed.dependencies = outputDependencies;
    return transformed;
    
}

exports.transform = transform;
exports.transformDependency = transformDependency;