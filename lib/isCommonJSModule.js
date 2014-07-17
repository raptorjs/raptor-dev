var esprima = require('esprima');
var estraverse = require('estraverse');

function isCommonJSModule(src, file) {
    var ast;
    try {
        ast = esprima.parse(src, {});
    } catch(e) {
        console.log('WARNING: Unable to parse JavaScript file: ' + file, (e.stack || e));
        return false;
    }
    var isCommonJSModuleFlag = false;

    estraverse.traverse(ast, {
        enter: function (node, parent) {
            if (isCommonJSModuleFlag) {
                this.break();
                return;
            }
            if (node.type == 'CallExpression' &&
                node.callee.type === 'Identifier' &&
                (node.callee.name === 'define' || node.callee.name === 'require')) {
                isCommonJSModuleFlag = true;
                this.break();
                return;
            }

            if (node.type == 'AssignmentExpression' &&
                node.left.type === 'MemberExpression') {

                // Look for any of the following:
                // exports.test = ...
                // module.exports = ...
                // module.exports.test = ...
                

                // exports.test = ...
                if (node.left.object.type === 'Identifier' && node.left.object.name === 'exports') {
                    isCommonJSModuleFlag = true;
                    this.break();
                    return;       
                }

                // module.exports = ...
                if (node.left.object.type === 'Identifier' &&
                    node.left.object.name === 'module' &&
                    node.left.property.type === 'Identifier' &&
                    node.left.property.name === 'exports') {
                    isCommonJSModuleFlag = true;
                    this.break();
                    return;       
                }

                // module.exports.test = ...
                if (node.left.object.type === 'MemberExpression' &&
                    node.left.object.object.type === 'Identifier' &&
                    node.left.object.object.name === 'module' &&
                    node.left.object.property.type === 'Identifier' &&
                    node.left.object.property.name === 'exports') {
                    isCommonJSModuleFlag = true;
                    this.break();
                    return;       
                }
            }
        },
        leave: function (node, parent) {
            if (isCommonJSModuleFlag) {
                this.break();
                return;
            }
        }
    });

    return isCommonJSModuleFlag;
}

module.exports = isCommonJSModule;