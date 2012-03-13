// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

function prettyPrintDocument()
{
    var clone = DOM.cloneNode(document.documentElement,true);
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
                    DOM.deleteNode(child);
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
            DOM.deleteCharacters(node,end);
            DOM.deleteCharacters(node,0,start);
        }
    }

    function addIndentation(node,indent)
    {
        if (node.nodeType == Node.ELEMENT_NODE) {
            var next;
            for (var child = node.firstChild; child != null; child = next) {
                next = child.nextSibling;
                var text = DOM.createTextNode(document,"\n"+indent+"    ");
                DOM.insertBefore(node,text,child);
                addIndentation(child,indent+"    ");
            }
            var text = DOM.createTextNode(document,"\n"+indent);
            DOM.appendChild(node,text);
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

function getHTML()
{
    var clone = DOM.cloneNode(document.documentElement,true);
    removeSpecial(clone);

    return clone.outerHTML;
}

function removeSpecial(node)
{
    if ((node.nodeName == "SPAN") &&
        ((node.getAttribute("class") == Keys.HEADING_NUMBER) ||
         (node.getAttribute("class") == Keys.FIGURE_NUMBER) ||
         (node.getAttribute("class") == Keys.TABLE_NUMBER))) {
        DOM.removeNodeButKeepChildren(node);
    }
    else {
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            removeSpecial(child);
    }
}

function isEmptyDocument()
{
    return !nodeHasContent(document.body);
}

function init()
{
    var jsInitOk = false;
    try {
        DOM.assignNodeIds(document);
        getStyles();
        Outline.init();
        jsInitOk = true;
    }
    catch (e) {
        editor.jsInterfaceInitError(e.stack);
    }

    if (jsInitOk)
        editor.jsInterfaceInitFinished();
}
