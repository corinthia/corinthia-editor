// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function() {

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

    function addContentType()
    {
        var head = DOM.documentHead(document);
        var haveContentType = false;
        for (var child = head.firstChild; child != null; child = child.nextSibling) {
            if (DOM.upperName(child) == "META") {
                var httpEquiv = child.getAttribute("http-equiv");
                if ((httpEquiv != null) && (httpEquiv.toLowerCase() == "content-type")) {
                    haveContentType = true;
                    break;
                }
            }
        }
        if (!haveContentType) {
            var meta = DOM.createElement(document,"META");
            meta.setAttribute("http-equiv","Content-Type");
            meta.setAttribute("content","text/html; charset=utf-8");
            DOM.insertBefore(head,meta,head.firstChild);
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
        var clone = DOM.cloneNode(document.documentElement,true);
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

    // public
    function removeSpecial(node)
    {
        if ((DOM.upperName(node) == "SPAN") &&
            ((node.getAttribute("class") == Keys.HEADING_NUMBER) ||
             (node.getAttribute("class") == Keys.FIGURE_NUMBER) ||
             (node.getAttribute("class") == Keys.TABLE_NUMBER))) {
            DOM.removeNodeButKeepChildren(node);
        }
        else if ((DOM.upperName(node) == "DIV") &&
                 (node.getAttribute("class") == Keys.SELECTION_HIGHLIGHT)) {
            DOM.removeNodeButKeepChildren(node);
        }
        else if ((DOM.upperName(node) == "META") &&
                 node.hasAttribute("name") &&
                 (node.getAttribute("name").toLowerCase() == "viewport")) {
            DOM.deleteNode(node);
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
            PostponedActions.perform();
            return res;
        }
        catch (e) {
            editor.reportJSError(e);
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
            DOM.assignNodeIds(document);
            addContentType();
            getStyles();
            Outline.init();
            return true;
        }
        catch (e) {
            return e.toString();
        }
    }

    addContentType = trace(addContentType);
    getStyles = trace(getStyles);

    window.Main = new (function Main(){});
    Main.isEmptyDocument = trace(isEmptyDocument);
    Main.getHTML = trace(getHTML);
    Main.getErrorReportingInfo = trace(getErrorReportingInfo);
    Main.removeSpecial = trace(removeSpecial);
    Main.execute = trace(execute);
    Main.init = trace(init);

})();
