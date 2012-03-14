(function() {

    var nextParagraphPrefix = null;

    function blockToText(node,array,indent,listType,listNo)
    {
        var anonymousParagraph = null;
        var prefix = "";
        var suffix = "";
        var addNewline = true;

        if (node.nodeName == "LI") {
            if (listNo.value > 1)
                addNewline = false;
            if (listType == "OL") {
                var listMarker;
                if (listNo.value < 10)
                    listMarker = listNo.value+".  ";
                else
                    listMarker = listNo.value+". ";
                nextParagraphPrefix = indent+listMarker;
                indent += "    ";
            }
            else {
                nextParagraphPrefix = indent+"  - ";
                indent += "    ";
            }
            listNo.value++;
        }
        else if (node.nodeName == "UL") {
            listType = "UL";
            listNo = { value: 1 };
        }
        else if (node.nodeName == "OL") {
            listType = "OL";
            listNo = { value: 1 };
        }
        else if (node.nodeName == "H1") {
            prefix = "# ";
            suffix = " #";
        }
        else if (node.nodeName == "H2") {
            prefix = "## ";
            suffix = " ##";
        }
        else if (node.nodeName == "H3") {
            prefix = "### ";
            suffix = " ###";
        }
        else if (node.nodeName == "H4") {
            prefix = "#### ";
            suffix = " ####";
        }
        else if (node.nodeName == "H5") {
            prefix = "##### ";
            suffix = " #####";
        }
        else if (node.nodeName == "H6") {
            prefix = "###### ";
            suffix = " ######";
        }
        else if (node.nodeName == "BLOCKQUOTE") {
            indent += "> ";
        }

        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            if (isContainerNode(child) || isParagraphNode(child)) {
                closeAnonymousParagraph();
                blockToText(child,array,indent,listType,listNo);
            }
            else {
                if ((anonymousParagraph == null) && isWhitespaceTextNode(child))
                    continue;
                openAnonymousParagraph();
                inlineToText(child,anonymousParagraph);
            }
        }
        closeAnonymousParagraph();

        function openAnonymousParagraph()
        {
            if (anonymousParagraph != null)
                return;
            anonymousParagraph = new Array();
        }

        function closeAnonymousParagraph()
        {
            if (anonymousParagraph == null)
                return;
            var paragraphText = normalizeWhitespace(anonymousParagraph.join(""));
            startNewParagraph();
            array.push(prefix+paragraphText+suffix);
            anonymousParagraph = null;
        }

        function startNewParagraph()
        {
            if (array.length > 0) {
                if (addNewline)
                    array.push("\n\n");
                else
                    array.push("\n");
            }
            if (nextParagraphPrefix != null) {
                array.push(nextParagraphPrefix);
                nextParagraphPrefix = null;
            }
            else {
                array.push(indent);
            }
        }
    }

    function inlineToText(node,array)
    {
        if (node.nodeType == Node.TEXT_NODE) {
            array.push(node.nodeValue);
        }
        else if ((node.nodeName == "I") || (node.nodeName == "EM")) {
            array.push("*");
            processChildren();
            array.push("*");
        }
        else if ((node.nodeName == "B") || (node.nodeName == "STRONG")) {
            array.push("**");
            processChildren();
            array.push("**");
        }
        else if (node.nodeName == "A") {
            array.push("[");
            processChildren();
            array.push("]("+node.getAttribute("href")+")");
        }
        else {
            processChildren();
        }

        function processChildren()
        {
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                inlineToText(child,array);
            }
        }
    }

    // public (FIXME: temp: for testing)
    function htmlToText(node)
    {
        var array = new Array();
        if (isContainerNode(node) || isParagraphNode(node)) {
            blockToText(node,array,"");
            return array.join("");
        }
        else {
            inlineToText(node,array);
            return normalizeWhitespace(array.join(""));
        }
    }








    // public
    function cut()
    {
        var content = copy();
        Selection.deleteSelectionContents();
        return content;
    }

    // public
    function copy()
    {
        var selectionRange = Selection.getSelectionRange();
        var html = "";
        var text = "";

        if (selectionRange != null) {
            var nodes = selectionRange.cloneContents();

            var div = DOM.createElement(document,"DIV");
            for (var i = 0; i < nodes.length; i++)
                DOM.appendChild(div,nodes[i]);

            html = div.innerHTML;
            text = htmlToText(div);
        }

        return { "text/html": html,
                 "text/plain": text };
    }

    // public
    function pasteText(text)
    {
        var textNode = DOM.createTextNode(document,text);
        var nodes = [textNode];
        pastNodes(nodes);
    }

    // public
    function pasteHTML(html)
    {
        var div = DOM.createElement(document,"DIV");
        div.innerHTML = html;

        var nodes = new Array();
        for (var child = div.firstChild; child != null; child = child.nextSibling)
            nodes.push(child);

        pasteNodes(nodes);
    }

    function pasteNodes(nodes)
    {
        Selection.deleteSelectionContents();
        var pos = selection.start;
        var node = pos.node;
        var offset = pos.offset;

        var parent;
        var before;
        if (node.nodeType == Node.ELEMENT_NODE) {
            parent = node;
            before = node.childNodes[offset];
        }
        else {
            splitTextBefore(node,offset);
            parent = node.parentNode;
            before = node;
        }
        for (var i = 0; i < nodes.length; i++)
            DOM.insertBefore(parent,nodes[i],before);
    }

    function pasteImage(href)
    {
        // FIXME
    }

    window.Clipboard = new Object();
    Clipboard.htmlToText = htmlToText;
    Clipboard.cut = cut;
    Clipboard.copy = copy;
    Clipboard.pasteText = pasteText;
    Clipboard.pasteHTML = pasteHTML;

})();
