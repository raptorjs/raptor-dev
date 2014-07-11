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
                node.arguments[0].value === 'ebay-tracking' //&&
                // node.callee.arguments[0].raw === 'module-config'
                ) {

                // console.log('file:', moduleOptions.migratePath + '/module-config');



                delete node.arguments[0].raw;
                // node.arguments[0].value = moduleOptions.migratePath + '/module-config';
                node.arguments[0].value = 'tracking-ebay';
                // delete node.arguments[0].raw = "'module-config-inc'";
                // console.log('----', node);
                // console.log('$:', node.arguments[0]);

            }

        }
    });

    return ast;
}

exports.transformAST = transformAST;
