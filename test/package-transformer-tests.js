var chai = require('chai');
chai.Assertion.includeStack = true;
require('chai').should();
var expect = require('chai').expect;
var nodePath = require('path');

var packageTransformer = require('../lib/package-transformer');

describe('raptor-dev/package-transformer' , function() {

    beforeEach(function(done) {
        

        done();
    });

    it('should transform ultra-legacy package.json', function() {
        var pkg = packageTransformer.transform({
            "type": "module",
            "name":"raptor.client",
            "version":"1.0",
            "description":"Raptor Client",
            "homepage":"http://wiki2.arch.ebay.com/display/RAPTOR/Home",
            "authors":[
                {"name":"Rich Heisterberg","email":"rheisterberg@ebay.com"}
            ],

            "includes": [
                { "path": "test.js" }
            ],

            "extensions":{
                "raptor.client.features": {
                    "includes": [
                       {"type":"module", "name":"raptor.client.features"}
                    ]
                }
            }

        });

        // console.log('PKG: ', pkg);

        expect(pkg).to.deep.equal({
            "dependencies": [
                "test.js",
                {"path": "raptor/client/features/optimizer.json", "if-extension": "raptor.client.features"}
            ]
        });
    });

    it('should handle extenions as an array', function() {
        var pkg = packageTransformer.transform({
            "raptor": {
                "dependencies": [
                    "test.js"
                ],
                "extensions": [
                    {
                        "name": "raptor.client.features",
                        "includes": [
                            {"type":"module", "name":"raptor.client.features"}
                        ]
                    }
                ]
            }

        });

        expect(pkg).to.deep.equal({
            "dependencies": [
                "test.js",
                {"path": "raptor/client/features/optimizer.json", "if-extension": "raptor.client.features"}
            ]
        });
    });

    it('should transform a random package correctly', function() {
        var pkg = packageTransformer.transform({
          "type": "module",
          "version": "0.0.1",
          "name": "foo",
          "description": "Description for foo",
          "homepage": "",
          "authors": [
            {
              "name": "John Doe",
              "email": "thirschfeld@ebay.com"
            }
          ],
          "raptor": {
            "dependencies": [
              "foo.less",
              {"module": "foo/bar"}     
            ], 
            "extensions":[
              {"name": "touch",
               "condition": "!extensions.contains('no-touch')",
               "dependencies":[
                {"path":"foo-touch.less"},
                {"module": "foo/plugins/foo-plugin"}
               ]
              },
              {"name": "no-touch",
               "condition": "extensions.contains('no-touch')",
               "dependencies":[
                {"path":"foo-no-touch.less"}
               ]
              }
            ]
          }
        });
        expect(pkg).to.deep.equal({
            "dependencies": [
                "foo.less",
                "foo/bar/optimizer.json",
                {
                    "path": "foo-touch.less",
                    "if": "!extensions.contains('no-touch')"
                },
                {
                    "path": "foo/plugins/foo-plugin/optimizer.json",
                    "if": "!extensions.contains('no-touch')"
                },
                {
                    "path": "foo-no-touch.less",
                    "if": "extensions.contains('no-touch')"
                }
            ]
        });
    });

    it('should transform a package with JavaScript/CommonJS modules correctly', function() {

        var file = nodePath.join(__dirname, 'transform-project/ui-components/buttons/SimpleButton/package.json');
        var pkg = require(file);

        var transformedPkg = packageTransformer.transform(
            pkg,
            file);

        expect(transformedPkg).to.deep.equal({
            "dependencies": [
                "require: raptor-widgets",
                "require: ./SimpleButtonRenderer",
                "SimpleButton.rhtml",
                "require: ./SimpleButtonWidget",
                "SimpleButton.css"
            ]
        });
    });

    xit('should transform a package correctly that use module paths relative to project root', function() {

        var file = nodePath.join(__dirname, 'transform-project/package-transformer/hello/package.json');
        var pkg = require(file);
        var rootDir = nodePath.join(__dirname, 'transform-project');

        var transformedPkg = packageTransformer.transform(
            pkg,
            file,
            rootDir);

        expect(transformedPkg).to.deep.equal({
            "dependencies": [
                "../../ui-components/buttons/SimpleButton/optimizer.json"
            ]
        });
    });

    xit('should transform a package correctly that use module paths relative to project root', function() {

        
        var pkg = {
          "type": "module",
          "version": "0.0.2",
          "name": "collectionviewer",
          "description": "Collection viewer module with lazy loading",
          "homepage": "",
          "authors": [
            {
              "name": "Suresh Raj Kumar Ayyasamy",
              "email": "sayyasamy@ebay.com"
            }
          ],
          "raptor": {
            "dependencies": [
              "collectionviewerlarge.less",
              "iefix.css",
              "widget.js",
              {"module": "fluid/plugins/imagefit"}
            ],
            "extensions": [
              {
                "name": "small",
                "condition": "extensions.contains('CV-small')",
                "dependencies": [
                  "collectionviewersmall.less"
                ]
              },
              {
                "name": "default",
                "condition": "!extensions.contains('CV-small') && !extensions.contains('CV-large')",
                "dependencies": [
                  "collectionviewerresponsive.less"
                ]
              },
              {
                "name": "lazyloadimages",
                "condition": "extensions.contains('lazyload')",
                "dependencies": [
                  {"module": "fluid/plugins/lazyloadimages"}
                ]
              }
             ]
          }
        };

        var rootDir = null;
        var file = null;
        
        var transformedPkg = packageTransformer.transform(
            pkg,
            file,
            rootDir);

        expect(transformedPkg).to.deep.equal({
            "dependencies": [
                "../../ui-components/buttons/SimpleButton/optimizer.json"
            ]
        });
    });

    


});

