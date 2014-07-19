'use strict';

var esprima = require('esprima');
var escodegen = require('escodegen');

function transform(src, options) {
    var ast = esprima.parse(src, {
        raw: true,
        tokens: true,
        range: true,
        comment: true
    });

    escodegen.attachComments(ast, ast.comments, ast.tokens);

    if (options.requireOnly) {
        ast = require('./require-transformer').transformAST(ast, options);
    } else {
        ast = require('./var-transformer').transformAST(ast, options);
        ast = require('./amd-transformer').transformAST(ast, options);
        ast = require('./old-raptor-transformer').transformAST(ast, options);
        ast = require('./context-async-transformer').transformAST(ast, options);

        if (options.skipTransformRequire !== true) {
            ast = require('./require-transformer').transformAST(ast, options);
        }

        ast = require('./require-raptor-transformer').transformAST(ast, options);
    }

    var codegenOptions = {
        comment: true,
        format: {
            indent: {
                style: '    ',
                adjustMultilineComment: true
            },
            quotes: 'single'
        }
    };

    return escodegen.generate(ast, codegenOptions);
}

exports.transform = transform;
