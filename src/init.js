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
            obj.nodeName = DOM.upperName(node);
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

function getErrorReportingInfo()
{
    try {
        var html = htmlWithSelection();
        cleanse(html);
        return html.outerHTML;
    }
    catch (e) {
        try {
            var html = DOM.cloneNode(document.documentElement,true);
            cleanse(html);
            return html.outerHTML+"\n[Error getting selection: "+e+"]";
        }
        catch (e2) {
            return "[Error getting HTML: "+e2+"]";
        }
    }

    function cleanse(node)
    {
        if ((node.nodeType == Node.TEXT_NODE) || (node.nodeType == Node.COMMENT_NODE)) {
            node.nodeValue = node.nodeValue.replace(/[^\s\.\@\^]/g,"X");
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                cleanse(child);
        }
    }

    function htmlWithSelection()
    {
        var selectionRange = Selection.getSelectionRange();
        if (selectionRange != null) {
            selectionRange = selectionRange.forwards();
            var startSave = new Object();
            var endSave = new Object();

            var html = null;

            selectionRange.trackWhileExecuting(function() {
                // We use the strings @@^^ and ^^@@ to represent the selection
                // start and end, respectively. The reason for this is that after we have
                // cloned the tree, all text will be removed. We keeping the @ and ^ characters
                // so we have some way to identifiy the selection markers; leaving these in
                // is not going to reveal any confidential information.

                addPositionMarker(selectionRange.end,"^^@@",endSave);
                addPositionMarker(selectionRange.start,"@@^^",startSave);

                html = DOM.cloneNode(document.documentElement,true);

                removePositionMarker(selectionRange.start,startSave);
                removePositionMarker(selectionRange.end,endSave);
            });

            return html;
        }
        else {
            return DOM.cloneNode(document.documentElement,true);
        }
    }

    function addPositionMarker(pos,name,save)
    {
        var node = pos.node;
        var offset = pos.offset;
        if (node.nodeType == Node.ELEMENT_NODE) {
            save.tempNode = DOM.createTextNode(document,name);
            DOM.insertBefore(node,save.tempNode,node.childNodes[offset]);
        }
        else if (node.nodeType == Node.TEXT_NODE) {
            save.originalNodeValue = node.nodeValue;
            node.nodeValue = node.nodeValue.slice(0,offset) + name + node.nodeValue.slice(offset);
        }
    }

    function removePositionMarker(pos,save)
    {
        var node = pos.node;
        var offset = pos.offset;
        if (pos.node.nodeType == Node.ELEMENT_NODE) {
            DOM.deleteNode(save.tempNode);
        }
        else if (pos.node.nodeType == Node.TEXT_NODE) {
            node.nodeValue = save.originalNodeValue;
        }
    }
}

function removeSpecial(node)
{
    if ((DOM.upperName(node) == "SPAN") &&
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

function execute(fun)
{
    try {
        var res = fun();
        PostponedActions.perform();
        return res;
    }
    catch (e) {
        editor.reportJSError(e);
    }
}

function addContentType()
{
    debug("addContentType 1");
    var head = DOM.documentHead(document);
    debug("addContentType 2");
    debug("addContentType 2: head = "+head);
    debug("document.documentElement = "+document.documentElement.nodeName);
    for (var c = document.documentElement.firstChild; c != null; c = c.nextSibling) {
        debug("c = "+c.nodeName);
    }
    var haveContentType = false;
    for (var child = head.firstChild; child != null; child = child.nextSibling) {
        debug("addContentType 3: child = "+nodeString(child));
        if (DOM.upperName(child) == "META") {
            debug("addContentType 4");
            var httpEquiv = child.getAttribute("http-equiv");
            debug("addContentType 5");
            if ((httpEquiv != null) && (httpEquiv.toLowerCase() == "content-type")) {
                debug("addContentType 6");
                haveContentType = true;
                break;
            }
        }
    }
    debug("addContentType 7");
    if (!haveContentType) {
        debug("addContentType 8");
        var meta = DOM.createElement(document,"META");
        meta.setAttribute("http-equiv","Content-Type");
        meta.setAttribute("content","text/html; charset=utf-8");
        DOM.insertBefore(head,meta,head.firstChild);
        debug("addContentType 9");
    }
}

function init()
{
    try {
        debug("init 1");
        DOM.assignNodeIds(document);
        debug("init 2");
        addContentType();
        debug("init 3");
        getStyles();
        debug("init 4");
        Outline.init();
        debug("init 5");
        return true;
    }
    catch (e) {
        debug("init error: "+e);
        return e.toString();
    }
}
