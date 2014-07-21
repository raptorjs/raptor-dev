var chai = require('chai');
chai.Assertion.includeStack = true;
require('chai').should();
var fs = require('fs');

// var expect = require('chai').expect;
var nodePath = require('path');

function readFile(path) {
    return fs.readFileSync(nodePath.join(__dirname, path), {encoding: 'utf8'});
}

function writeFile(path, str) {
    return fs.writeFileSync(nodePath.join(__dirname, path), str, {encoding: 'utf8'});
}

function testTransform(inputPath) {
    var fullInputPath = 'transform-project/' + inputPath + '.js';
    var fullActualPath = 'transform-project/' + inputPath + '.actual.js';
    var fullExpectedPath = 'transform-project/' + inputPath + '.expected.js';
    var input = readFile(fullInputPath);
    var expectedOutput = readFile(fullExpectedPath);
    var transformed = require('../lib/js-transformer').transform(input, {
        from: nodePath.dirname(nodePath.join(__dirname, fullInputPath)),
        searchPath: [nodePath.join(__dirname, 'transform-project')],
        rootDir: nodePath.join(__dirname, 'transform-project')
    });

    writeFile(fullActualPath, transformed);

    if (transformed !== expectedOutput) {
        throw new Error('Unexpected output for "' + fullInputPath + '":\nEXPECTED (' + fullExpectedPath + '):\n---------\n' + expectedOutput +
            '\n---------\nACTUAL (' + fullActualPath + '):\n---------\n' + transformed + '\n---------');
    }
    // expect(transformed).to.equal(expectedOutput);
}

describe('raptor-dev/js-transformer' , function() {

    beforeEach(function(done) {
        done();
    });

    it('should transform define', function() {
        testTransform('simple-define');
    });

    it('should transform define.Class that returns a constructor function', function() {
        testTransform('define-class');
    });

    it('should transform define.Class with inheritance', function() {
        testTransform('some/namespace/Dog');
        testTransform('some/namespace/Animal');
    });

    it('should transform define.Class that returns an object', function() {
        testTransform('ui-components/buttons/SimpleButton/SimpleButtonWidget');
    });

    it('should transform define for UI component renderer', function() {
        testTransform('ui-components/buttons/SimpleButton/SimpleButtonRenderer');
    });

    it('should transform anonymous define.Class with assignment', function() {
        testTransform('define-class-assign');
        testTransform('define-class-assign2');
        testTransform('define-class-assign3');
    });

    it('should transform module.logger()', function() {
        testTransform('module-logger');
    });

    it('should transform define.extend', function() {
        testTransform('raptor/templating/index_async');
    });

    it('should transform references to old raptor module', function() {
        testTransform('old-raptor');
    });

    it('should transform define.extend without target argument', function() {
        testTransform('define-extend');
        testTransform('define-extend2');
    });

    it('should transform define.extend with target argument', function() {
        testTransform('define-extend-target');
    });

    it('should transform define with object for factory function', function() {
        testTransform('define-object');
    });

    it('should transform references to modules that use a path relative to the project root', function() {
        testTransform('require-path-relative-to-project-root');
    });

});

