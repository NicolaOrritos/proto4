
var xtr = require("./index.js");

var examplePath = "examples/Cosmos.pdf";
var docID = "Cosmos.pdf";

/* xtr.actor.load(examplePath, docID, function()
{
    console.log("Document was processed");
}); */

xtr.actor.search("re*", function(result)
{
    console.log("Document was searched");
    console.log("Result: %s", result);
    
    if (result)
    {
        for (res in result)
        {
            console.log("Res: %s", res);
        }
    }
});

