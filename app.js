
var xtr  = require("./index.js");
var wait = require("wait.for");


function main()
{
    var result = wait.forMethod(xtr.actor, "init");

    // Result is the set of docs of this xtr.actor instance
    console.log("docs: %s", result);


    ////////////////////////////////////////////////
    

    /* var examplePath = "examples/MMAN0001_2012_TAB.pdf";
    var docID = "MMAN0001_2012_TAB.pdf";
    // var examplePath = "examples/HiddenReality.pdf";
    // var docID = "HiddenReality.pdf";

    var loadingResult = wait.forMethod(xtr.actor, "load", examplePath, docID);

    console.log("Pages processed: %s", loadingResult.length);
    console.log("Results: %s", loadingResult);
    console.log("Errors? %s", (loadingResult.indexOf(0) != -1) ? "YES" : "NO"); */


    ////////////////////////////////////////////////


    /* result = undefined;
    var term = "result";

    var start = new Date();

    result = wait.forMethod(xtr.actor, "search", term);

    console.log("Document was searched");

    var end = new Date();

    var time = end - start;

    console.log("\nmilliseconds: #%d", time);
    console.log("seconds:      #%d", (time / 1000));


    if (result)
    {
        for (var a=0; a<result.length; a++)
        {
            console.log("Res: %s", JSON.stringify(result[a]));
        }
    } */


    ////////////////////////////////////////////////


    /* result = undefined;
    var page = 1;
    var term = "hidden";
    
    var start = new Date();

    result = wait.forMethod(xtr.actor, "correlatedWithinPage", "HiddenReality.pdf", page, term);
    
    var end = new Date();

    var time = end - start;

    console.log("\nmilliseconds: #%d", time);
    console.log("seconds:      #%d", (time / 1000));

    console.log("Correlated to '%s' on page %d: %s", term, page, JSON.stringify(result)); */


    ////////////////////////////////////////////////


    result = undefined;
    var term = "result";
    var docID = "HiddenReality.pdf";
    
    var start = new Date();

    result = wait.forMethod(xtr.actor, "correlatedWithinDocument", docID, term);
    
    var end = new Date();

    var time = end - start;

    console.log("\nmilliseconds: #%d", time);
    console.log("seconds:      #%d", (time / 1000));

    console.log("Correlated to '%s' on document '%s': %s", term, docID, result.length);
}

wait.launchFiber(main);

