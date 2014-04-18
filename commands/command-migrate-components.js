var walk = require('../lib/walk');

module.exports = {
    usage: 'Usage: $0 $commandName <message>',

    options: {
        'upper-case': {
            describe: 'Convert message to upper case'
        }
    },

    validate: function(args, rapido) {
        var message = args._[0];
        if (!message) {
            throw 'message is required';
        }
        
        return {
            message: message,
            upperCase: args['upper-case'] === true
        };
    },

    run: function(args, config, rapido) {
        var message = args.message;

        if (args.upperCase) {
            message = message.toUpperCase();
        }

        rapido.log.success('Command says: ' + message);
    }
}
