'use strict';

var path = require('path');
var async = require('raptor-async');
var fs = require('fs');

function runNpmCommand(npmArgs, dir, logger, callback) {
    var spawn = require('child_process').spawn;

    var npm = spawn('npm', npmArgs, {
        cwd: dir
    });

    //npm.stdout.setEncoding('utf8');
    //npm.stderr.setEncoding('utf8');

    // pipe stdout to our own console
    npm.stdout.on('data', function (data) {
        process.stdout.write(data);
    });

    // pipe stderr to our own console
    npm.stderr.on('data', function (data) {
        process.stderr.write(data);
    });

    // catch errors
    npm.on('error', function(err) {
        callback(err);
    });

    npm.on('close', function (code) {
        callback();
    });
}

/**
 * Run "npm link" in given directory
 */
function createNpmLinkJob(moduleNode, logger) {
    return function(callback) {
        logger.info('Running "npm link" in directory ' + moduleNode.dir);
        runNpmCommand(['link'], moduleNode.dir, logger, callback);
    };
}

/**
 * Run "npm link <moduleNode.name" in given directory
 */
function createNpmLinkModuleJob(moduleName, dir, logger) {
    return function(callback) {
        logger.info('Running "npm link ' + moduleName + '" in directory ' + dir);
        runNpmCommand(['link', moduleName], dir, logger, callback);
    };
}


/*
EXAMPLE CYCLE:
raptor-logging
    raptor-util
        raptor-xml
            raptor-logging
raptor-util

CYCLE DETECTION:
When walking graph keep track of nodes that were visited in stack.
Before visiting node make sure current node does not appear in stack. If not found in
stack then push current node to stack. Visit the node and when done pop node off stack.

LEAF NODES:
A leaf node is a node that does not have any dependencies. Leaf nodes should have
"npm link" command run earliest.
*/

module.exports = {

    createNpmLinkModuleJob: createNpmLinkModuleJob,

    install: function(moduleNames, dir, logger, callback) {
        runNpmCommand(['install'].concat(moduleNames), dir, logger, callback);
    },

    /**
     * This function use to "npm link" modules together for local development of
     * all of the raptor modules.
     */
    linkModules: function(repos, reposDir, logger, callback) {
        var i;

        // find the directories for all of the modules
        

        var repoDirs = fs.readdirSync(reposDir);

        for (i = 0; i < repoDirs.length; i++) {
            repoDirs[i] = path.join(reposDir, repoDirs[i]);
        }

        // var repoDirs = [];
        // for (i = 0; i < repos.length; i++) {
        //     var repoDir = path.join(reposDir, repos[i].name);
        //     repoDirs.push(repoDir);
        // }

        // get the dependency graph for the modules in the given directories
        var moduleNodes = require('./dependencies').dependencyGraph(repoDirs);

        // The work will be determined and then it will be executed in series
        var work = [];

        // As we visit nodes in the graph, we keep track of modules that we have
        // seen by name in the current path so that we can detect cycles.
        var seen = {};

        // As we visit a the nodes in the graph we keep a stack
        // that describes the path from a top-level node to a dependency,
        // and we use this for informational purposes.
        var stack = [];

        // If we encounter an error we'll continue trying to link but we
        // keep track of all errors with this array.
        var cycles = [];

        var npmLinkOrder = [];

        var linkModulesHelper = function(moduleNode) {
            if (moduleNode.npmLinked) {
                // We have already visited this node and all of its dependencies
                return;
            }

            var d;
            var dependency;
            var moduleName = moduleNode.name;

            if (seen[moduleName]) {
                cycles.push(stack.join(' --> '));
                return;
            }

            // update current path from top-level module to descendant dependency
            stack.push(moduleName);
            seen[moduleName] = moduleName;
          
            // make sure all the dependencies (and their dependencies) are linked
            // before we "npm link" the current module
            for (d = 0; d < moduleNode.dependencies.length; d++) {
                dependency = moduleNode.dependencies[d];
                linkModulesHelper(dependency);

                work.push(createNpmLinkModuleJob(dependency.name, moduleNode.dir, logger));
            }

            // make sure all the dev dependencies (and their dependencies) are linked
            // before we "npm link" the current module
            for (d = 0; d < moduleNode.devDependencies.length; d++) {
                dependency = moduleNode.devDependencies[d];
                linkModulesHelper(dependency);

                work.push(createNpmLinkModuleJob(dependency.name, moduleNode.dir, logger));
            }

            npmLinkOrder.push(moduleNode.name);

            work.push(createNpmLinkJob(moduleNode, logger));
            moduleNode.npmLinked = true;

            stack.pop();
            delete seen[moduleName];
        };

        // go into each raptor dependency and run "npm link" (but start with the leaf nodes in the graph)
        //linkModulesHelper(moduleNodes);
        for (i = 0; i < moduleNodes.length; i++) {
            var moduleNode = moduleNodes[i];
            linkModulesHelper(moduleNode);
        }

        if (cycles.length > 0) {
            logger.warn('Cycles detected:\n' + cycles.join('\n'));
        }

        logger.info('Modules will be linked in the following order:\n' + npmLinkOrder.join('\n'));

        async.series(work, callback);
    }
};