
// [todo] - Completely rework correlation function within the page

/* Which data structures are added to the DB?
 * There are three types of structures:
 * 1) term     =>  doc:page             [sadd]
 * 2) doc:page =>  term(score)          [zadd]
 * 3) doc      =>  term(doc-wide-score) [zadd]
 */


// REQUIRES
var terms  = require("./terms.js");
var Loader = require("./loader.js");
var Search = require("./search.js");


// MAIN CLASS CODE
var PDFix = function()
{
    var options = {"terms": terms};
    
    this.terms  = terms;
    this.loader = new Loader(options);
    this.search = new Search(options);
};


// MODULE EXPORT
module.exports = new PDFix();


