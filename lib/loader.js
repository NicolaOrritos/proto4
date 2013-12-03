
// REQUIRES
var wait = require("wait.for");
var path = require('path');
var extract = require('pdf-text-extract');
var stopwords = require('stopwords').english;
var redis = require("redis").createClient();
var sets = require("sets.js");
var terms = require("./terms.js");


// REDIS ERROR HANDLER
redis.on("error", function (err)
{
    console.log("Got an error from the Redis client: " + err);
});


// CONSTANTS
var REDIS_DB = 14;
var DOCS_KEY = "globalkey:docs";
var SCORE_MULTIPLIER = 100000;
var CONFIG_STORE_DOCWIDE_SCORE = false;


// UTILITY METHODS
function loadDocs(callback)
{
    var docs = undefined;
    
    redis.select(REDIS_DB, function(err)
    {
        if (err)
        {
            console.log("Error: %s", err);
            
            if (callback)
            {
                callback.call(this, err, docs);
            }
        }
        else
        {
            redis.get(DOCS_KEY, function(err, result)
            {
                if (result)
                {
                    docs = result.split(",");
                }
                else
                {
                    docs = new Array();
                }

                if (callback)
                {
                    callback.call(this, undefined, docs);
                }
            });
        }
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
        
        redis.select(REDIS_DB, function(err)
        {
            if (err)
            {
                console.log("Error: %s", err);
            }
            else
            {
                redis.set(DOCS_KEY, result);
            }
        });
    }
}

function zadd(key, score, term)
{
    if (typeof(key)   !== "undefined")
    if (typeof(score) !== "undefined")
    if (typeof(term)  !== "undefined")
    {
        function run()
        {
            wait.forMethod(redis, "select", REDIS_DB);
            var result = wait.forMethod(redis, "zadd", key, score, term);

            // console.log("[ZADD] Added/updated term '%s', with score '%d'. ZADD result was '%s'", term, score, result);
        }

        wait.launchFiber(run);
    }
}

function zadd_async(key, score, term)
{
    if (typeof(key)   !== "undefined")
    if (typeof(score) !== "undefined")
    if (typeof(term)  !== "undefined")
    {
        redis.select(REDIS_DB, function()
        {
            redis.zadd(key, score, term, function(err, result)
            {
                if (err)
                {
                    throw err;
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
    if (typeof(term) !== "undefined")
    if (typeof(key)  !== "undefined")
    {
        function run()
        {
            wait.forMethod(redis, "select", REDIS_DB);
            var result = wait.forMethod(redis, "sadd", term, key);

            if (callback)
            {
                callback.call(this, length, position);
            }
        }

        wait.launchFiber(run);
    }
}

function sadd_async(term, key, length, position, callback)
{
    if (typeof(term) !== "undefined")
    if (typeof(key)  !== "undefined")
    {
        redis.select(REDIS_DB, function()
        {
            redis.sadd(term, key, function(err, result)
            {
                if (err)
                {
                    console.log("Error while sadd-ing '%s' to the DB: %s", term, err);
                }
                
                if (callback)
                {
                    callback.call(this, length, position);
                }
            });
        });
    }
}

function pushTerms(docID, pageID, termsList, length2, position2, callback)
{
    if (typeof(docID)  !== "undefined")
    if (typeof(pageID) !== "undefined")
    if (typeof(termsList)  !== "undefined")
    {
        function metacallback(length, position)
        {
            // console.log("metacallback called with Length '%s' and Position '%s'", length, position);
            
            if (length == position)
            {
                if (callback)
                {
                    callback.call(this, length2, position2, 1);
                }
            }
        }
        
        var key = docID + ":" + pageID;
        
        for (var i=0; i<termsList.length; i++)
        {
            var term = termsList[i];
            
            // console.log("Pushing term '%s'...", term.getText());
            
            /* We absolutely need functions to "bind" the parameters of the operations.
             * I once had the functions inlined here but they kept on zadd-ing and sadd-ing
             * always the last term of the array... */
            sadd_async(term,
                       key,
                       termsList.length,
                       i + 1,
                       metacallback);       // term => doc:page
            
            // "Score" of the term is given by its position on the page
            zadd_async(key,
                       i,
                       term);               // doc:page => term(score)
            
            /* I'm using the metacallback trick to return
             * once the for loop has finished */
        }
    }
}


var Loader = function(options)
{
    var terms = options.terms;
    
    this.docs = undefined;
    
    this.changeDB = function(dbNumber)
    {
        if (dbNumber)
        {
            REDIS_DB = dbNumber;
        }
    }
    
    this.init = function(callback)
    {
        loadDocs(function(err, result)
        {
            if (err)
            {
                console.log("Error: %s", err);
            }
            
            if (result)
            {
                this.docs = result;
            }
            else
            {
                this.docs = new Array();
            }
            
            if (callback)
            {
                callback.call(this, undefined, this.docs);
            }
        });
    };
    
    
    this.load = function(docPath, docID, callback)
    {
        var path = docPath;
        var doc  = docID ? docID : docPath;

        if (path)
        if (doc)
        {
            function run()
            {
                var start = new Date();
                
                var metacallback = function(length, position, result)
                {
                    console.log("Loader.load metacallback called. Length: %s; position: %s", length, position);
                    
                    if (length == position)
                    {
                        var end = new Date();
                        var time = end - start;
                        
                        console.log("\nmilliseconds: #%d", time);
                        console.log("seconds:      #%d", (time / 1000));
                        
                        
                        callback.call(this, undefined, length);
                    }
                };
                
                
                // Add to the docs if not present:
                if (this.docs.indexOf(doc) == -1)
                {
                    this.docs.push(doc);
                    saveDocs(this.docs);
                }


                var filePath = path;

                var pages = wait.for(extract, filePath);

                if (!pages)
                {
                    console.log("Error: no pages received");
                }
                else
                {
                    console.log("Document '%s' has %d pages", doc, pages.length);
                    
                    for (var i=0; i<pages.length; i++)
                    {
                        var text = pages[i];

                        if (text)
                        {
                            // Remove line-breaks before all:
                            text = text.replace(/\r?\n|\r/g, " ");

                            var rawTerms = text.split(" ");

                            var usefulTerms = new Array();
                            
                            
                            for (var a=0; a<rawTerms.length; a++)
                            {
                                // console.log("terms: %s", JSON.stringify(terms));
                                
                                var term = new terms.Term(rawTerms[a]);
                                
                                var moreTerms = term.polish();
                                
                                if (   moreTerms
                                    && moreTerms.length > 0)
                                {
                                    // console.log("Found more terms: %s", moreTerms);
                                    
                                    for (var b=0; b<moreTerms.length; b++)
                                    {
                                        moreTerms[b].setScore(a);
                                        usefulTerms.push(moreTerms[b]);
                                    }
                                }
                                else
                                {
                                    // console.log("Found 'simple' term: %s", term);
                                    
                                    term.setScore(a);
                                    usefulTerms.push(term);
                                }
                            }
                            
                            var pageID = "" + i;
                            
                            // console.log("Pushing terms for page ID '%s'...", pageID);
                            
                            pushTerms(doc, pageID, usefulTerms, pages.length, i + 1, metacallback);
                        }
                    }
                }
            }
            
            wait.launchFiber(run);
        }
    };
};

module.exports = Loader;

