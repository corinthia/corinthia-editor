// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

function prettyPrintDocument()
{
    var clone = document.documentElement.cloneNode(true);
    removeRedundantWhitespace(clone,"");
    addIndentation(clone,"");
    return clone.outerHTML;

    function isWhitespaceChar(c)
    {
        return ((c == " ") || (c == "\t") || (c == "\r") || (c == "\n"));
    }

    // Note: This could potentially remove some whitespace that is important, e.g.
    // in the case of <b>one </b>two... it should only be used for debugging purposes
    function removeRedundantWhitespace(node,indent)
    {
        if (node.nodeType == Node.ELEMENT_NODE) {
            var next;
            for (var child = node.firstChild; child != null; child = next) {
                next = child.nextSibling;
                if (isWhitespaceTextNode(child)) {
                    node.removeChild(child);
                }
                else {
                    removeRedundantWhitespace(child,indent+"    ");
                }
            }
        }
        else if (node.nodeType == Node.TEXT_NODE) {
            var str = node.nodeValue;
            var start = 0;
            var end = str.length;
            while ((start < end) && isWhitespaceChar(str.charAt(start)))
                start++;
            while ((end > start) && isWhitespaceChar(str.charAt(end-1)))
                end--;
            node.nodeValue = str.slice(start,end);
        }
    }

    function addIndentation(node,indent)
    {
        if (node.nodeType == Node.ELEMENT_NODE) {
            var next;
            for (var child = node.firstChild; child != null; child = next) {
                next = child.nextSibling;
                var text = document.createTextNode("\n"+indent+"    ");
                node.insertBefore(text,child);
                addIndentation(child,indent+"    ");
            }
            var text = document.createTextNode("\n"+indent);
            node.appendChild(text);
        }
    }
}

function getDOMTree()
{
    var root = convertToObjects(document.documentElement);
    return JSON.stringify(root);

    function convertToObjects(node)
    {
        var obj = new Object();
        obj.nodeType = node.nodeType;
        if (node.nodeType == Node.ELEMENT_NODE) {
            obj.nodeName = node.nodeName;
            obj.attributes = new Object();
            for (var i = 0; i < node.attributes.length; i++) {
                var attr = node.attributes[i];
                obj.attributes[attr.nodeName] = attr.nodeValue;
            }
            obj.childNodes = new Array();
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                obj.childNodes.push(convertToObjects(child));
        }
        else if (node.nodeType == Node.TEXT_NODE) {
            obj.nodeValue = node.nodeValue;
        }
        else {
            throw new Error("Unexpected node type: "+node.nodeType);
        }
        return obj;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                          General                                               //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

function getStyles()
{
    var list = new Array();
    for (var i = 0; i < document.styleSheets.length; i++) {
        var sheet = document.styleSheets[i];
        var str = "";
        for (name in sheet)
            str += name+"\n";
        for (var j = 0; j < sheet.cssRules.length; j++) {
            var rule = sheet.cssRules[j];
            if (rule.type == CSSRule.STYLE_RULE) {
                var properties = new Object();
                for (k = 0; k < rule.style.length; k++)
                    properties[rule.style[k]] = rule.style.getPropertyValue(rule.style[k]);
                
                list.push({"selector": rule.selectorText,
                           "properties": properties });
            }
        }
    }
    editor.setStyles(list);
}

function jumpToSection(sectionId)
{
    var section = document.getElementById(sectionId);
    var location = webkitConvertPointFromNodeToPage(section,
                                                    new WebKitPoint(0,0));
    window.scrollTo(0,location.y);
}

function getHTML()
{
    try {
        var serializer = new XMLSerializer();
        var xml = serializer.serializeToString(document);
        editor.getHTMLResponse(xml);
    }
    catch (e) {
        editor.getHTMLError(e.toString());
    }
}

function keydown(e)
{
    if (e.keyCode == '\r'.charCodeAt(0)) {
        e.preventDefault();
        enterPressed();
    }
}

// Remove the temporary <script> element that was added to the document to execute this file
// so it's not saved with the document
var initscript = document.getElementById("initscript");
if (initscript != null) {
    initscript.parentNode.removeChild(initscript);
}

var jsInitOk = false;
try {
    DOM.assignNodeIds(document);
//    document.body.contentEditable = true;
//    document.body.style.padding = "15%";
//    document.body.style.padding = "5%";
    document.body.style.textAlign = "justify";
    window.onkeydown = keydown;

    setupMutation();
    getOutline();
    getStyles();
    structure.examineDocument();
    jsInitOk = true;
}
catch (e) {
    editor.jsInterfaceInitError(e.stack);
}

if (jsInitOk)
    editor.jsInterfaceInitFinished();
