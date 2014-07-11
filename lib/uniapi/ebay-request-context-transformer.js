'use strict';

require('raptor-polyfill');
var estraverse = require('estraverse');
var nodePath = require('path');
var fs = require('fs');



function transformAST(ast, options, moduleOptions) {

    ast = estraverse.replace(ast, {
        enter: function(node, parent) {
        },

        leave: function(node, parent) {
            if (node.type === 'CallExpression' &&
                node.callee.type === 'Identifier' &&
                node.callee.name === 'require' &&
                node.arguments &&
                node.arguments[0] &&
                node.arguments[0].type === 'Literal' &&
                node.arguments[0].value === 'ebay-request-context'
                ) {

                node.type = 'ObjectExpression';
                node.properties = [];
                delete node.callee;
                delete node.arguments;

                // node = {
                //         "type": "ObjectExpression",
                //         "properties": []
                //     };

                console.log('---', node);

            }

        }
    });

    return ast;
}

exports.transformAST = transformAST;
