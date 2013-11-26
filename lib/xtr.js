
/* Which data structures are added to the DB?
 * There are three types of structures:
 * 1) term     =>  doc:page             [sadd]
 * 2) doc:page =>  term(score)          [zadd]
 * 3) doc      =>  term(doc-wide-score) [zadd]
 */

var wait = require("wait.for");
var path = require('path');
var extract = require('pdf-text-extract');
var stopwords = require('stopwords').english;
var redis = require("redis").createClient();
var sets = require("sets.js");


redis.on("error", function (err)
{
    console.log("Got an error from the Redis client: " + err);
});

var REDIS_DB = 13;
var DOCS_KEY = "docs";
var SCORE_MULTIPLIER = 100000;
var CONFIG_STORE_DOCWIDE_SCORE = false;

function rangeModifier(termScore)
{
    var result = ["-inf", "+inf"];
    
    if (termScore)
    {
        var modifier = 1/10 * termScore;
        
        result[0] = termScore - modifier;
        result[1] = result[0] + 2 * modifier; // termScore may be a string... damn
    }
    
    // console.log("Result of 'rangeModifier()': %s", result);
    
    return result;
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
                if (callback)
                {
                    callback.call(this, length, position);
                }
            });
        });
    }
}

function smembers(key, callback)
{
    smembers(key, 1, 1, callback);
}

function smembers(key, length, position, callback)
{
    var partialResult = new Array();

    function run()
    {
        var members = wait.forMethod(redis, "smembers", key);

        if (members)
        {
            for (var a=0; a<members.length; a++)
            {
                partialResult.push(members[a]);
            }
        }

        if (callback)
        {
            callback.call(this, length, position, partialResult);
        }
    }

    wait.launchFiber(run);
}

function pushTerms(docID, pageID, terms, length2, position2, callback)
{
    if (typeof(docID)  !== "undefined")
    if (typeof(pageID) !== "undefined")
    if (typeof(terms)  !== "undefined")
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
             * always the last term of the array... */
            sadd_async(term,
                       key,
                       termsList.length,
                       i + 1,
                       metacallback);       // term => doc:page

            zadd_async(key,
                       score,
                       term);               // doc:page => term(score)

            /* I'm using the metacallback trick to return
             * once the for loop has finished */
        }
    }
}

function loadDocs(callback)
{
    function run()
    {
        var docs = undefined;

        wait.forMethod(redis, "select", REDIS_DB);
        var result = wait.forMethod(redis, "get", DOCS_KEY);

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
    }

    wait.launchFiber(run);
}

function saveDocs(docs)
{
    if (docs)
    {
        function run()
        {
            var result = "";
            var a=0;

            for (; a<docs.length - 1; a++)
            {
                result += (docs[a] + ",");
            }

            result += ("" + docs[a]);

            wait.forMethod(redis, "select", REDIS_DB);
            wait.forMethod(redis, "set", DOCS_KEY, result);
        }

        wait.launchFiber(run);
    }
}

function pushTermDocScore(array, allTermsOccurrencies, term, termDocOccurrencies, scoreMultiplier)
{
    var docScore = 0;

    if (typeof(array) !== "undefined")
    if (typeof(term)  !== "undefined")
    if (scoreMultiplier)
    if (allTermsOccurrencies)
    if (typeof(termDocOccurrencies) !== "undefined")
    {
        // 1. Actual calculation
        docScore = termDocOccurrencies / allTermsOccurrencies;

        // 2. "Stabilization"
        docScore *= scoreMultiplier;
    }

    array.push({"term": term, "docScore": docScore});
}


var xtractor = function()
{
    var self = this;

    this.STATUS_OK = 1;
    this.STATUS_NOT_OK = -1;

    this.docs = undefined;


    this.init = function(callback)
    {
        function run()
        {
            var result = wait.for(loadDocs);

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
        }

        wait.launchFiber(run);
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

                    var results = new Array();
                    var docWideScores = new Object();
                    var allTermsOccurrencies = 0;

                    function metacallback(length, position, result)
                    {
                        results.push(result);

                        if (length == position)
                        {
                            // console.log("\nDoc-wide scores: %s", JSON.stringify(docWideScores));

                            var end = new Date();

                            var time = end - start;

                            console.log("\nmilliseconds: #%d", time);
                            console.log("seconds:      #%d", (time / 1000));

                            if (callback)
                            {
                                callback.call(this, undefined, results);
                            }

                            // Now add to the DB the terms with their document-wide score:
                            if (CONFIG_STORE_DOCWIDE_SCORE)
                            {
                                var termsWithDocScores = new Array();

                                for (termWithDocScore in docWideScores)
                                {
                                    pushTermDocScore(termsWithDocScores,
                                                     allTermsOccurrencies,
                                                     termWithDocScore,
                                                     docWideScores[termWithDocScore],
                                                     SCORE_MULTIPLIER);
                                }

                                for (var c=0; c<termsWithDocScores.length; c++)
                                {
                                    var termWithDocScore = termsWithDocScores[c];

                                    if (termWithDocScore)
                                    {
                                        zadd_async(doc,
                                                   termWithDocScore.docScore,
                                                   termWithDocScore.term);     // doc => term(doc-wide-score)
                                    }
                                }
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

                                    term = /[a-zA-Z]/.test(term) ? term : "";

                                    // console.log("Term after chores #4:  '%s'", term);

                                    term = term.toLowerCase();

                                    // console.log("Term after chores #5:  '%s'", term);


                                    if (term.length > 0)
                                    {
                                        usefulTerms.push(term);
                                    }
                                }
                            }


                            var termsCountPerPage = usefulTerms.length;
                            allTermsOccurrencies += termsCountPerPage;

                            // Let's use an associative array here:
                            var termsWithScore = new Object();

                            for (var a=0; a<usefulTerms.length; a++)
                            {
                                var term = usefulTerms[a];

                                if (term)
                                {
                                    if (stopwords.indexOf(term) == -1)
                                    {
                                        // Update per-page term score
                                        var pageScore = termsWithScore[term];

                                        if (!pageScore)
                                        {
                                            pageScore = 0;
                                        }

                                        termsWithScore[term] = ++pageScore;


                                        // Update per-document term score
                                        var docScore = docWideScores[term];

                                        if (!docScore)
                                        {
                                            docScore = 0;
                                        }

                                        docWideScores[term] = ++docScore;
                                    }
                                }
                            }

                            // console.log("Pushing terms for page ID '%s'...", pageID);

                            var pageID = "" + i;

                            pushTerms(doc, pageID, termsWithScore, pages.length, i + 1, metacallback);
                        }
                    }
                }
            }

            wait.launchFiber(run);
        }
    };


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

                    function metacallback(length, position, partialResult)
                    {
                        // console.log("metacallback params: %d, %d", length, position);

                        if (partialResult)
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
                    var range = rangeModifier(termScore);
                    
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
                
                var pagesPattern = docID + ":*";
                
                wait.forMethod(redis, "select", REDIS_DB);

                var keys = wait.forMethod(redis, "keys", pagesPattern);

                if (keys)
                {
                    for (var a=0; a<keys.length; a++)
                    {
                        // console.log("Key is '%s'", keys[a]);
                        
                        var parts = keys[a].split(":");
                        
                        if (parts.length == 2)
                        {
                            var correlated = wait.forMethod(self, "correlatedWithinPage", docID, parts[1], term);
                    
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

var xtr = {actor: new xtractor()};

module.exports = xtr;


