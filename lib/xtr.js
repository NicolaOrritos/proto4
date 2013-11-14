
var path = require('path');
var extract = require('pdf-text-extract');
var stopwords = require('stopwords').english;
var redis = require("redis").createClient();


redis.on("error", function (err)
{
    console.log("Got an error from the Redis client: " + err);
});

var REDIS_DB = 12;


function zadd(key, score, term)
{
    if (key)
    if (score)
    if (term)
    {
        redis.select(REDIS_DB, function()
        {
            // Push the term with its score in the DB:
            redis.zadd(key, score, term, function(error, result)
            {
                if (error)
                {
                    console.log("Error when adding the new term: %s", error);
                }
                else
                {
                    // console.log("[ZADD] Added/updated term '%s', with score '%d'. ZADD result was '%s'", term, score, result);
                }
            });
        });
    }
}

function sadd(term, key)
{
    if (term)
    if (key)
    {
        redis.select(REDIS_DB, function()
        {
            // Push the term with its doc-page coordinates as well:
            redis.sadd(term, key, function(err, res)
            {
                if (err)
                {
                    console.log("Error when adding the new term: %s", err);
                }
                else
                {
                    // console.log("[SADD] Added/updated #%d times term '%s'", res, term);
                }
            });
        });
    }
}

function pushTerms(docID, pageID, terms, callback)
{
    if (docID)
    if (pageID)
    if (terms)
    {
        var key = docID + ":" + pageID;
        
        for (term in terms)
        {
            var score = terms[term];
            
            /* We absolutely need functions to "bind" the parameters of the operations.
             * I once had the functions inlined here but they kept on zadd-ing and sadd-ing
             * always the last term of the for... */
            zadd(key, score, term);
            sadd(term, key);
        }
        
        // Callback gets called before actually finishing the operations
        if (callback)
        {
            callback.call();
        }
    }
}


var xtractor = function()
{
    var self = this;
    
    this.load = function(docPath, docID, callback)
    {
        this.path = docPath;
        this.doc  = docID ? docID : docPath;
        
        
        if (this.path)
        if (this.doc)
        {
            var filePath = this.path;

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
                    console.log("Document '%s' has %d pages", self.doc, pages.length);
                    
                    
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
                                        
                                        // console.log("Found a final-term: '%s', with score %d", term, score);
                                    }
                                }
                            }
                            
                    
                            /* console.log("PAGE %d", (i + 1));
                            console.log("simple terms found: #%d", terms.length);
                            console.log("useful terms found: #%d", usefulTerms.length);
                            console.log("final  terms found: #%d", termsWithScore.length); */
                            
                            var pageID = "" + i;
                            
                            pushTerms(self.doc, pageID, termsWithScore, function()
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
                    callback.call(self);
                }
            });
        }
    };
    
    
    // Returns a list of documents and pages containing that term:
    this.search = function(term, callback)
    {
        if (term)
        {
            redis.select(REDIS_DB, function()
            {
                redis.keys(term, function(err, keys)
                {
                    if (err)
                    {
                        console.log("Error when searching for term '%s': %s", term, error);
                    }
                    else
                    {
                        console.log("Keys found: %s", keys);
                        
                        for(var a=0; a<keys.length; a++)
                        {
                            var key = keys[a];
                            
                            redis.smembers(key, function(error, members)
                            {
                                if (error)
                                {
                                    console.log("Error when searching for term '%s': %s", term, error);
                                }
                                else
                                {
                                    console.log("Members for key '%s' found: %s", key, JSON.stringify(members));
                                }
                            });
                        }
                    }
                });
            });
        }
    };
};

var xtr = {actor: new xtractor()};

module.exports = xtr;


