var Word_initWord;

var Word_updateFromHTML;

var Word_getHTML;
var Word_putHTML;

var Word_document;
var Word_numbering;
var Word_styles;

var Word_documentXML;
var Word_numberingXML;
var Word_stylesXML;

(function() {

    var docx = new Object();
    var documentLens;

    var WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

    function Run_get(con)
    {
        var rPr = firstChildElement(con);
        rPr = ((rPr != null) && rPr._isrPr) ? rPr : null;

        var content = "";
        for (var conChild = con.firstChild; conChild != null; conChild = conChild.nextSibling) {
            if (conChild._ist)
                content += getNodeText(conChild);
        }

        var node = DOM_createTextNode(document,content);

        if ((rPr != null) && rPr._isrPr) {
            if (rPr._childu)
                node = DOM_wrapNode(node,"U");
            if (rPr._childi)
                node = DOM_wrapNode(node,"I");
            if (rPr._childb)
                node = DOM_wrapNode(node,"B");
        }

        return node;
    }

    function Paragraph_getStyleProperties(con)
    {
        
    }

    function Paragraph_getStyleProperties(con)
    {
        var styleProperties = new Object();

        // A pPr is optional, but if it is present, it is the first element
        var first = firstChildElement(con);
        if ((first != null) && (first._ispPr)) {
            var pPr = first;
            if (pPr._childpStyle != null) {
                var val =  pPr._childpStyle.getAttributeNS(WORD_NAMESPACE,"val");
                if (val == "Heading1")
                    stylePropertes["uxwrite-style"] = "H1";
                else if (val == "Heading2")
                    stylePropertes["uxwrite-style"] = "H2";
                else if (val == "Heading3")
                    stylePropertes["uxwrite-style"] = "H3";
                else if (val == "Heading4")
                    stylePropertes["uxwrite-style"] = "H4";
                else if (val == "Heading5")
                    stylePropertes["uxwrite-style"] = "H5";
                else if (val == "Heading6")
                    stylePropertes["uxwrite-style"] = "H6";
            }
            if (pPr._childjc != null) {
                var jc = pPr._childjc.getAttributeNS(WORD_NAMESPACE,"val");
                if ((jc == "both") || (jc == "distribute"))
                    styleProperties["text-align"] = "justify";
                else if (jc == "center")
                    styleProperties["text-align"] = "center";
                else if ((jc == "start") || (jc == "left"))
                    styleProperties["text-align"] = "left";
                else if ((jc == "end") || (jc == "right"))
                    styleProperties["text-align"] = "right";
            }
        }

        return styleProperties;
    }

    var deleteIfNoChildElements = trace(function deleteIfNoChildElements(node)
    {
        if (node != null) {
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                if (child.nodeType == Node.ELEMENT_NODE)
                    return;
            }
            DOM_deleteNode(node);
        }
    });

    var getNamedChildNS = trace(function getNamedChildNS(parent,childNS,childQName,create)
    {
        var childLocalName = childQName.replace(/^.*:/,"");
        for (var child = parent.firstChild; child != null; child = child.nextSibling) {
            if ((child.namespaceURI == childNS) && (child.localName == childLocalName)) {
                return child;
            }
        }
        var child = DOM_createElementNS(parent.ownerDocument,childNS,childQName);
        DOM_insertBefore(parent,child,parent.firstChild);
        return child;
    });

    var setChildAttributeNS= trace(function setChildAttributeNS(parent,
                                                                childNS,childQName,
                                                                attrNS,attrQName,
                                                                value)
    {
        var child = getNamedChildNS(parent,childNS,childQName,true);
        DOM_setAttributeNS(child,attrNS,attrQName,value);
    });

    var removeChildAttributeNS = trace(function removeChildAttributeNS(parent,
                                                                       childNS,childLocalName,
                                                                       attrNS,attrLocalName,
                                                                       deleteIfNoAttributes)
    {
        var child = getNamedChildNS(parent,childNS,childLocalName,false);
        if (child != null) {
            DOM_removeAttributeNS(child,attrNS,attrLocalName);
            if (deleteIfNoAttributes && (child.attributes.length == 0))
                DOM_deleteNode(child);
        }
    });

    var Paragraph_get = trace(function Paragraph_get(con)
    {
        var styleProperties = Paragraph_getStyleProperties(con);


        var nodeName = styleProperties["uxwrite-style"];
        delete styleProperties["uxwrite-style"];
        if (nodeName == null)
            nodeName = "P";

        var abs = DOM_createElement(document,nodeName);
        abs._source = con;
        //    if ((style != null) && (nodeName == "P"))
        //        DOM_setAttribute(style,"class","style"); // FIXME: test
        DOM_setStyleProperties(abs,styleProperties);

        for (var conChild = con.firstChild; conChild != null; conChild = conChild.nextSibling) {
            if (conChild._isr)
                DOM_appendChild(abs,Run_get(conChild));
        }


        return abs;
    });

    var Paragraph_put = trace(function Paragraph_put(abs,con)
    {
        var absStyleProperties = DOM_getStyleProperties(abs);
        var conStyleProperties = Paragraph_getStyleProperties(con);
        var pPr = getNamedChildNS(con,WORD_NAMESPACE,"w:pPr",false);

        if (absStyleProperties["text-align"] != conStyleProperties["text-align"]) {
            var textAlign = absStyleProperties["text-align"];
            if (textAlign == "left")
                setpPrAttribute("jc","val","left");
            else if (textAlign == "center")
                setpPrAttribute("jc","val","center");
            else if (textAlign == "right")
                setpPrAttribute("jc","val","right");
            else if (textAlign == "justify")
                setpPrAttribute("jc","val","both");
            else
                removepPrAttribute("jc","val");
        }

        deleteIfNoChildElements(pPr);

        function setpPrAttribute(elementName,attrName,value)
        {
            if (pPr == null)
                pPr = getNamedChildNS(con,WORD_NAMESPACE,"w:pPr",true);
            setChildAttributeNS(pPr,
                                WORD_NAMESPACE,"w:"+elementName,
                                WORD_NAMESPACE,"w:"+attrName,
                                value);
        }

        function removepPrAttribute(elementName,attrName)
        {
            if (pPr != null) {
                removeChildAttributeNS(pPr,
                                       WORD_NAMESPACE,elementName,
                                       WORD_NAMESPACE,attrName,
                                       true);
            }
        }
    });

    function ContentLens()
    {
    }

    ContentLens.prototype.get = trace(function ContentLens_get(con)
    {
        return Paragraph_get(con);
    });

    ContentLens.prototype.put = trace(function ContentLens_put(abs,con)
    {
        return Paragraph_put(abs,con);
    });

    ContentLens.prototype.create = trace(function ContentLens_create(abs,conDocument)
    {
        if (abs.nodeType == Node.ELEMENT_NODE) {
            debug("ContentLens create: conDocument = "+conDocument+
                  ", abs = "+nodeString(abs)+" (content "+
                  JSON.stringify(getNodeText(abs))+")");
            var wp = DOM_createElementNS(conDocument,WORD_NAMESPACE,"w:p");
            var wr = DOM_createElementNS(conDocument,WORD_NAMESPACE,"w:r");
            var wt = DOM_createElementNS(conDocument,WORD_NAMESPACE,"w:t");
            var text = DOM_createTextNode(conDocument,getNodeText(abs));
            DOM_appendChild(wp,wr);
            DOM_appendChild(wr,wt);
            DOM_appendChild(wt,text);
            return wp;
        }
        return null;
    });

    ContentLens.prototype.isVisible = function(con)
    {
        return con._isp;
    };

    function BodyLens()
    {
        this.contentLens = new ContentLens();
    }

    BodyLens.prototype.get = trace(function BodyLens_get(con) {
        var abs = DOM_createElement(document,"BODY");
        abs._source = abs;

        for (var cchild = con.firstChild; cchild != null; cchild = cchild.nextSibling) {
            if (this.contentLens.isVisible(cchild))
                DOM_appendChild(abs,this.contentLens.get(cchild));
        }

        return abs;
    });

    BodyLens.prototype.put = trace(function BodyLens_put(abs,con) {
        BDT_Container_put(abs,con,this.contentLens);
        // sectPr element has to go at end
        if (con._childsectPr != null)
            DOM_appendChild(con,con._childsectPr);
    });

    function DocumentLens()
    {
        this.bodyLens = new BodyLens();
    }

    DocumentLens.prototype.get = trace(function DocumentLens_get(con)
    {
        var abs = DOM_createElement(document,"HTML");
        abs._source = con;
        DOM_appendChild(abs,this.bodyLens.get(con._childbody));
        return abs;
    });

    DocumentLens.prototype.put = trace(function DocumentLens_put(abs,con)
    {
//        debug("DocumentLens.put: abs = "+nodeString(abs));
//        debug("DocumentLens.put: con = "+nodeString(con));
        var htmlBody = null;
        for (var absChild = abs.firstChild; absChild != null; absChild = absChild.nextSibling) {
            if (DOM_upperName(absChild) == "BODY") {
                htmlBody = absChild;
            }
        }
//        debug("DocumentLens.put: htmlBody = "+nodeString(htmlBody));
        this.bodyLens.put(htmlBody,con._childbody);
    });

    function assignShorthandProperties(node)
    {
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            assignShorthandProperties(child);
            if ((child.nodeType == Node.ELEMENT_NODE) &&
                (child.namespaceURI == WORD_NAMESPACE)) {
                node["_child"+child.localName] = child;
            }
        }
        if ((node.nodeType == Node.ELEMENT_NODE) && (node.namespaceURI == WORD_NAMESPACE)) {
            node["_is"+node.localName] = true;
        }
    }

    function removeAttributes(node,names)
    {
        if (node.nodeType == Node.ELEMENT_NODE) {
            for (var i = 0; i < names.length; i++)
                node.removeAttribute(names[i]);
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                removeAttributes(child,names);
        }
    }

    function firstChildNamed(parent,name)
    {
        for (var child = parent.firstChild; child != null; child = child.nextSibling) {
            if (child.nodeName == name)
                return child;
        }
        return null;
    }

    function readFileApp(filename)
    {
        var req = new XMLHttpRequest("file:///read/"+filename);
        req.open("POST","/read/"+encodeURI(filename),false);
        req.send();
//        debug("req.status = "+req.status);
        if (req.status == 404)
            return null; // file not found
        else if ((req.status != 200) && (req.status != 0))
            throw new Error(req.status+": "+req.responseText);
        var doc = req.responseXML;
        if (doc != null)
            DOM_assignNodeIds(doc);
        return doc;
    }

    function readFileTest(filename)
    {
        var req = new XMLHttpRequest();
        req.open("GET",filename,false);
        req.send();         
        var xml = req.responseXML;
        if (xml == null)
            return null;
        DOM_assignNodeIds(xml.documentElement);
        return xml;
    }

    // public
    Word_initWord = trace(function initWord(filename)
    {
        var wordDir;
        var readFun;
        if (filename == null) {
            wordDir = "word";
            readFun = readFileApp;
        }
        else {
            wordDir = filename+"/word";
            readFun = readFileTest;
        }
        docx.document = readFun(wordDir+"/document.xml");
        if (docx.document == null)
            throw new Error("Cannot read "+wordDir+"/document.xml")
        assignShorthandProperties(docx.document.documentElement);
        docx.numbering = readFun(wordDir+"/numbering.xml");
        docx.styles = readFun(wordDir+"/styles.xml");
        documentLens = new DocumentLens();
        convertToHTML();
    });

    var convertToHTML = trace(function convertToHTML()
    {
        var html = documentLens.get(docx.document.documentElement);;
        var body = html.firstChild;
        var next;
        for (var child = body.firstChild; child != null; child = next) {
            next = child.nextSibling;
            DOM_appendChild(document.body,child);
        }
        debug("------------------- convertToHTML BEGIN ----------------------");
        printTree(document.documentElement);
        debug("------------------- convertToHTML END ----------------------");
        return true;
    });

    Word_updateFromHTML = trace(function updateFromHTML()
    {
        documentLens.put(document.documentElement,docx.document.documentElement);

        debug("------------------- updateFromHTML BEGIN ----------------------");
        printTree(document.documentElement);
        debug("------------------- updateFromHTML END ----------------------");
        debug("updateFromHTML: word document:");
        debug(PrettyPrinter.getHTML(docx.document.documentElement,
                                    { preserveCase: true, separateLines: true }));
        return true;
    });

    Word_getHTML = trace(function getHTML()
    {
        return documentLens.get(docx.document.documentElement);
    });

    Word_putHTML = trace(function putHTML(html)
    {
        documentLens.put(html,docx.document.documentElement);
    });

    function serialize(xmlDocument)
    {
        if (xmlDocument == null)
            return null;
        else
            return new XMLSerializer().serializeToString(xmlDocument);
    }

    Word_document = function() {
        return docx.document;
    };

    Word_numbering = function() {
        return docx.numbering;
    };

    Word_styles = function() {
        return docx.styles;
    };

    // public
    Word_documentXML = trace(function documentXML()
    {
        return serialize(docx.document);
    });

    // public
    Word_numberingXML = trace(function numberingXML()
    {
        return serialize(docx.numbering);
    });

    // public
    Word_stylesXML = trace(function stylesXML()
    {
        return serialize(docx.styles);
    });

})();
