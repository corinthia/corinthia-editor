// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Main_isEmptyDocument;
var Main_getHTML;
var Main_getErrorReportingInfo;
var Main_removeUnsupportedInput;
var Main_removeSpecial;
var Main_execute;
var Main_init;

(function() {

    // public
    Main_removeUnsupportedInput = trace(function removeUnsupportedInput()
    {
        recurse(document.documentElement);

        function recurse(node)
        {
            // Delete comments and processing instructions
            if ((node.nodeType != Node.TEXT_NODE) &&
                (node.nodeType != Node.ELEMENT_NODE)) {
                DOM_deleteNode(node);
            }
            else {
                var next;
                for (var child = node.firstChild; child != null; child = next) {
                    next = child.nextSibling;
                    recurse(child);
                }
            }
        }
    });

    // private
    var addContentType = trace(function addContentType()
    {
        var head = DOM_documentHead(document);
        var haveContentType = false;
        for (var child = head.firstChild; child != null; child = child.nextSibling) {
            if (DOM_upperName(child) == "META") {
                var httpEquiv = child.getAttribute("http-equiv");
                if ((httpEquiv != null) && (httpEquiv.toLowerCase() == "content-type")) {
                    haveContentType = true;
                    break;
                }
            }
        }
        if (!haveContentType) {
            var meta = DOM_createElement(document,"META");
            DOM_setAttribute(meta,"http-equiv","Content-Type");
            DOM_setAttribute(meta,"content","text/html; charset=utf-8");
            DOM_insertBefore(head,meta,head.firstChild);
        }
    });

    // public
    Main_isEmptyDocument = trace(function isEmptyDocument()
    {
        return !nodeHasContent(document.body);
    });

    // public
    Main_getHTML = trace(function getHTML()
    {
        var clone = DOM_cloneNode(document.documentElement,true);
        DOM_setStyleProperties(clone,{"-webkit-text-size-adjust": null});
        if (clone.style.length == 0)
            DOM_removeAttribute(clone,"style");
        Main_removeSpecial(clone);

        return clone.outerHTML;
    });

    // public
    Main_getErrorReportingInfo = trace(function getErrorReportingInfo()
    {
        if (document.documentElement == null)
            return "(document.documentElement is null)";
        try {
            var html = htmlWithSelection();
            cleanse(html);
            return html.outerHTML;
        }
        catch (e) {
            try {
                var html = DOM_cloneNode(document.documentElement,true);
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
            Selection_hideWhileExecuting(function() {
                var selectionRange = Selection_get();
                if (selectionRange != null) {
                    selectionRange = selectionRange.forwards();
                    var startSave = new Object();
                    var endSave = new Object();

                    var html = null;

                    selectionRange.trackWhileExecuting(function() {
                        // We use the strings @@^^ and ^^@@ to represent the selection
                        // start and end, respectively. The reason for this is that after we have
                        // cloned the tree, all text will be removed. We keeping the @ and ^
                        // characters so we have some way to identifiy the selection markers;
                        // leaving these in is not going to reveal any confidential information.

                        addPositionMarker(selectionRange.end,"^^@@",endSave);
                        addPositionMarker(selectionRange.start,"@@^^",startSave);

                        html = DOM_cloneNode(document.documentElement,true);

                        removePositionMarker(selectionRange.start,startSave);
                        removePositionMarker(selectionRange.end,endSave);
                    });

                    return html;
                }
                else {
                    return DOM_cloneNode(document.documentElement,true);
                }
            });
        }

        function addPositionMarker(pos,name,save)
        {
            var node = pos.node;
            var offset = pos.offset;
            if (node.nodeType == Node.ELEMENT_NODE) {
                save.tempNode = DOM_createTextNode(document,name);
                DOM_insertBefore(node,save.tempNode,node.childNodes[offset]);
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
                DOM_deleteNode(save.tempNode);
            }
            else if (pos.node.nodeType == Node.TEXT_NODE) {
                node.nodeValue = save.originalNodeValue;
            }
        }
    });

    // public
    Main_removeSpecial = trace(function removeSpecial(node)
    {
        if ((DOM_upperName(node) == "SPAN") &&
            ((node.getAttribute("class") == Keys.HEADING_NUMBER) ||
             (node.getAttribute("class") == Keys.FIGURE_NUMBER) ||
             (node.getAttribute("class") == Keys.TABLE_NUMBER) ||
             (node.getAttribute("class") == Keys.AUTOCORRECT_CLASS))) {
            DOM_removeNodeButKeepChildren(node);
        }
        else if ((DOM_upperName(node) == "DIV") &&
                 (node.getAttribute("class") == Keys.SELECTION_HIGHLIGHT)) {
            DOM_removeNodeButKeepChildren(node);
        }
        else if ((DOM_upperName(node) == "META") &&
                 node.hasAttribute("name") &&
                 (node.getAttribute("name").toLowerCase() == "viewport")) {
            DOM_deleteNode(node);
        }
        else if (DOM_upperName(node) == "STYLE") {
            var cssText = Styles_getCSSText(["."+Keys.AUTOCORRECT_CLASS]);
            DOM_deleteAllChildren(node);
            DOM_appendChild(node,DOM_createTextNode(document,cssText));
        }
        else {
            var next;
            for (var child = node.firstChild; child != null; child = next) {
                next = child.nextSibling;
                Main_removeSpecial(child);
            }
        }
    });

    // public
    Main_execute = trace(function execute(fun)
    {
        try {
            var res = fun();
            PostponedActions_perform();
            return res;
        }
        catch (e) {
            Editor_error(e);
        }
    });

    // public
    Main_init = trace(function init()
    {
        try {
            if (document.documentElement == null)
                throw new Error("document.documentElement is null");
            if (document.body == null)
                throw new Error("document.body is null");
            DOM_assignNodeIds(document);
            Main_removeUnsupportedInput();
            addContentType();
            Outline_init();
            Styles_init();
            Viewport_init();
            AutoCorrect_init();

            return true;
        }
        catch (e) {
            return e.toString();
        }
    });

})();
