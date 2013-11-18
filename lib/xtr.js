
/* Which data structures are added to the DB?
 * There are three types of structures:
 * 1) term     =>  doc:page            [sadd]
 * 2) doc:page =>  term(score)         [zadd]
 * 3) term     =>  doc(doc-wide-score) [zadd]
 */

var wait = require("wait.for");
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
        function run()
        {
            wait.forMethod(redis, "select", REDIS_DB);
            var result = wait.forMethod(redis, "zadd", key, score, term);
            
            console.log("[ZADD] Added/updated term '%s', with score '%d'. ZADD result was '%s'", term, score, result);
        }
        
        wait.launchFiber(run);
    }
}

function sadd(term, key, length, position, callback)
{
    if (term)
    if (key)
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
            
        if (length)
        if (position)
        {
            callback.call(this, length, position, partialResult);
        }
    }
    
    wait.launchFiber(run);
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
            sadd(term, key, termsList.length, i + 1, metacallback);     // term => doc:page
            zadd(key, score, term);                                     // doc:page => term(score)
            
            /* I'm using the metacallback trick to return
             * once the for loop has finished */
        }
    }
}

function loadDocs(self, callback)
{
    function run()
    {
        wait.forMethod(redis, "select", REDIS_DB);
        
        var result = wait.forMethod(redis, "get", DOCS_KEY);
        
        if (result)
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

function calculateTermDocScore(allTermsOccurrencies, termDocumentOccurrencies)
{
    var result = 0;
    
    if (allTermsOccurrencies)
    if (termDocumentOccurrencies)
    {
        console.log("'calculateTermDocScore()' called with the following parameters: %s, %s", allTermsOccurrencies, termDocumentOccurrencies);
        
        result = termDocumentOccurrencies / allTermsOccurrencies;
    }
    
    return result;
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
                    var docWideScores = new Object();
                    var allTermsOccurrencies = 0;
                    
                    function metacallback(length, position, result)
                    {
                        results.push(result);
                        
                        if (length == position)
                        {
                            console.log("\nDoc-wide scores: %s", JSON.stringify(docWideScores));
                            
                            var end = new Date();
                            
                            var time = end - start;
                            
                            console.log("\nmilliseconds: #%d", time);
                            console.log("seconds:      #%d", (time / 1000));
                            
                            if (callback)
                            {
                                callback.call(self, results);
                            }
                            
                            // Now add to the DB the terms with their document-wide score:
                            var termsWithDocScores = new Array();
                            
                            for (termWithDocScore in docWideScores)
                            {
                                // console.log("Doc-wide occurrencies for term '%s' are '%s'", termWithDocScore, docWideScores[termWithDocScore]);
                                
                                var docScore = calculateTermDocScore(allTermsOccurrencies, docWideScores[termWithDocScore]);
                                
                                termsWithDocScores.push({"term": termWithDocScore, "docScore": docScore});
                            }
                            
                            for (var c=0; c<termsWithDocScores.length; c++)
                            {
                                var termWithDocScore = termsWithDocScores[c];
                                
                                if (termWithDocScore)
                                {
                                    zadd(termWithDocScore.term, termWithDocScore.docScore, doc);     // term => doc(doc-wide-score)
                                }
                            }
                        }
                    }
                    
                    for (var i=0; i<3; i++)
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
                wait.for(redis, "select", REDIS_DB);
                
            }
            
            wait.launchFiber(run);
            
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
    
    
    var allCorrelatedTo = function(term, callback)
    {
        if (term)
        {
            // 1. Get documents containing this term with its occurrency-ratio per document
            smembers(term, function()
            {
                
            });
            
            /* 2. Get terms contained in the documents found in 1,
             *    restricting to the ones that stay within a range of occurrencies */
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


