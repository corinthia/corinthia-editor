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

    var nodePropertiesCache = null;
    var stringPropertiesCache = null;
    var attributedCharCache = null;
    var attributedCharRevCache = null;
    var attributedCharNextId = null;

    var resetCaches = trace(function resetCaches()
    {
        nodePropertiesCache = new NodeMap();
        stringPropertiesCache = new NodeMap();
        attributedCharCache = new Object();
        attributedCharRevCache = new Object();
        attributedCharNextId = 0;
    });

    var getNodeProperties = trace(function getNodeProperties(node)
    {
        if ((node == null) || !isInlineNode(node))
            return new Object();

        var properties = nodePropertiesCache.get(node);
        if (properties != null)
            return properties;

        properties = new Object();

        var parentProperties = getNodeProperties(node.parentNode);
        for (var name in parentProperties)
            properties[name] = parentProperties[name];

        if (node.nodeType == Node.ELEMENT_NODE) {
            for (var i = 0; i < node.style.length; i++) {
                var name = node.style[i];
                var value = node.getPropertyValue(name);
                properties[name] = value;
            }
            var upperName = DOM_upperName(node);
            if (upperName == "B")
                properties["font-weight"] = "bold";
            else if (upperName == "I")
                properties["font-style"] = "italic";
            else if (upperName == "U") // FIXME: handle other text-decoration values
                properties["text-decoration"] = "underline";
        }
        nodePropertiesCache.put(node,properties);
        return properties;
    });

    var getStringProperties = trace(function getStringProperties(node)
    {
        var str = stringPropertiesCache.get(node);
        if (str != null)
            return str;

        var properties = getNodeProperties(node);
        str = Styles_getPropertiesText(properties).trim().replace(/\s+/g," ");
        stringPropertiesCache.put(node,str);
        return str;
    });

    var getAttributedCharKey = trace(function getAttributedCharKey(node,offset)
    {
        var stringProperties = getStringProperties(node.parentNode);
        var character = node.nodeValue.charAt(offset);
        return character+":"+stringProperties;
    });

    var getAttributedChar = trace(function getAttributedChar(node,offset)
    {
        var key = getAttributedCharKey(node,offset);
        var entry = attributedCharCache[key];
        if (entry != null)
            return entry;
        var id = attributedCharNextId++;
        attributedCharCache[key] = id;
        attributedCharRevCache[id] = key;
        return id;
    });




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
        node._source = con;

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

    var getParagraphAttributedChars = trace(function getParagraphAttributedChars(paragraph)
    {
        var attributed = new Array();
        for (var i = 0; i < paragraph.runs.length; i++) {
            var run = paragraph.runs[i];
            for (var runOffset = 0; runOffset < run.node.nodeValue.length; runOffset++)
                attributed.push(getAttributedChar(run.node,runOffset));
        }
        return attributed;
    });

    var Paragraph_put = trace(function Paragraph_put(abs,con)
    {
        var absStyleProperties = DOM_getStyleProperties(abs);
        var conStyleProperties = Paragraph_getStyleProperties(con);
        var pPr = getNamedChildNS(con,WORD_NAMESPACE,"w:pPr",false);

        debug("Paragraph_put: abs = "+nodeString(abs));
        printTree(abs);
        debug("");

//        debug("Paragraph_put: con = "+nodeString(con));
//        printTree(con);
//        debug("");

        var orig = Paragraph_get(con);
        debug("Paragraph_put: orig = "+orig);
        printTree(orig);
        debug("");

/*
        var paragraph = Text_analyseParagraph(new Position(abs,0));
        var attributed = getParagraphAttributedChars(paragraph);
        debug("paragraph.runs.length = "+paragraph.runs.length);
        debug("paragraph.text.length = "+paragraph.text.length);
        debug("attributed.length = "+attributed.length);
        for (var i = 0; i < attributed.length; i++) {
            debug("attributed["+i+"] = "+attributed[i]+" "+
                  attributedCharRevCache[attributed[i]]);
        }
        return;
*/

        var oldPara = Text_analyseParagraph(new Position(orig,0));
        var newPara = Text_analyseParagraph(new Position(abs,0));
        debug("oldPara.text = "+JSON.stringify(oldPara.text));
        debug("newPara.text = "+JSON.stringify(newPara.text));

        var oldAttr = getParagraphAttributedChars(oldPara);
        var newAttr = getParagraphAttributedChars(newPara);


        var modifiedTextNodes = new NodeSet();

//        var changes = diff(oldPara.text,newPara.text);
        var changes = diff(oldAttr,newAttr);
        changes.splice(0,0,{srcStart: 0, srcEnd: 0, destStart: 0, destEnd: 0});
        debug("changes = "+changes);
        var srcPos = oldPara.text.length;
        var destPos = newPara.text.length;

        for (var i = 0; i < changes.length; i++) {
            var entry = changes[i];
            debug("changes["+i+"]: "+
                  "src "+entry.srcStart+"-"+entry.srcEnd+
                  " dest "+entry.destStart+"-"+entry.destEnd);
        }

        for (var i = changes.length-1; i >= 0; i--) {
            var entry = changes[i];
            debug("src "+entry.srcStart+"-"+entry.srcEnd+
                  " dest "+entry.destStart+"-"+entry.destEnd);
            if ((entry.srcEnd < srcPos) &&
                (entry.destEnd < destPos)) {
                var deletionText = oldPara.text.substring(entry.srcEnd,srcPos);
                var insertionText = newPara.text.substring(entry.destEnd,destPos);
                debug("Replace "+JSON.stringify(deletionText)+
                      " with "+JSON.stringify(insertionText));



                var insertionOffset = insertionText.length;
                var endOffset = srcPos;
                var startOffset = entry.srcEnd;
                debug("startOffset = "+startOffset+", endOffset = "+endOffset);

                while (endOffset > startOffset) {
                    var textPos = Paragraph_positionAtOffset(oldPara,endOffset,true);
                    var run = Paragraph_runFromOffset(oldPara,endOffset,true);

                    var relEndOffset = endOffset - run.start;
                    var relStartOffset = startOffset - run.start;

                    if (relStartOffset < 0)
                        relStartOffset = 0;

                    var numChars = (relEndOffset - relStartOffset);

                    debug(textPos+" ("+relStartOffset+" to "+relEndOffset+", "+numChars+" chars)");

                    var insertionStart = insertionOffset - numChars;
                    var insertionEnd = insertionOffset;

                    if (endOffset - numChars == startOffset)
                        insertionStart = 0;


                    DOM_replaceCharacters(run.node,
                                          relStartOffset,
                                          relEndOffset,
                                          insertionText.substring(insertionStart,
                                                                  insertionEnd));
                    modifiedTextNodes.add(textPos.node);
                    insertionOffset -= numChars;
                    endOffset -= numChars;
                }
            }
            else if (entry.srcEnd < srcPos) {
                var deletionText = oldPara.text.substring(entry.srcEnd,srcPos);
                debug("Delete "+JSON.stringify(deletionText));


                var deleteSrcStart = entry.srcEnd;
                var deleteSrcEnd = srcPos;

                var tmpSrcOffset = deleteSrcEnd;
                while (tmpSrcOffset > deleteSrcStart) {
                    var textPos = Paragraph_positionAtOffset(oldPara,tmpSrcOffset,true);
                    var numCharsToDelete = tmpSrcOffset - deleteSrcStart;
                    if (numCharsToDelete > textPos.offset)
                        numCharsToDelete = textPos.offset;
                    DOM_deleteCharacters(textPos.node,
                                         textPos.offset-numCharsToDelete,
                                         textPos.offset);

                    modifiedTextNodes.add(textPos.node);
                    tmpSrcOffset -= numCharsToDelete;
                }

            }
            else if (entry.destEnd < destPos) {
                var insertionText = newPara.text.substring(entry.destEnd,destPos);
                debug("Insert "+JSON.stringify(insertionText));

                var numCharsToInsert = destPos - entry.destEnd;

                var textPos = Paragraph_positionAtOffset(oldPara,srcPos);
                var innerOffset = textPos.offset; // FIXME
                DOM_insertCharacters(textPos.node,innerOffset,insertionText);
                modifiedTextNodes.add(textPos.node);

            }
            else {
            }
            srcPos = entry.srcStart;
            destPos = entry.destStart;
        }

        modifiedTextNodes.forEach(function(node) {
            if (node._source == null)
                throw new Error("Can't find source for text node");
            var run = node._source;
            var next;
            for (child = run.firstChild; child != null; child = next) {
                next = child.nextSibling;
                if (child._ist) {
                    DOM_deleteNode(child);
                }
            }
            if (node.nodeValue.length == 0) {
                DOM_deleteNode(run);
            }
            else {
                debug("replacement: "+JSON.stringify(node.nodeValue));
                var t = DOM_createElementNS(run.ownerDocument,WORD_NAMESPACE,"w:t");
                DOM_appendChild(run,t);
                DOM_appendChild(t,DOM_createTextNode(run.ownerDocument,node.nodeValue));
                assignShorthandProperties(t);
            }
        });

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

    ContentLens.prototype.getSource = function(abs) {
        return abs._source;
    };

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

    BodyLens.prototype.getSource = function(abs) {
        return abs._source;
    };

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

    DocumentLens.prototype.getSource = function(abs) {
        return abs._source;
    };

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
/*
        debug("------------------- convertToHTML BEGIN ----------------------");
        printTree(document.documentElement);
        debug("------------------- convertToHTML END ----------------------");
*/
        return true;
    });

    Word_updateFromHTML = trace(function updateFromHTML()
    {
        resetCaches();
        documentLens.put(document.documentElement,docx.document.documentElement);

/*
        if (window.PrettyPrinter != null) {
            debug("------------------- updateFromHTML BEGIN ----------------------");
            printTree(document.documentElement);
            debug("------------------- updateFromHTML END ----------------------");
            debug("updateFromHTML: word document:");
            debug(PrettyPrinter.getHTML(docx.document.documentElement,
                                        { preserveCase: true, separateLines: true }));
        }
*/
        return true;
    });

    Word_getHTML = trace(function getHTML()
    {
        resetCaches();
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
