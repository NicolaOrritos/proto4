
var path = require('path');
var extract = require('pdf-text-extract');
var stopwords = require('stopwords').english;
var redis = require("redis").createClient();

redis.on("error", function (err)
{
    console.log("Got an error from the Redis client: " + err);
});

var REDIS_DB = 12;


var examplePath = "examples/Cosmos.pdf";

var docID = "Cosmos.pdf";


function pushTerms(docID, pageID, terms, callback)
{
    if (docID)
    if (pageID)
    if (terms)
    {
        redis.select(REDIS_DB, function()
        {
            var key = docID + ":" + pageID;
            
            // console.log("key is: %s", key);
            
            /* For test purposes and for a number of other good reasons
             * we should delete the key before adding the newly found items */
            redis.del(key, function()
            {
                for(term in terms)
                {
                    var score = terms[term];
                    
                    var args = [key, score, term];
                    
                    // Push the term with its score in the DB:
                    redis.zadd(args, function(error, result)
                    {
                        if (error)
                        {
                            console.log("Error when adding the new term: %s", error);
                        }
                        else
                        {
                            // console.log("[ZADD] Added/updated #%d term(s)", result);
                            
                            if (result > 0)
                            {
                                redis.sadd(term, key, function(err, res)
                                {
                                    if (err)
                                    {
                                        console.log("Error when adding the new term: %s", err);
                                    }
                                    else
                                    {
                                        // console.log("[SADD] Added/updated #%d term(s)", res);
                                    }
                                });
                            }
                        }
                    });
                }
                
                // Callback gets called before actually finishing the operations
                if (callback)
                {
                    callback.call();
                }
            });
        });
    }
}


function extraction(callback)
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
            console.log("Document '%s' has %d pages", docID, pages.length);
            
            
            for (var i=0; i<pages.length; i++)
            {
                var text = pages[i];
                
                if (text)
                {
                    // Remove line-breaks before all:
                    text = text.replace(/\r?\n|\r/g, " ");
                    
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
                    
                    
                    // Let's use an associative array here:
                    var termsWithScore = new Object();
                    
                    for (var a=0; a<usefulTerms.length; a++)
                    {
                        var term = usefulTerms[a];
                        
                        
                        
                        if (term)
                        {
                            if (stopwords.indexOf(term) == -1)
                            {
                                var score = termsWithScore[term];
                            
                                if (!score)
                                {
                                    score = 0;
                                }
                                
                                termsWithScore[term] = ++score;
                                
                                // console.log("Found a final-term: '%s'", term);
                            }
                        }
                    }
                    
            
                    /* console.log("PAGE %d", (i + 1));
                    console.log("simple terms found: #%d", terms.length);
                    console.log("useful terms found: #%d", usefulTerms.length);
                    console.log("final  terms found: #%d", termsWithScore.length); */
                    
                    var pageID = "" + i;
                    
                    pushTerms(docID, pageID, termsWithScore, function()
                    {
                        // console.log("Added the terms for this page");
                    });
                }
            }
        }
        
        var end = new Date();
        
        var time = end - start;
        
        console.log("\nmilliseconds: #%d", time);
        console.log("seconds:      #%d", (time / 1000));
        
        // Callback gets called before actually finishing the operations
        if (callback)
        {
            callback.call();
        }
    });
}

extraction(function()
{
    console.log("Added document to the DB");
});


