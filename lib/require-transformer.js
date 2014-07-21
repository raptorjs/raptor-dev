'use strict';

require('raptor-polyfill');
var estraverse = require('estraverse');
var nodePath = require('path');
var fs = require('fs');

function tryPath(path, ext) {
    path = path + ext;
    if (fs.existsSync(path)) {
        return path.slice(0, 0-ext.length);
    }
}

function resolve(target, searchPath, from, rootDir, relativeToRoot) {
    if (rootDir) {
        searchPath = [rootDir];
    }

    for (var i=0; i<searchPath.length; i++) {
        var path = nodePath.join(searchPath[i], target);
        if (path.endsWith('.js')) {
            path = path.slice(0, -3);
        }

        var filePath = tryPath(path, '.js') || tryPath(path, '.coffee');
        if (filePath) {
            var relPath;

            if (relativeToRoot && rootDir) {
                relPath = nodePath.relative(rootDir, filePath);
            } else {
                relPath = nodePath.relative(from, filePath);
                if (!relPath.startsWith('.')) {
                    relPath = './' + relPath;
                }
            }

            if (relPath.endsWith('.js')) {
                relPath = relPath.slice(0, -3);
            }

            return relPath;
        }
    }
}

function transformAST(ast, options) {
    var searchPath = options.searchPath;
    var from = options.from;
    var rootDir = options.rootDir;
    var relativeToRoot = options.relativeToRoot;

    ast = estraverse.replace(ast, {
        enter: function(node, parent) {
        },

        leave: function(node, parent) {
            if (node.type === 'CallExpression' &&
                node.callee.type === 'Identifier' &&
                node.callee.name === 'require' &&
                node.arguments.length === 1 &&
                node.arguments[0].type === 'Literal' &&
                typeof node.arguments[0].value === 'string') {
                
                var target = node.arguments[0].value;
                var resolved = null;

                if (target.charAt(0) !== '.') {
                    if (searchPath && from) {
                        resolved = resolve(target, searchPath, from, rootDir, relativeToRoot);
                    }

                    if (target.endsWith('.js')) {
                        resolved = target.slice(0, -3);
                    }
                    
                } else {
                    if (target.endsWith('.js')) {
                        resolved = target.slice(0, -3);
                    }
                }

                if (resolved) {
                    node.arguments[0].value = resolved;
                }
            }

        }
    });

    return ast;
}

exports.transformAST = transformAST;