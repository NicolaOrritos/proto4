
var pdfix  = require("./index.js");
var wait = require("wait.for");


function main()
{
    var result = wait.forMethod(pdfix.loader, "init");

    // Result is the set of docs of this pdfix instance
    console.log("docs: %s", result);


    ////////////////////////////////////////////////
    

    /* var examplePath = "examples/MMAN0001_2012_TAB.pdf";
    var docID = "MMAN0001_2012_TAB.pdf";
    // var examplePath = "examples/HiddenReality.pdf";
    // var docID = "HiddenReality.pdf";

    var loadingResult = wait.forMethod(pdfix.loader, "load", examplePath, docID);

    console.log("Pages processed: %s", loadingResult); */


    ////////////////////////////////////////////////


    /* result = undefined;
    var term = "result";

    var start = new Date();

    result = wait.forMethod(pdfix.search, "search", term);

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
    var page = 0;
    var term = "survey";
    
    var start = new Date();

    result = wait.forMethod(pdfix.search, "correlatedWithinPage", "MMAN0001_2012_TAB.pdf", page, term);
    
    var end = new Date();

    var time = end - start;

    console.log("\nmilliseconds: #%d", time);
    console.log("seconds:      #%d", (time / 1000));

    console.log("Correlated to '%s' on page %d: %s", term, page, JSON.stringify(result)); */


    ////////////////////////////////////////////////

    result = undefined;
    var term = "survey";
    var docID = "MMAN0001_2012_TAB.pdf";
    
    var start = new Date();

    result = wait.forMethod(pdfix.search, "correlatedWithinDocument", docID, term);
    
    var end = new Date();

    var time = end - start;

    console.log("\nmilliseconds: #%d", time);
    console.log("seconds:      #%d", (time / 1000));

    console.log("Correlated to '%s' on document '%s': %s", term, docID, result.length);
    console.log("%s", result);
}

wait.launchFiber(main);

