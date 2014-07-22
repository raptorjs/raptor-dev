/*
 * Copyright 2011 eBay Software Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var createError = require('raptor-util').createError;
var objectMapper = require('raptor-xml/object-mapper');
var nodePath = require('path');
var fs = require('fs');
var STRING = 'string';
var BOOLEAN = 'boolean';
var OBJECT = 'object';


exports.transform = function (filePath, options) {
    var src = fs.readFileSync(filePath, 'utf8');

    options = options || {};
    var importHandler = options.importHandler;


    var dirname = nodePath.dirname(filePath);

    function resolvePath(path) {

        if (!path.endsWith('.js')) {
            path = path + '.js';
        }

        var resolvedPath = nodePath.resolve(dirname, path);
        if (!fs.existsSync(resolvedPath)) {
            var lastSlash = path.lastIndexOf('/');
            if (lastSlash !== -1) {
                resolvedPath = nodePath.join(dirname, '.' + path.substring(lastSlash));
            }
        }


        // Chop off the '.js' extension
        resolvedPath = resolvedPath.slice(0, -3);

        var relPath = nodePath.relative(dirname, resolvedPath);
        if (relPath.charAt(0) !== '.') {
            relPath = './' + relPath;
        }
        return relPath;
    }

    var taglib = {};
    var attributeHandler = {
            _type: OBJECT,
            _begin: function () {
                return {};
            },
            _end: function (attr, parent) {
                if (attr.hasOwnProperty('deprecated')) {
                    // Ignore deprecated attributes
                    return;
                }

                if (attr.hasOwnProperty('uri')) {
                    // Ignore imported attributes... no longer supported
                    return;
                }

                attr.type = attr.type || 'string';

                if (attr.pattern) {
                    attr.name = attr.pattern;
                    attr.pattern = true;
                }
                var attributes = parent.attributes || (parent.attributes = {});




                var attrName = attr.name;
                delete attr.name;

                var attrKeys = Object.keys(attr);

                if (attrKeys.length === 1 && attrKeys[0] === 'type') {
                    attr = attr[attrKeys[0]];
                }

                attributes[attrName] = attr;
            },
            'name': { _type: STRING },
            'uri': { _type: STRING },
            'pattern': {
                _type: STRING
            },
            'target-property': {
                _type: STRING
            },
            'namespace': { _type: STRING },
            'deprecated': { _type: STRING },
            'required': { _type: BOOLEAN },
            'type': { _type: STRING },
            'allow-expressions': {
                _type: BOOLEAN
            },
            'preserve-name': {
                _type: BOOLEAN
            },
            'description': { _type: STRING },
            'remove-dashes': {
                _type: BOOLEAN
            }
        };
    var importVariableHandler = {
            _type: OBJECT,
            _begin: function () {
                return {};
            },
            _end: function (importedVariable, tag) {
                if (importedVariable.name) {
                    if (!importedVariable.targetProperty) {
                        importedVariable.targetProperty = importedVariable.name;
                    }
                    importedVariable.expression = importedVariable.name;
                    delete importedVariable.name;
                }
                if (!importedVariable.targetProperty) {
                    throw createError(new Error('The "target-property" attribute is required for an imported variable'));
                }
                if (!importedVariable.expression) {
                    throw createError(new Error('The "expression" attribute is required for an imported variable'));
                }

                var importVar = tag['import-var'] || (tag['import-var'] = {});
                importVar[importedVariable.targetProperty] = importedVariable.expression;
            },
            'name': { _type: STRING },
            'target-property': {
                _type: STRING,
                _targetProp: 'targetProperty'
            },
            'expression': { _type: STRING }
        };
    var variableHandler = {
            _type: OBJECT,
            _begin: function () {
                return {};
            },
            _end: function (nestedVariable, tag) {
                if (!nestedVariable.name && !nestedVariable['name-from-attribute']) {
                    throw createError(new Error('The "name" or "name-from-attribute" attribute is required for a nested variable'));
                }

                if (!nestedVariable.hasOwnProperty('name-from-attribute')) {
                    nestedVariable = nestedVariable.name;
                }

                if (tag.hasOwnProperty('var')) {
                    tag.vars = [
                        tag.var,
                        nestedVariable
                    ];
                    delete tag.var;
                } else {
                    tag.var = nestedVariable;
                }

            },
            'name': {
                _type: STRING,
                _targetProp: 'name'
            },
            'name-from-attribute': {
                _type: STRING,
                _targetProp: 'name-from-attribute'
            },
            'name-from-attr': {
                _type: STRING,
                _targetProp: 'name-from-attribute'
            }
        };

    function handleNamespace(_taglib, name, ns) {
        if (options.onNamespace) {
            options.onNamespace(ns);
        }

        if (taglib.namespace == null || ns.length < taglib.namespace.length) {
            taglib.namespace = ns;
        }
    }

    var handlers = {
            'raptor-taglib': {
                _type: OBJECT,
                _begin: function () {
                    return taglib;
                },
                'attribute': attributeHandler,
                'tlib-version': {
                    _type: STRING,
                    _targetProp: 'version'
                },
                'uri': {
                    _type: STRING,
                    _set: handleNamespace
                },
                'namespace': {
                    _type: STRING,
                    _set: handleNamespace
                },
                'short-name': {
                    _type: STRING,
                    _set: handleNamespace
                },
                'prefix': {
                    _type: STRING,
                    _set: handleNamespace
                },
                'tag': {
                    _type: OBJECT,
                    _begin: function () {
                        return {};
                    },
                    _end: function (tag) {
                        Object.defineProperty(this, 'tagName', {
                            enumerable: false,
                            value: tag.name
                        });

                        if (tag.name !== '*') {
                            tag.name = (taglib.namespace || options.prefix) + '-' + tag.name;
                        }

                        var tags = taglib.tags || (taglib.tags = {});
                        tags[tag.name] = tag;

                        if (tag.name === '*' && tag.attributes) {
                            // Prefix all of the attributes with the taglib namespace
                            Object.keys(tag.attributes).forEach(function(attrName) {
                                var attr = tag.attributes[attrName];
                                delete tag.attributes[attrName];
                                attrName = (taglib.namespace || options.prefix) + '-' + attrName;

                                tag.attributes[attrName] = attr;
                            });
                        }

                        delete tag.name;
                        delete tag.id;
                    },
                    'name': {
                        _type: STRING,
                        _targetProp: 'name'
                    },
                    'namespace': {
                        _type: STRING,
                        _set: function (tag, name, value, context) {

                        }
                    },
                    'id': { _type: STRING },
                    'preserveSpace': {
                        _type: BOOLEAN,
                        _targetProp: 'preserve-whitespace'
                    },
                    'preserve-space': {
                        _type: BOOLEAN,
                        _targetProp: 'preserve-whitespace'
                    },
                    'preserve-whitespace': {
                        _type: BOOLEAN,
                        _targetProp: 'preserve-whitespace'
                    },
                    'preserveWhitespace': {
                        _type: BOOLEAN,
                        _targetProp: 'preserve-whitespace'
                    },
                    'extends': {
                        _type: STRING,
                        _targetProp: 'extends'
                    },
                    'handler-class': {
                        _type: STRING,
                        _set: function (tag, name, value, context) {
                            tag.renderer = resolvePath(value);
                        }
                    },
                    'renderer': {
                        _type: STRING,
                        _targetProp: 'renderer',
                        _set: function (tag, name, value, context) {
                            tag.renderer = resolvePath(value);
                        }
                    },
                    'template': {
                        _type: STRING,
                        _targetProp: 'template'
                    },
                    'dynamic-attributes': {
                        _type: STRING
                    },
                    'node-class': {
                        _type: STRING,
                        _set: function (tag, name, path) {
                            tag['node-class'] = resolvePath(path);
                        }
                    },
                    '<attribute>': attributeHandler,
                    'nested-variable': variableHandler,
                    'variable': variableHandler,
                    'imported-variable': importVariableHandler,
                    'import-variable': importVariableHandler,
                    'transformer-path': {
                        _type: STRING,
                        _set: function (tag, name, path) {
                            var transformer = {};
                            transformer.path = resolvePath(path);

                            if (tag.hasOwnProperty('transformer')) {
                                tag.transformers = [
                                    tag.transformer,
                                    transformer
                                ];
                                delete tag.transformer;
                            } else {
                                tag.transformer = transformer;
                            }
                        }
                    },
                    'transformer': {
                        _type: OBJECT,
                        _begin: function () {
                            return {};
                        },
                        _end: function (transformer, tag) {
                            if (tag.hasOwnProperty('transformer')) {
                                tag.transformers = [
                                    tag.transformer,
                                    transformer
                                ];
                                delete tag.transformer;
                            } else {
                                tag.transformer = transformer;
                            }
                        },
                        'path': {
                            _type: STRING,
                            _set: function (transformer, name, path) {
                                transformer.path = resolvePath(path);
                            }
                        },
                        'after': {
                            _type: STRING,
                            _targetProp: 'after'
                        },
                        'before': {
                            _type: STRING,
                            _targetProp: 'before'
                        },
                        'name': {
                            _type: STRING,
                            _targetProp: 'name'
                        },
                        '<properties>': {
                            _type: OBJECT,
                            _begin: function (parent) {
                                parent.properties = {};
                                return parent.properties;
                            },
                            '<*>': { _type: STRING }
                        }
                    }
                },
                'text-transformer': {
                    _type: OBJECT,
                    _begin: function () {
                        return {};
                    },
                    _end: function (textTransformer, tag) {

                        if (tag.hasOwnProperty('text-transformer')) {
                            tag['text-transformers'] = [
                                tag['text-transformer'],
                                textTransformer
                            ];
                            delete tag['text-transformer'];
                        } else {
                            tag['text-transformer'] = textTransformer;
                        }
                    },
                    'path': {
                        _type: STRING,
                        _set: function (transformer, name, path) {
                            transformer.path = resolvePath(path);
                        }
                    }
                },
                'import-taglib': {
                    _type: OBJECT,
                    _begin: function () {
                        return {};
                    },
                    _end: function (importedTaglib) {
                        if (importedTaglib.path.charAt(0) === '/') {
                            importedTaglib.path = importedTaglib.path.substring(1);
                        }

                        var path = nodePath.resolve(dirname, importedTaglib.path);
                        if (importHandler) {
                            importHandler(path);
                        }
                    },
                    'path': { _type: STRING }
                }
            }
        };
    objectMapper.read(src, filePath, handlers);
    // taglib.forEachTag(function (tag) {
    //     handleTagExtends(tag);
    // });

    delete taglib.namespace;
    delete taglib.version;

    return taglib;
};
