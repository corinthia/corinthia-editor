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
    function removeUnsupportedInput()
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
    }

    function addContentType()
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
            meta.setAttribute("http-equiv","Content-Type");
            meta.setAttribute("content","text/html; charset=utf-8");
            DOM_insertBefore(head,meta,head.firstChild);
        }
    }

    // public
    function isEmptyDocument()
    {
        return !nodeHasContent(document.body);
    }

    // public
    function getHTML()
    {
        var clone = DOM_cloneNode(document.documentElement,true);
        clone.style.webkitTextSizeAdjust = null;
        if (clone.style.length == 0)
            clone.removeAttribute("style");
        removeSpecial(clone);

        return clone.outerHTML;
    }

    // public
    function getErrorReportingInfo()
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
            var selectionRange = Selection_getSelectionRange();
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

                    html = DOM_cloneNode(document.documentElement,true);

                    removePositionMarker(selectionRange.start,startSave);
                    removePositionMarker(selectionRange.end,endSave);
                });

                return html;
            }
            else {
                return DOM_cloneNode(document.documentElement,true);
            }
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
    }

    // public
    function removeSpecial(node)
    {
        if ((DOM_upperName(node) == "SPAN") &&
            ((node.getAttribute("class") == Keys.HEADING_NUMBER) ||
             (node.getAttribute("class") == Keys.FIGURE_NUMBER) ||
             (node.getAttribute("class") == Keys.TABLE_NUMBER))) {
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
        else {
            var next;
            for (var child = node.firstChild; child != null; child = next) {
                next = child.nextSibling;
                removeSpecial(child);
            }
        }
    }

    // public
    function execute(fun)
    {
        try {
            var res = fun();
            PostponedActions_perform();
            return res;
        }
        catch (e) {
            Editor_error(e);
        }
    }

    // public
    function init()
    {
        try {
            if (document.documentElement == null)
                throw new Error("document.documentElement is null");
            if (document.body == null)
                throw new Error("document.body is null");
            DOM_assignNodeIds(document);
            removeUnsupportedInput();
            addContentType();
            Outline_init();
            Styles_init();
            Viewport_init();

            return true;
        }
        catch (e) {
            return e.toString();
        }
    }

    addContentType = trace(addContentType);

    Main_isEmptyDocument = trace(isEmptyDocument);
    Main_getHTML = trace(getHTML);
    Main_getErrorReportingInfo = trace(getErrorReportingInfo);
    Main_removeUnsupportedInput = trace(removeUnsupportedInput);
    Main_removeSpecial = trace(removeSpecial);
    Main_execute = trace(execute);
    Main_init = trace(init);

})();
