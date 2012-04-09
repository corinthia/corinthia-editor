(function() {

    var docx = new Object();

    var WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

    function isWordElement(node,name)
    {
        return (node.namespaceURI == WORD_NAMESPACE) && (node.localName == name);
    }

    function getChild(node,name)
    {
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            if (isWordElement(child,name))
                return child;
        }
        return null;
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

    var parseT = trace(function parseT(wordT,htmlP)
    {
        for (var child = wordT.firstChild; child != null; child = child.nextSibling) {
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
    });

    var parseR = trace(function parseR(wordR,htmlP)
    {
        for (var child = wordR.firstChild; child != null; child = child.nextSibling) {
            if (isWordElement(child,"t"))
                parseT(child,htmlP);
        }
    });

    function setWordPStyle(wordP,style)
    {
        debug("setWordPStyle "+style);
        var pPr = getChild(wordP,"pPr");
        debug("pPr = "+pPr);
        if (pPr != null) {
            var pStyle = getChild(pPr,"pStyle");
            debug("pStyle = "+pStyle);
            if (pStyle != null) {
                pStyle.setAttributeNS(WORD_NAMESPACE,"val",style);
            }
        }
        
    }

    var parseP = trace(function parseP(wordP,htmlContainer)
    {
        var paragraphType = "P";

        var pPr = getChild(wordP,"pPr");
        debug("pPr = "+pPr);

        if (pPr != null) {
            var pStyle = getChild(pPr,"pStyle");
            debug("pStyle = "+pStyle);
            if (pStyle != null) {
                var val = pStyle.getAttribute("val");
                debug("paragraph style = "+val);
                var val2 = pStyle.getAttributeNS(WORD_NAMESPACE,"val");
                debug("paragraph style 2 = "+val2);

                if (val2 == "Heading1")
                    paragraphType = "H1";
                else if (val2 == "Heading2")
                    paragraphType = "H2";
                else if (val2 == "Heading3")
                    paragraphType = "H3";
                else if (val2 == "Heading4")
                    paragraphType = "H4";
                else if (val2 == "Heading5")
                    paragraphType = "H5";
                else if (val2 == "Heading6")
                    paragraphType = "H6";
            }
        }

        var htmlP = DOM.createElement(document,paragraphType);
        DOM.appendChild(htmlContainer,htmlP);

        var listener = new DOM.Listener();
        listener.afterReplaceElement = function(oldElement,newElement) {
            debug("Detected replacement of "+oldElement.nodeName+" with "+newElement.nodeName);

            if (DOM.upperName(newElement) == "H1")
                setWordPStyle(wordP,"Heading1");
            else if (DOM.upperName(newElement) == "H2")
                setWordPStyle(wordP,"Heading2");
            else if (DOM.upperName(newElement) == "H3")
                setWordPStyle(wordP,"Heading3");
            else if (DOM.upperName(newElement) == "H4")
                setWordPStyle(wordP,"Heading4");
            else if (DOM.upperName(newElement) == "H5")
                setWordPStyle(wordP,"Heading5");
            else if (DOM.upperName(newElement) == "H6")
                setWordPStyle(wordP,"Heading6");
        };
        DOM.addListener(htmlP,listener);

        for (var child = wordP.firstChild; child != null; child = child.nextSibling) {
            if (isWordElement(child,"r"))
                parseR(child,htmlP);
        }
    });

    var parseBody = trace(function parseBody(wordBody,htmlBody)
    {
        for (var child = wordBody.firstChild; child != null; child = child.nextSibling) {
            if (isWordElement(child,"p"))
                parseP(child,htmlBody);
        }
    });

    var parseDocument = trace(function parseDocument(wordDocument,htmlBody)
    {
        for (var child = wordDocument.firstChild; child != null; child = child.nextSibling) {
            if (isWordElement(child,"body"))
                parseBody(child,htmlBody);
        }
    });

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
