function findMatchingChild(parent,childName)
{
    for (var child = parent.firstChild; child != null; child = child.nextSibling) {
        if (child.nodeName == childName)
            return child;
    }
    return null;
}

function getOrCreateChild(doc,parent,childName)
{
    var result = findMatchingChild(parent,childName);
    if (result == null) {
        result = DOM_createElement(doc,childName);
        DOM_appendChild(parent,result);
    }
    return result;
}


ParagraphLens = new Object();

ParagraphLens.get = function(source)
{
    var result = DOM_createElement(document,"P");
    result._source = source;
    for (var child = source.firstChild; child != null; child = child.nextSibling) {
        if (child.nodeName == "props") {
            for (var gc = child.firstChild; gc != null; gc = gc.nextSibling) {
                if (gc.nodeName == "font-size") {
                    DOM_setStyleProperties(result,{"font-size": getNodeText(gc)});
                }
                else if (gc.nodeName == "color") {
                    DOM_setStyleProperties(result,{"color": getNodeText(gc)});
                }
            }
        }
        else {
            var text = getNodeText(child);
            var textNode = DOM_createTextNode(document,text);
            DOM_appendChild(result,textNode);
        }
    }
    return result;
};

ParagraphLens.put = function(source,target)
{
    var props = null;
    for (var i = 0; i < target.style.length; i++) {
        var name = target.style[i];
        var value = target.style.getPropertyValue(name);
        debug("CSS property: "+name+" = "+value);

        if (props == null)
            props = getOrCreateChild(source.ownerDocument,source,"props");
        if (name == "font-size") {
            var fontSizeElement = getOrCreateChild(source.ownerDocument,props,"font-size");
            DOM_deleteAllChildren(fontSizeElement);
            DOM_appendChild(fontSizeElement,DOM_createTextNode(source.ownerDocument,value));
        }
        else if (name == "color") {
            var colorElement = getOrCreateChild(source.ownerDocument,props,"color");
            DOM_deleteAllChildren(colorElement);
            DOM_appendChild(colorElement,DOM_createTextNode(source.ownerDocument,value));
        }
    }
    debug("");
};

ParagraphLens.create = function(target)
{
};




DocumentLens = new Object();

DocumentLens.get = function(source)
{
    if (source.nodeName != "document")
        throw new Error("DocumentLens: invalid source");
    var html = DOM_createElement(document,"html");
    var body = DOM_createElement(document,"body");
    DOM_appendChild(html,body);
    for (var child = source.firstChild; child != null; child = child.nextSibling) {
        if (child.nodeName == "paragraph") {
            DOM_appendChild(body,ParagraphLens.get(child));
        }
        else if (isWhitespaceTextNode(child)) {
            var textNode = DOM_createTextNode(document,child.nodeValue);
            textNode._source = child;
            DOM_appendChild(body,textNode);
        }
    }
    return html;
};

DocumentLens.put = function(source,target)
{
    if (source.nodeName != "document")
        throw new Error("DocumentLens: invalid source");

    var sourceChild = source.firstChild;
    var targetChild = target.firstChild.firstChild;

    while ((sourceChild != null) && (targetChild != null)) {
        if (targetChild._source == sourceChild) {
//            debug("match between "+nodeString(targetChild)+" and "+nodeString(sourceChild));

            if (DOM_upperName(targetChild) == "P")
                ParagraphLens.put(sourceChild,targetChild);

            sourceChild = sourceChild.nextSibling;
            targetChild = targetChild.nextSibling;
//            debug("now sourceChild = "+nodeString(sourceChild)+", and targetChild = "+
//                  nodeString(targetChild));
        }
        else {
//            debug("no match between "+nodeString(targetChild)+" and "+nodeString(sourceChild));
//            debug("source = "+nodeString(targetChild._source));
            // targetChlid has been inserted
            targetChild = targetChild.nextSibling;
        }
    }
};

DocumentLens.create = function(target)
{
};






function debug(str)
{
    console.log(str);
}

function readXML(filename)
{
    var req = new XMLHttpRequest();
    req.open("GET",filename,false);
    req.send();
    return req.responseXML;
}

function serialise(root)
{
    var text = PrettyPrinter.getHTML(root);
    var pre = DOM_createElement(document,"PRE");
    DOM_appendChild(pre,DOM_createTextNode(document,text));
    return pre;
}

function testModifyHTML(target)
{
    debug("Modifying "+nodeString(target));
    var body = findMatchingChild(target,"BODY");
    debug(nodeString(body.firstChild));
    debug(body.childNodes.length);

    for (var i = 0; i < body.childNodes.length; i++) {
        debug("childNodes["+i+"] = "+body.childNodes[i]);
    }

    var p1 = body.childNodes[1];
    var p2 = body.childNodes[3];

    debug("p1 = "+nodeString(p1));
    debug("p2 = "+nodeString(p2));

    DOM_setStyleProperties(p1,{"color": "yellow"});
    DOM_setStyleProperties(p2,{"font-size": "22pt"});

//    var newP = DOM_createElement(document,"P");
//    var newText = DOM_createTextNode(document,"This is a new paragraph");
//    DOM_appendChild(newP,newText);
//    DOM_insertBefore(body,newP,p2);
}

function init()
{
    DOM_assignNodeIds(document.documentElement);
    var source = readXML("source.xml");
    DOM_assignNodeIds(source.documentElement);
    debug(source.toString());
    var text = PrettyPrinter.getHTML(source.documentElement);

    var pre = DOM_createElement(document,"PRE");
    DOM_appendChild(pre,DOM_createTextNode(document,text));
    DOM_appendChild(document.body,pre);

    DOM_appendChild(document.body,DOM_createElement(document,"HR"));

    var target = DocumentLens.get(source.documentElement);
    DOM_appendChild(document.body,serialise(target));

    DOM_appendChild(document.body,DOM_createElement(document,"HR"));
    testModifyHTML(target);
    DOM_appendChild(document.body,serialise(target));

    DOM_appendChild(document.body,DOM_createElement(document,"HR"));
    DocumentLens.put(source.documentElement,target);
    DOM_appendChild(document.body,serialise(source.documentElement));

}
