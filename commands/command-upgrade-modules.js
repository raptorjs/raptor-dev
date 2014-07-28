'use strict';

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
        var shouldPrompt = (args['no-prompt'] === false);

        require('../lib/upgrade').upgradePackage(process.cwd(), shouldPrompt, rapido.log, function(err) {
            if (err) {
                rapido.log.error('Error upgrading package.json', err);
                return;
            }

            rapido.log.success('Done.');
        });
    }
};
