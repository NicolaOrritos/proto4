
var path = require('path');
var extract = require('pdf-text-extract');
var stopwords = require('stopwords').english;
var redis = require("redis").createClient();


redis.on("error", function (err)
{
    console.log("Got an error from the Redis client: " + err);
});

var REDIS_DB = 12;
var DOCS_KEY = "docs";


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

function sadd(term, key, length, position, callback)
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
                    if (callback)
                    {
                        callback.call(this, length, position);
                    }
                }
            });
        });
    }
}

function smembers(key, length, position, callback)
{
    var partialResult = new Array();
    
    redis.smembers(key, function(error, members)
    {
        if (error)
        {
            console.log("Error when searching for term '%s': %s", term, error);
        }
        else if (members)
        {
            for (var a=0; a<members.length; a++)
            {
                partialResult.push(members[a]);
            }
        }
            
        if (length)
        if (position)
        {
            callback.call(this, length, position, partialResult);
        }
    });
}

function pushTerms(docID, pageID, terms, length2, position2, callback)
{
    if (docID)
    if (pageID)
    if (terms)
    {
        function metacallback(length, position)
        {
            if (length == position)
            {
                if (callback)
                {
                    callback.call(this, length2, position2, xtr.actor.STATUS_OK);
                }
            }
        }
        
        
        var key = docID + ":" + pageID;
        var termsList = new Array();
        
        for (term in terms)
        {
            termsList.push(term);
        }
        
        for (var i=0; i<termsList.length; i++)
        {
            var term = termsList[i];
            var score = terms[term];
            
            /* We absolutely need functions to "bind" the parameters of the operations.
             * I once had the functions inlined here but they kept on zadd-ing and sadd-ing
             * always the last term of the terms array... */
            sadd(term, key, termsList.length, i + 1, metacallback);
            zadd(key, score, term);
            
            /* Also, I'm using the metacallback trick to return the callback once the for finished */
        }
    }
}

function loadDocs(self, callback)
{
    redis.select(REDIS_DB, function()
    {
        redis.get(DOCS_KEY, function(error, result)
        {
            if (error)
            {
                console.log("Error: no docs found");
                
                self.docs = new Array();
            }
            else if (result)
            {
                self.docs = result.split(",");
            }
            else
            {
                self.docs = new Array();
            }
            
            if (callback)
            {
                callback.call(self, error, self.docs);
            }
        });
    });
}

function saveDocs(docs)
{
    if (docs)
    {
        var result = "";
        var a=0;
        
        for (; a<docs.length - 1; a++)
        {
            result += (docs[a] + ",");
        }
        
        result += ("" + docs[a]);
        
        redis.select(REDIS_DB, function()
        {
            redis.set(DOCS_KEY, result);
        });
    }
}


var xtractor = function()
{
    var self = this;
    
    this.STATUS_OK = 1;
    
    this.docs = undefined;
    
    
    this.init = function(callback)
    {
        loadDocs(this, callback);
    };
    
    this.load = function(docPath, docID, callback)
    {
        var path = docPath;
        var doc  = docID ? docID : docPath;
        
        
        if (path)
        if (doc)
        {
            // Add to the docs if not present:
            if (this.docs.indexOf(doc) == -1)
            {
                this.docs.push(doc);
                saveDocs(this.docs);
            }
            
            
            var filePath = path;

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
                    console.log("Document '%s' has %d pages", doc, pages.length);
                    
                    var results = new Array();
                    
                    function metacallback(length, position, result)
                    {
                        results.push(result);
                        
                        if (length == position)
                        {
                            var end = new Date();
                            
                            var time = end - start;
                            
                            console.log("\nmilliseconds: #%d", time);
                            console.log("seconds:      #%d", (time / 1000));
                            
                            if (callback)
                            {
                                callback.call(self, results);
                            }
                        }
                    }
                    
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
                            
                            pushTerms(doc, pageID, termsWithScore, pages.length, i + 1, metacallback);
                        }
                    }
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
                    var result = new Array();
                    
                    if (err)
                    {
                        console.log("Error when searching for term '%s': %s", term, error);
                    }
                    else
                    {
                        console.log("Keys found: %s", keys);
                        
                        function metacallback(length, position, partialResult)
                        {
                            // console.log("metacallback params: %d, %d", length, position);
                            
                            if (partialResult)
                            {
                                for (var b=0; b<partialResult.length; b++)
                                {
                                    result.push(partialResult[b]);
                                }
                            }
                            
                            if (position == length)
                            {
                                callback.call(this, result);
                            }
                        }
                        
                        for(var a=0; a<keys.length; a++)
                        {
                            var key = keys[a];
                            
                            smembers(key, keys.length, a + 1, metacallback);
                        }
                    }
                });
            });
        }
    };
    
    
    var allCorrelatedTo = function(term)
    {
        if (term)
        {
            /* 1. Get terms correlated to 'term' from all the documents,
             *    by iterating calls to 'correlatedWithinDocument()' */
            for (var a=0; a<this.docs.length; a++)
            {
                
            }
        }
    };
    
    
    // Returns a list of terms correlated to the given one in the same document
    var correlatedWithinDocument = function(docID, term, callback)
    {
        if (docID)
        if (term)
        {
            var pagesPattern = docID + ":*";
        }
    };
    
    
    // Returns a list of terms correlated to the given one in the same page
    var correlatedWithinPage = function(docID, pageID, term, callback)
    {
        if (docID)
        if (pageID)
        if (term)
        {
            var pattern = docID + ":" + pageID;
            
            // 1. Get the score of the given term
            
            
            // 2. Do the mathematic magick trick
            
            // 3. Once got the desired score-range, ask for terms that stay within it
        }
    };
};

var xtr = {actor: new xtractor()};

module.exports = xtr;


