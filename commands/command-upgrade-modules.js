'use strict';

var nodePath = require('path');

module.exports = {
    usage: 'Upgrades all of the raptorjs modules referenced in the package.json of current directory.\nUsage: $0 $commandName',


    options: {
        'no-prompt': {
            description: 'Do not prompt for each upgrade',
            type: 'boolean',
            default: false
        }
    },

    validate: function(args, rapido) {
        args.modules = args._;
        return args;
    },

    run: function(args, config, rapido) {
        require('../lib/upgrade').upgradePackageLatest(nodePath.join(process.cwd(), 'package.json'));
    }
};
