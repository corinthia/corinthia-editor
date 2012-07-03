// FIXME: in some places we use the w: prefix when creating elements. Need to make sure we use
// whatever prefix is in the XML file instead

var WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function print(str)
{
    var pre = DOM_createElement(document,"PRE");
    var text = DOM_createTextNode(document,str);
    DOM_appendChild(pre,text);
    DOM_appendChild(document.body,pre);
}

function debug(str)
{
    console.log(str);
}

function transform(abs)
{
    var body = firstChildNamed(abs,"BODY");
//    DOM_insertBefore(body,body.childNodes[4],body.childNodes[0]);


/*
    body.childNodes[0].style.textAlign = "left";
    body.childNodes[1].style.textAlign = "right";
    body.childNodes[2].style.textAlign = "left";
    body.childNodes[3].style.textAlign = "justify";
    body.childNodes[4].style.textAlign = "right";

    body.childNodes[0].style.textAlign = null;
    body.childNodes[1].style.textAlign = null;
    body.childNodes[2].style.textAlign = null;
    body.childNodes[3].style.textAlign = null;
    body.childNodes[4].style.textAlign = null;
*/


    var value = null;

    DOM_setStyleProperties(body.childNodes[0],{"text-align": value});
    DOM_setStyleProperties(body.childNodes[1],{"text-align": value});
    DOM_setStyleProperties(body.childNodes[2],{"text-align": value});
    DOM_setStyleProperties(body.childNodes[3],{"text-align": value});
    DOM_setStyleProperties(body.childNodes[4],{"text-align": value});

}

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
        debug("rPr = "+nodeString(rPr));
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

function Paragraph_get(con)
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
    debug("Paragraph_get: styleProperties = "+JSON.stringify(styleProperties));

    for (var conChild = con.firstChild; conChild != null; conChild = conChild.nextSibling) {
        if (conChild._isr)
            DOM_appendChild(abs,Run_get(conChild));
    }


    return abs;
}


function deleteIfNoChildElements(node)
{
    if (node != null) {
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            if (child.nodeType == Node.ELEMENT_NODE)
                return;
        }
        DOM_deleteNode(node);
    }
}

function getNamedChildNS(parent,childNS,childQName,create)
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
}

function setChildAttributeNS(parent,
                             childNS,childQName,
                             attrNS,attrQName,
                             value)
{
    var child = getNamedChildNS(parent,childNS,childQName,true);
    DOM_setAttributeNS(child,attrNS,attrQName,value);
}

function removeChildAttributeNS(parent,
                                childNS,childLocalName,
                                attrNS,attrLocalName,
                                deleteIfNoAttributes)
{
//    debug("removeChildAttributeNS "+[childNS,childLocalName,
//                                     attrNS,attrLocalName,
//                                     deleteIfNoAttributes]);

    var child = getNamedChildNS(parent,childNS,childLocalName,false);
    if (child != null) {
        debug("before remove: child = "+new XMLSerializer().serializeToString(child));
        DOM_removeAttributeNS(child,attrNS,attrLocalName);
        debug("after remove: child = "+new XMLSerializer().serializeToString(child));
        if (deleteIfNoAttributes && (child.attributes.length == 0))
            DOM_deleteNode(child);
    }
}

function Paragraph_put(abs,con)
{
    var absStyleProperties = DOM_getStyleProperties(abs);
    var conStyleProperties = Paragraph_getStyleProperties(con);
    var pPr = getNamedChildNS(con,WORD_NAMESPACE,"w:pPr",false);

    debug("Paragraph put: con text-align "+conStyleProperties["text-align"]+
          ", abs text-align "+absStyleProperties["text-align"]);


    if (absStyleProperties["text-align"] != conStyleProperties["text-align"]) {
        debug("-- different");
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
}

function ContentLens()
{
}

ContentLens.prototype.get = function(con)
{
    return Paragraph_get(con);
};

ContentLens.prototype.put = function(abs,con)
{
    return Paragraph_put(abs,con);
};

ContentLens.prototype.isVisible = function(con)
{
    return con._isp;
};

function BodyLens()
{
    this.contentLens = new ContentLens();
}

BodyLens.prototype.get = function(con) {
    var abs = DOM_createElement(document,"BODY");
    abs._source = abs;

    for (var cchild = con.firstChild; cchild != null; cchild = cchild.nextSibling) {
        if (this.contentLens.isVisible(cchild))
            DOM_appendChild(abs,this.contentLens.get(cchild));
    }

    return abs;
};

BodyLens.prototype.put = function(abs,con) {
    BDT_Container_put(abs,con,this.contentLens);
    // sectPr element has to go at end
    if (con._childsectPr != null)
        DOM_appendChild(con,con._childsectPr);
};

function DocumentLens()
{
    this.bodyLens = new BodyLens();
}

DocumentLens.prototype.get = function(con)
{
    var abs = DOM_createElement(document,"HTML");
    abs._source = con;
    DOM_appendChild(abs,this.bodyLens.get(con._childbody));
    return abs;
}

DocumentLens.prototype.put = function(abs,con)
{
    var htmlBody = null;
    for (var absChild = abs.firstChild; absChild != null; absChild = absChild.nextSibling) {
        if (DOM_upperName(absChild) == "BODY") {
            htmlBody = absChild;
        }
    }
    this.bodyLens.put(htmlBody,con._childbody);
}


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
//        for (var i = 0; i < node.attributes.length; i++)
//            debug("attr "+node.attributes[i].localName);
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

function main()
{
    DOM_assignNodeIds(document.documentElement);
    print("Conversion");

    var baseFilename = "test1";
    var printOptions = { preserveCase: true };

    var wordDocument = readXML(baseFilename+"/word/document.xml");
    assignShorthandProperties(wordDocument.documentElement);
    var documentLens = new DocumentLens();

    var abs = documentLens.get(wordDocument.documentElement);
    print(PrettyPrinter.getHTML(abs,printOptions));

    transform(abs);
    print(PrettyPrinter.getHTML(abs));

    documentLens.put(abs,wordDocument.documentElement);

    removeAttributes(wordDocument.documentElement,
                     ["w14:paraId","w14:textId","w:rsidP","w:rsidR","w:rsidRDefault",
                      "mc:Ignorable","w:rsidRPr","w:rsidSect"]);
    print(PrettyPrinter.getHTML(wordDocument.documentElement,printOptions));
}
