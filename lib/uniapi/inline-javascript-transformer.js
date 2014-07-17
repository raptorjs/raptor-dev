'use strict';

var esprima = require('esprima');
var escodegen = require('escodegen');
var eslevels = require('eslevels');
var escope = require('escope');
var esrefactor = require('esrefactor');
var _ = require('underscore');

function varTransform(src, options) {
    var ast = esprima.parse(src, {
        loc: true,
        raw: true,
        tokens: true,
        range: true,
        comment: true,
        tolerant: true
    });

    escodegen.attachComments(ast, ast.comments, ast.tokens);
    ast = require('../var-transformer').transformAST(ast, options);

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

function transform(src, options, moduleOptions) {

    var allVariables = src.match(/\${(.+?)}/g);
    allVariables = _.uniq(allVariables);
    allVariables = _.map(allVariables, function(cfgVar) {
        return cfgVar.split('.')[0];
    });
    allVariables = _.uniq(allVariables);
    // console.log(allVariables);
    allVariables = _.map(allVariables, function(cfgVar) {
        return cfgVar.substring(2,cfgVar.length-1);;
    });
    // console.log(allVariables);

    var newVariables = _.map(allVariables, function(cfgVar) {

        return ' var ' + cfgVar + ' = widgetConfig.' + cfgVar + '; ';
    });
    var newVariablesStr = _.reduce(newVariables, function(memo, ele) {
        return  memo + ele;
    }, '');
    // console.log(newVariablesStr);

    src = src.replace(/<!--([\s\S]*?)-->/gm, '  /**  $1  **/');

    src = src.replace(/'([^']+?)\${(.+?)}(.+?)'/g,"'$1'\+widgetConfig.$2\+'$3'");
    src = src.replace(/"\${(.+?)}"/g,'widgetConfig.$1');
    src = src.replace(/'\${(.+?)}'/g,'widgetConfig.$1');
    src = src.replace(/\${(.+?)}/g,'widgetConfig.$1');

    src = varTransform(src, options);


    var ast = esprima.parse(src, {
        loc: true,
        raw: true,
        tokens: true,
        range: true,
        comment: true,
        tolerant: true
    });

    var globalVariables = [];
    var scopes = escope.analyze(ast).scopes;
    scopes.forEach(function (scope) {
        scope.variables.forEach(function(variable) {
            if(variable.scope.type === 'global' && variable.defs[0].type.toLowerCase() === 'variable') {
                var pos = variable.identifiers && variable.identifiers[0] && variable.identifiers[0].range[0];
                // console.log('va:', variable.identifiers[0].range[0]);
                // console.log(variable.name);
                if(pos !== undefined && pos !== null) {
                    globalVariables.push(variable.name);
                }
                // globalVariables.push(pos);

            }

            // variable.defs.forEach(function(def) {
            //     console.log(def.type);
            //     if(def.type.toLowerCase() === 'variable') {
            //         console.log(variable);
            //     }
            // });

        });
    });

    var varLen = globalVariables.length;

    for(var i=0;i< varLen; i++) {
        ast = esprima.parse(src, {
            loc: true,
            raw: true,
            tokens: true,
            range: true,
            comment: true,
            tolerant: true
        });

        scopes = escope.analyze(ast).scopes;
        scopes.forEach(function (scope) {
            scope.variables.forEach(function(variable) {
                if(variable.scope.type === 'global' && variable.defs[0].type.toLowerCase() === 'variable') {
                    var pos = variable.identifiers[0].range[0];

                    var esContext = new esrefactor.Context(src);
                    var id = esContext.identify(pos);
                    if(id) {
                        // console.log('id:', id);
                        src = esContext.rename(id, 'window.' + variable.name);
                        // console.log(newCode);
                        src = src.replace(/var window./g,'window.');
                    }
                }


            });
        });


    }


    src = src.replace(/widgetConfig./g,'');

    src = 'function Widget(widgetConfig) { ' + newVariablesStr + src;
    src = src + ' }  Widget.prototype = {};  module.exports = Widget;'



    ast = esprima.parse(src, {
        loc: true,
        raw: true,
        tokens: true,
        range: true,
        comment: true,
        tolerant: true
    });


    escodegen.attachComments(ast, ast.comments, ast.tokens);

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

    src =  escodegen.generate(ast, codegenOptions);

    return src;
}

exports.transform = transform;
