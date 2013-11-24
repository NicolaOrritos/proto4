
var xtr  = require("./index.js");
var wait = require("wait.for");

function main()
{
    var result = wait.forMethod(xtr.actor, "init");

    // Result is the set of docs of this xtr.actor instance
    console.log("docs: %s", result);


    /* var examplePath = "examples/Cosmos.pdf";
    var docID = "Cosmos.pdf";
    // var examplePath = "examples/HiddenReality.pdf";
    // var docID = "HiddenReality.pdf";

    var loadingResult = wait.forMethod(xtr.actor, "load", examplePath, docID);

    console.log("Pages processed: %s", loadingResult.length);
    console.log("Results: %s", loadingResult);
    console.log("Errors? %s", (loadingResult.indexOf(0) != -1) ? "YES" : "NO"); */


    ////////////////////////////////////////////////


    /* result = undefined;

    var start = new Date();

    result = wait.forMethod(xtr.actor, "search", "physics");

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


    result = undefined;

    result = wait.forMethod(xtr.actor, "allCorrelatedTo", "result");

    console.log("result: %s", result);
}

wait.launchFiber(main);

