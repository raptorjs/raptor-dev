var startTagRegExp = /(<\/?)((?:[A-Za-z0-9_-]+:)?[A-Za-z0-9_-]+)([^>]*)\/?>/g;
var nsAttrRegExp = /(\s+[A-Za-z0-9_-]+:[A-Za-z0-9_-]+)(="[^"]*")/g;

module.exports = function(src) {
    startTagRegExp.lastIndex = 0;

    var replacements = [];

    while(true) {
        var matches = startTagRegExp.exec(src);
        
        if (!matches) {
            break;
        }

        if (matches[2].indexOf(':') !== -1) {
            // A namespace was found for the tag
            
            replacements.push({
                start: matches.index + matches[1].length,
                len: matches[2].length,
                replacement: matches[2].replace(/[:]/, '-')
            });
        }

        if (matches[3]) { // If attributes
            nsAttrRegExp.lastIndex = 0;
            while (true) {
                var nsAttrMatches = nsAttrRegExp.exec(matches[3]);
                if (!nsAttrMatches) {
                    break;
                }

                if (nsAttrMatches[1].trim().startsWith('xmlns:')) {
                    if (nsAttrMatches.indexOf('www.w3.org') === -1) {
                        replacements.push({
                            start: matches.index + nsAttrMatches.index + matches[1].length + matches[2].length,
                            len: nsAttrMatches[0].length,
                            replacement: ''
                        });     
                    }
                } else {
                    replacements.push({
                        start: matches.index + nsAttrMatches.index + matches[1].length + matches[2].length,
                        len: nsAttrMatches[1].length,
                        replacement: nsAttrMatches[1].replace(/[:]/, '-')
                    });    
                }
            }
        }


    }

    var transformed = src;

    for (var i = replacements.length - 1; i>=0; i--) {
        var r = replacements[i];
        transformed = transformed.substring(0, r.start) + r.replacement + transformed.substring(r.start + r.len);
    }

    return transformed;
};