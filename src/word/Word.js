(function() {

    function readFile(filename)
    {
        var req = new XMLHttpRequest("file:///read/"+filename);
        req.open("POST","/read/"+encodeURI(filename),false);
        req.send();
        debug("req.status = "+req.status);
        if (req.status == 404)
            return null; // file not found
        else if ((req.status != 200) && (req.status != 0))
            throw new Error(req.status+": "+req.responseText);
//        return req.responseXML;
        return req.responseText;
    }

    // public
    function testWord()
    {
        debug("This is Word.testWord()");
        var doc = readFile("word/document.xml");
        debug("doc = "+doc);
    }

    window.Word = new (function Word(){});
    Word.testWord = trace(testWord);

    debug("Processed Word.js");

})();
