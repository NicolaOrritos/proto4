
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
var REDIS_DB = 13;
var DOCS_KEY = "docs";
var SCORE_MULTIPLIER = 100000;
var CONFIG_STORE_DOCWIDE_SCORE = false;


// HELPER FUNCTIONS
function rangeModifier(termScore, correlationStrength)
{
    // console.log("'termScore' in: '%s'", termScore);
    // console.log("'correlationStrength' in: '%s'", correlationStrength);
    
    var result = ["-inf", "+inf"];
    
    if (termScore)
    {
        var ratio = 1/10;
        
        if (correlationStrength)
        {
            ratio = correlationStrength;
        }
        
        var modifier = ratio * termScore;
        
        result[0] = termScore - modifier;
        result[1] = result[0] + 2 * modifier; // termScore may be a string... damn
    }
    
    // console.log("Result of 'rangeModifier()': %s", result);
    
    return result;
}


var Searcher = function()
{
    this.STATUS_OK = 1;
    this.STATUS_NOT_OK = -1;
    
    this.CORRELATION_EXACT = 0;
    this.CORRELATION_STRONG = 1/10;
    this.CORRELATION_NORMAL = 1/5;
    this.CORRELATION_LOW = 1;
    this.CORRELATION_VERYLOW = 4;
    
    
    // Returns a list of documents and pages containing that term:
    this.search = function(term, callback)
    {
        if (term)
        {
            function run()
            {
                wait.forMethod(redis, "select", REDIS_DB);

                var keys = wait.forMethod(redis, "keys", term);

                var result = new Array();

                if (keys)
                {
                    console.log("Keys found: %s", keys);

                    function metacallback(error, length, position, partialResult)
                    {
                        // console.log("metacallback params: %d, %d", length, position);
                        
                        if (error)
                        {
                            console.log("Error: %s", error);
                        }
                        else if (partialResult)
                        {
                            for (var b=0; b<partialResult.length; b++)
                            {
                                if (partialResult[b])
                                {
                                    var parts = partialResult[b].split(":");

                                    if (parts.length == 2)
                                    {
                                        result.push({doc: parts[0], page: parts[1]});
                                    }
                                }
                            }
                        }

                        if (position == length)
                        {
                            callback.call(this, undefined, result);
                        }
                    }

                    for(var a=0; a<keys.length; a++)
                    {
                        var key = keys[a];

                        smembers(key, keys.length, a + 1, metacallback);
                    }
                }
            }

            wait.launchFiber(run);
        }
    };


    // Returns a list of terms correlated to the given one in the same page
    this.correlatedWithinPage = function(docID, pageID, term, callback)
    {
        this.correlatedWithinPageWithStrength(docID, pageID, term, this.CORRELATION_STRONG, callback);
    };
    
    this.correlatedWithinPageWithStrength = function(docID, pageID, term, correlationStrength, callback)
    {
        if (typeof(docID)  !== "undefined")
        if (typeof(pageID) !== "undefined")
        if (typeof(term)   !== "undefined")
        {
            function run()
            {
                var result = new Array();
                
                var pattern = docID + ":" + pageID;

                // 1. Get the score of the given term
                var termScore = wait.forMethod(redis, "zscore", pattern, term);
                
                // console.log("termScore is %s", termScore);
                
                if (termScore)
                {
                    // 2. Do the mathematic magick trick
                    var range = rangeModifier(termScore, correlationStrength);
                    
                    // console.log("Score range is [%s, %s] (reversed)", range[0], range[1]);

                    // 3. Once got the desired score-range, ask for terms that stay within it
                    result = wait.forMethod(redis, "zrevrangebyscore", pattern, range[1], range[0]);
                }
                
                
                if (callback)
                {
                    callback.call(this, undefined, result);
                }
            }
            
            wait.launchFiber(run);
        }
    };


    // Returns a list of terms correlated to the given one in the same document
    this.correlatedWithinDocument = function(docID, term, callback)
    {
        if (typeof(docID) !== "undefined")
        if (typeof(term)  !== "undefined")
        {
            function run()
            {
                var result = new Array();
                
                wait.forMethod(redis, "select", REDIS_DB);

                var keys = wait.forMethod(redis, "smembers", term);

                if (keys)
                if (keys.length > 0)
                {
                    var correlated = undefined;
                    var parts = undefined;
                    
                    for (var a=0; a<keys.length; a++)
                    {
                        parts = keys[a].split(":");
                        
                        if (parts.length == 2)
                        if (parts[0] == docID)
                        {
                            // console.log("Key is '%s'", keys[a]);    
                            
                            correlated = wait.forMethod(self, "correlatedWithinPageWithStrength", docID, parts[1], term, this.CORRELATION_EXACT);
                            
                            // console.log("Correlated: '%s'", correlated);
                            
                            result = sets.add(result, correlated);
                        }
                    }
                }
                
                
                if (callback)
                {
                    callback.call(this, undefined, sets.dedup(result));
                }
            }
            
            wait.launchFiber(run);
        }
    };
};

module.exports = Searcher;

