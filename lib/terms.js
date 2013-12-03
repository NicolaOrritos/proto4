

/* Source of the Unicode codes:
 * http://en.wikipedia.org/wiki/Typographic_ligature#Ligatures_in_Unicode_.28Latin-derived_alphabets.29 */
function expandLigatures(term)
{
    if (term)
    {
        term = term.replace(/[\ufb00]/, "ff");
        term = term.replace(/[\ufb01]/, "fi");
        term = term.replace(/[\ufb02]/, "fl");
        term = term.replace(/[\ufb03]/, "ffi");
        term = term.replace(/[\ufb04]/, "ffl");
        term = term.replace(/[\ufb05]/, "ft");
        term = term.replace(/[\ufb06]/, "st");
        
        term = term.replace(/[\ua728\ua729]/, "tz");
        
        // [todo] - Add more ligatures to 'expandLigatures()'
    }
    
    return term;
}


var terms = function()
{
    var namespaceRef = this;
    
    this.Term = function(text, score)
    {
        var _text  = typeof(text)  !== "undefined" ? text : "";
        var _score = typeof(score) !== "undefined" ? score : 0;
        var _polished = false;
        
        this.getText = function()
        {
            return _text;
        };
        
        this.getScore = function()
        {
            return _score;
        }
        
        this.setScore = function(score)
        {
            this._score = score;
        };
        
        // May return more terms resulting from this one
        this.polish = function()
        {
            var result = new Array();
            
            if (_text)
            {
                var moreTerms = undefined;
                
                // console.log("Term before chores:    '%s'", _text);
                
                // Prevent URLs to be split around '/':
                if (   _text.indexOf("http:") == -1
                    && _text.indexOf("ftp:")  == -1)
                {
                    moreTerms = _text.split(/\//);
                }
                
                if (   moreTerms
                    && moreTerms.length > 1)
                {
                    // console.log("Found composited term '%s'. Split to '%s'.", term, moreTerms);
                    
                    for (var a=0; a<moreTerms.length; a++)
                    {
                        var newTerm = new namespaceRef.Term(moreTerms[a]);
                        
                        newTerm.polish();
                        
                        result[a] = newTerm;
                    }
                }
                else
                {
                    _text = _text.replace(/[,#\?!$%\^&\*;:{}=_`~()“”‘’‹›«»]/, "");

                    // console.log("Term after chores #1:  '%s'", _text);
                    

                    _text = _text.trim();

                    // console.log("Term after chores #2:  '%s'", _text);
                    

                    _text = /[a-zA-Z]/.test(_text) ? _text : "";

                    // console.log("Term after chores #3:  '%s'", _text);
                    

                    _text = _text.toLowerCase();

                    // console.log("Term after chores #4:  '%s'", _text);
                    
                    
                    _text = expandLigatures(_text);
                    
                    // console.log("Term after chores #5:  '%s'", _text);
                    
                    
                    // Polish URLs
                    _text = _text.replace("http://", "");
                    _text = _text.replace("ftp://", "");
                    
                    // console.log("Term after chores #6:  '%s'", _text);
                    
                    
                    if (_text.length > 0)
                    {
                        if (   _text[_text.length - 1] == '-'
                            || _text[_text.length - 1] == '—'
                            || _text[_text.length - 1] == '_'
                            || _text[_text.length - 1] == '.')
                        {
                            _text = _text.substring(0, _text.length - 1);
                            
                            // console.log("Term after chores #7:  '%s'", _text);
                        }
                        
                        if (   _text[0] == '-'
                            || _text[0] == '—'
                            || _text[0] == '_'
                            || _text[0] == '.')
                        {
                            _text = _text.substring(1, _text.length - 1);
                            
                            // console.log("Term after chores #8:  '%s'", _text);
                        }
                    }
                }
            }
            
            _polished = true;
            
            return result;
        };
        
        this.isPolished = function()
        {
            return _polished;
        };
        
        this.isEmpty = function()
        {
            var result = true;
            
            if (_text)
            if (_text.length > 0)
            {
                result = false;
            }
            
            return result;
        }
        
        this.toString = function()
        {
            return _text;
        }
    }
};

module.exports = new terms();

