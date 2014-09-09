`require('raptor-polyfill/string/startsWith');

var fs = require('fs');
var nodePath = require('path');
var versionParser = require('../lib/version-parser');
var raptorPromises = require('raptor-promises');

module.exports = {
    usage: 'Usage: $0 $commandName [dir]',

    options: {
        'no-prompt': {
            description: 'Do not prompt for each upgrade',
            type: 'boolean',
            default: true
        }
    },

    validate: function(args, rapido) {
        args.dir = args._[0];

        if (args.dir) {
            args.dir = nodePath.resolve(process.cwd(), args.dir);
        } else {
            args.dir = process.cwd();
        }

        return args;
    },

    run: function(args, config, rapido) {
        var org = require('../lib/raptorjs-github-org');

        var logger = rapido.util.replayLogger();

        logger.info('GitHub organization: ' + org);

        function spawnGit(args, options) {
            options = options || {};
            options.logger = logger;
            options.cwd = options.cwd;
            return rapido.util.spawnGit(args, options);
        }

        return rapido.prompt({
                properties: {
                    dir: {
                        name: 'dir',
                        description: 'Enter location for ' + org + ' repositories',
                        default: args.dir
                    }
                }
            })
            .then(function(result) {

                var publishModulesPromise = raptorPromises.resolved();

                var dir = nodePath.resolve(result.dir);

                var moduleDirs = fs.readdirSync(dir);



                moduleDirs.forEach(function(moduleName) {

                    if (moduleName.startsWith('raptor-') && moduleName !== 'raptor-samples' && moduleName !== 'raptor-dev') {
                            var moduleDir = nodePath.join(dir, moduleName);
                            var pkgPath = nodePath.join(moduleDir, 'package.json');
                            var pkg = require(pkgPath);
                            var oldVersion = pkg.version;

                            var version = versionParser.parse(oldVersion);
                            if (version.major === 0) {
                                console.log('Found 0.x version: ' + moduleName);
                                version.incMajor();
                                pkg.version = version.toString();
                                fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, '  '), 'utf8');


                                console.log('Updated version for ' + moduleName + ': ' + oldVersion + ' --> ' + pkg.version);

                                publishModulesPromise = publishModulesPromise
                                    .then(function() {
                                        //git fetch origin
                                        var commitMessage = 'Updated version: ' + oldVersion + ' --> ' + pkg.version;
                                        return spawnGit(['commit', '-a', '-m', commitMessage], {cwd: moduleDir});
                                    })
                                    .then(function() {
                                        //git fetch origin
                                        return spawnGit(['push', 'origin', 'master'], {cwd: moduleDir});
                                    })
                                    .then(function() {
                                        return rapido.runCommand('module', 'publish', {
                                            cwd: moduleDir
                                        });
                                    });
                            }
                        }
                    });

                    return raptorPromises.all([publishModulesPromise]).then(function() {
                        if (!args.logger) {
                            // Only log if we created the logger (it was not provided as input)
                            rapido.log();
                            logger.summarize();
                        }

                        logger.success('success', 'Version update completed');
                    });
                });

    }
};
