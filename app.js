
var xtr = require("./index.js");

xtr.actor.init(function(error, result)
{
    // Result is the set of docs of this xtr.actor instance
    console.log("docs: %s", result);
    
    var examplePath = "examples/Cosmos.pdf";
    var docID = "Cosmos.pdf";

    xtr.actor.load(examplePath, docID, function(result)
    {
        console.log("Pages processed: %s", result.length);
        console.log("Results: %s", result);
        console.log("Errors? %s", (result.indexOf(0) != -1) ? "YES" : "NO");
    });
    
    
    /* var start = new Date();

    xtr.actor.search("result", function(result)
    {
        console.log("Document was searched");
        
        var end = new Date();
        
        var time = end - start;
        
        console.log("\nmilliseconds: #%d", time);
        console.log("seconds:      #%d", (time / 1000));
        
        
        if (result)
        {
            for (var a=0; a<result.length; a++)
            {
                console.log("Res: %s", result[a]);
            }
        }
    }); */
    
});

