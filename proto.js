
var path = require('path');
var extract = require('pdf-text-extract');
var stopwords = require('stopwords').english;


var examplePath = "examples/Cosmos.pdf";


var delayedExtraction = function()
{
    var filePath = path.join(__dirname, examplePath)

    extract(filePath, function( error, pages )
    {
        var start = new Date();
        
        if (error)
        {
            console.log("Error: '%s'", error.message);
            console.log("%s", error.filePath);
            console.log("%s", error.command);
            console.log("%s", error.stack);
        }
        else if (!pages)
        {
            console.log("Error: no pages received");
        }
        else
        {
            // console.log("pages: %s", pages);
            console.log("isArray: %s", Array.isArray(pages));
            console.log("pages.length: %s", pages.length);
            
            
            for (var i=0; i<pages.length; i++)
            {
                var text = pages[i];
                
                if (text)
                {
                    // console.log("text: %s", text);
                    
                    
                    // Ignore punctuation for now...
                    var terms = text.split(" ");
                    
                    var usefulTerms = new Array();
                    
                    
                    for (var a=0; a<terms.length; a++)
                    {
                        var term = terms[a];
                        
                        if (term)
                        {
                            // console.log("Term before chores:    '%s'", term);
                            
                            
                            term = term.replace(/[\.,-\/#!$%\^&\*;:{}=\-_`~()]/, "");
                            
                            // console.log("Term after chores #1:  '%s'", term);
                            
                            term = term.replace(/^\d+$/, "");
                            
                            // console.log("Term after chores #2:  '%s'", term);
                            
                            term = term.trim();
                            
                            // console.log("Term after chores #3:  '%s'", term);
                            
                            term = term.toLowerCase();
                            
                            // console.log("Term after chores #4:  '%s'", term);
                            
                            term = /[a-zA-Z]/.test(term) ? term : "";
                            
                            // console.log("Term after chores #5:  '%s'", term);
                            
                            
                            if (term.length > 0)
                            {
                                usefulTerms.push(term);
                            }
                        }
                    }
                    
                    
                    var finalTerms = new Array();
                    
                    for (var a=0; a<usefulTerms.length; a++)
                    {
                        var term = usefulTerms[a];
                        
                        if (term)
                        {
                            if (stopwords.indexOf(term) == -1)
                            {
                                finalTerms.push(term);
                                
                                // console.log("Found a final-term: '%s'", term);
                            }
                        }
                    }
                    
            
                    console.log("PAGE %d", (i + 1));
                    console.log("simple terms found: #%d", terms.length);
                    console.log("useful terms found: #%d", usefulTerms.length);
                    console.log("final  terms found: #%d", finalTerms.length);
                }
            }
        }
        
        var end = new Date();
        
        var time = end - start;
        
        console.log("\nmilliseconds: #%d", time);
        console.log("seconds:      #%d", (time / 1000));
    });
};


setTimeout(delayedExtraction, 500);


