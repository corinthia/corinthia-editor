(function() {

    var docx = new Object();

    var WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

    function isWordElement(node,name)
    {
        return (node.namespaceURI == WORD_NAMESPACE) && (node.localName == name);
    }

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
        var doc = req.responseXML;
        if (doc != null)
            DOM.assignNodeIds(doc);
        return doc;
    }

    function parseT(word,htmlP)
    {
        for (var child = word.firstChild; child != null; child = child.nextSibling) {
            debug("parseT: child is "+nodeString(child));
            if (child.nodeType == Node.TEXT_NODE) {
                var htmlText = DOM.createTextNode(document,child.nodeValue);
                DOM.appendChild(htmlP,htmlText);

                var thisChild = child;

                htmlText.addEventListener("DOMCharacterDataModified",function() {
                    debug("Detected change in character data: "+htmlText.nodeValue);
                    thisChild.nodeValue = htmlText.nodeValue;
                });

            }
        }
    }

    function parseR(word,htmlP)
    {
        for (var child = word.firstChild; child != null; child = child.nextSibling) {
            debug("parseR: child is "+nodeString(child));
            if (isWordElement(child,"t"))
                parseT(child,htmlP);
        }
    }

    function parseP(word,htmlContainer)
    {
        var htmlP = DOM.createElement(document,"P");
        DOM.appendChild(htmlContainer,htmlP);
        for (var child = word.firstChild; child != null; child = child.nextSibling) {
            debug("parseP: child is "+nodeString(child));
            if (isWordElement(child,"r"))
                parseR(child,htmlP);
        }
    }

    function parseBody(word,htmlBody)
    {
        for (var child = word.firstChild; child != null; child = child.nextSibling) {
            debug("parseBody: child is "+nodeString(child));
            if (isWordElement(child,"p"))
                parseP(child,htmlBody);
        }
    }

    function parseDocument(word,htmlBody)
    {
        for (var child = word.firstChild; child != null; child = child.nextSibling) {
            debug("parseDocument: child is "+nodeString(child));
            if (isWordElement(child,"body"))
                parseBody(child,htmlBody);
        }
    }

    // public
    function initWord()
    {
        debug("This is Word.initWord()");
        docx.document = readFile("word/document.xml");
        docx.numbering = readFile("word/numbering.xml");
        docx.styles = readFile("word/styles.xml");
        debug("docx.document = "+docx.document);
        debug("docx.numbering = "+docx.numbering);
        debug("docx.styles = "+docx.styles);

        parseDocument(docx.document.documentElement,document.body);
/*
        recurse(docx.document);

        function recurse(node)
        {
            if (isWordElement(node,"t")) {
                var text = DOM.createTextNode(docx.document,"MODIFIED ");
                DOM.insertBefore(node,text,node.firstChild);
                debug(nodeString(node));
            }
            else {
                for (var child = node.firstChild; child != null; child = child.nextSibling)
                    recurse(child);
            }
        }
*/
    }

    function serialize(xmlDocument)
    {
        if (xmlDocument == null)
            return null;
        else
            return new XMLSerializer().serializeToString(xmlDocument);
    }

    // public
    function documentXML()
    {
        debug("JS: documentXML");
        return serialize(docx.document);
    }

    // public
    function numberingXML()
    {
        return serialize(docx.numbering);
    }

    // public
    function stylesXML()
    {
        return serialize(docx.styles);
    }

    window.Word = new (function Word(){});
    Word.initWord = trace(initWord);
    Word.documentXML = trace(documentXML);
    Word.numberingXML = trace(numberingXML);
    Word.stylesXML = trace(stylesXML);

})();
