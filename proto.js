
var xtr = require("./index.js");

var examplePath = "examples/Cosmos.pdf";
var docID = "Cosmos.pdf";

xtr.actor.load(examplePath, docID, function()
{
    console.log("Document was processed");
});


