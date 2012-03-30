(function() {

    function blockToText(md,node,indent,nextIndent,listType,listNo)
    {
        var linesBetweenChildren = 1;
        var childIndent = indent;
        if (DOM.upperName(node) == "LI") {
            if (listType == "OL") {
                var listMarker;
                if (listNo.value < 10)
                    listMarker = listNo.value+".  ";
                else
                    listMarker = listNo.value+". ";
                beginParagraph(md,0,indent,nextIndent,listMarker);
                nextIndent += "    ";
            }
            else {
                beginParagraph(md,0,indent,nextIndent,"  - ");
                nextIndent += "    ";
            }
            listNo.value++;
        }
        else if (DOM.upperName(node) == "UL") {
            listType = "UL";
            listNo = { value: 1 };
            beginParagraph(md,1,indent,nextIndent);
            linesBetweenChildren = 0;
        }
        else if (DOM.upperName(node) == "OL") {
            listType = "OL";
            listNo = { value: 1 };
            beginParagraph(md,1,indent,nextIndent);
            linesBetweenChildren = 0;
        }
        else if (DOM.upperName(node) == "H1") {
            beginParagraph(md,1,indent,nextIndent,"# "," #");
        }
        else if (DOM.upperName(node) == "H2") {
            beginParagraph(md,1,indent,nextIndent,"## "," ##");
        }
        else if (DOM.upperName(node) == "H3") {
            beginParagraph(md,1,indent,nextIndent,"### "," ###");
        }
        else if (DOM.upperName(node) == "H4") {
            beginParagraph(md,1,indent,nextIndent,"#### "," ####");
        }
        else if (DOM.upperName(node) == "H5") {
            beginParagraph(md,1,indent,nextIndent,"##### "," #####");
        }
        else if (DOM.upperName(node) == "H6") {
            beginParagraph(md,1,indent,nextIndent,"###### "," ######");
        }
        else if (DOM.upperName(node) == "BLOCKQUOTE") {
            beginParagraph(md,1,indent,nextIndent,"> ");
            nextIndent += "> ";
        }
        else if (DOM.upperName(node) == "PRE") {
            md.preDepth++;
        }

        var foundNonWhitespaceChild = false;
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            if (isContainerNode(child) || isParagraphNode(child)) {
                beginParagraph(md,linesBetweenChildren,indent,nextIndent);
                blockToText(md,child,indent,nextIndent,listType,listNo);
                beginParagraph(md,linesBetweenChildren);
                indent = nextIndent;
                foundNonWhitespaceChild = false;
            }
            else {
                if (!foundNonWhitespaceChild) {
                    if (isWhitespaceTextNode(child))
                        continue;
                    beginParagraph(md,0,indent,nextIndent);
                    indent = nextIndent;
                    foundNonWhitespaceChild = true;
                }

                inlineToText(md,child);
            }
        }

        if (DOM.upperName(node) == "PRE") {
            md.preDepth--;
        }
    }

    function shipOutParagraph(md)
    {
        var text = md.buildParagraph.join("");
        if (md.buildPre) {
            text = text.replace(/\n$/,"");
            text = "    "+text.replace(/\n/g,"\n"+md.nextIndent+"    ");
        }
        else {
            text = normalizeWhitespace(text);
        }
        if (md.allText.length > 0) {
            for (var i = 0; i < md.buildLines; i++)
                md.allText.push("\n");
        }
        md.allText.push(md.indent+md.buildPrefix+text+md.buildSuffix+"\n");
        resetBuild(md);
    }

    function beginParagraph(md,blankLines,indent,nextIndent,paraPrefix,paraSuffix)
    {
        if (blankLines == null)
            blankLines = 1;
        if (indent == null)
            indent = "";
        if (nextIndent == null)
            nextIndent = "";
        if (paraPrefix == null)
            paraPrefix = "";
        if (paraSuffix == null)
            paraSuffix = "";

        if (md == null)
            throw new Error("beginParagraph: md is null");
        if (md.buildParagraph == null)
            throw new Error("beginParagraph: md.buildParagraph is null");

        if (md.buildParagraph.length > 0) {
            shipOutParagraph(md);
        }

        if (md.buildLines < blankLines)
            md.buildLines = blankLines;
        if (md.indent.length < indent.length)
            md.indent = indent;
        if (md.nextIndent.length < nextIndent.length)
            md.nextIndent = nextIndent;
        md.buildPrefix += paraPrefix;
        md.buildSuffix = paraSuffix + md.buildSuffix;
        if (md.preDepth > 0)
            md.buildPre = true;
    }

    function inlineToText(md,node)
    {
        if (node.nodeType == Node.TEXT_NODE) {
            var text = node.nodeValue;
            if (md.preDepth == 0) {
                text = text.replace(/\\/g,"\\\\");
                text = text.replace(/\*/g,"\\*");
                text = text.replace(/\[/g,"\\[");
                text = text.replace(/\]/g,"\\]");
            }
            md.buildParagraph.push(text);
        }
        else if ((DOM.upperName(node) == "I") || (DOM.upperName(node) == "EM")) {
            md.buildParagraph.push("*");
            processChildren();
            md.buildParagraph.push("*");
        }
        else if ((DOM.upperName(node) == "B") || (DOM.upperName(node) == "STRONG")) {
            md.buildParagraph.push("**");
            processChildren();
            md.buildParagraph.push("**");
        }
        else if (DOM.upperName(node) == "A") {
            md.buildParagraph.push("[");
            processChildren();
            md.buildParagraph.push("]("+node.getAttribute("href")+")");
        }
        else {
            processChildren();
        }

        function processChildren()
        {
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                inlineToText(md,child);
            }
        }
    }

    function resetBuild(md)
    {
        md.buildParagraph = new Array();
        md.buildLines = 0;
        md.buildPrefix = "";
        md.buildSuffix = "";
        md.buildPre = false;
        md.indent = "";
        md.nextIndent = "";
    }

    function MarkdownBuilder()
    {
    }

    function htmlToMarkdown(node)
    {
        var md = new MarkdownBuilder();
        md.allText = new Array();
        md.preDepth = 0;
        resetBuild(md);

        if (isContainerNode(node) || isParagraphNode(node)) {
            blockToText(md,node,"","","UL",{value: 1});
            beginParagraph(md);
            return md.allText.join("");
        }
        else {
            inlineToText(md,node);
            return normalizeWhitespace(md.buildParagraph.join(""));
        }
    }

    window.Markdown = new Object();
    Markdown.htmlToMarkdown = htmlToMarkdown;

})();

(function() {

    // public (FIXME: temp: for testing)
    function htmlToText(node)
    {
        return Markdown.htmlToMarkdown(node);
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
        pasteNodes(nodes);
    }

    // public
    function pasteHTML(html)
    {
        if (html.match(/^\s*<thead/i))
            html = "<table>" + html + "</table>";
        else if (html.match(/^\s*<tbody/i))
            html = "<table>" + html + "</table>";
        else if (html.match(/^\s*<tfoot/i))
            html = "<table>" + html + "</table>";
        else if (html.match(/^\s*<tr/i))
            html = "<table>" + html + "</table>";
        else if (html.match(/^\s*<td/i))
            html = "<table><tr>" + html + "</tr></table>";
        else if (html.match(/^\s*<th/i))
            html = "<table><tr>" + html + "</tr></table>";
        else if (html.match(/^\s*<li/i))
            html = "<ul>" + html + "</ul>";

        var div = DOM.createElement(document,"DIV");
        div.innerHTML = html;
        for (var child = div.firstChild; child != null; child = child.nextSibling)
            DOM.assignNodeIds(child);

        var nodes = new Array();
        for (var child = div.firstChild; child != null; child = child.nextSibling)
            nodes.push(child);

        pasteNodes(nodes);
    }

    // public
    function pasteNodes(nodes)
    {
        Selection.deleteSelectionContents();
        var selectionRange = Selection.getSelectionRange();
        if (selectionRange == null)
            return;
        var pos = selectionRange.start;
        var node = pos.node;
        var offset = pos.offset;

        var parent;
        var previousSibling;
        var nextSibling;
        if (node.nodeType == Node.ELEMENT_NODE) {
            parent = node;
            nextSibling = node.childNodes[offset];
            previousSibling = node.childNodes[offset-1];
        }
        else {
            Formatting.splitTextBefore(node,offset);
            parent = node.parentNode;
            nextSibling = node;
            previousSibling = node.previousSibling;
        }

        if ((DOM.upperName(parent) == "UL") || (DOM.upperName(parent) == "OL")) {
            for (var i = 0; i < nodes.length; i++) {
                if (DOM.upperName(nodes[i]) == "LI") {
                    DOM.insertBefore(parent,nodes[i],nextSibling);
                }
                else if (DOM.upperName(nodes[i]) == DOM.upperName(parent)) {
                    while (nodes[i].firstChild != null)
                        DOM.insertBefore(parent,nodes[i].firstChild,nextSibling);
                }
                else if (!isWhitespaceTextNode(nodes[i])) {
                    var li = DOM.createElement(document,"LI");
                    DOM.insertBefore(parent,li,nextSibling);
                    DOM.appendChild(li,nodes[i]);
                }
            }
        }
        else {
            for (var i = 0; i < nodes.length; i++) {
                DOM.insertBefore(parent,nodes[i],nextSibling);
            }
        }

        if (nodes.length > 0) {
            var offset;
            if (nextSibling != null)
                offset = DOM.nodeOffset(nextSibling);
            else
                offset = parent.childNodes.length;
            selectionRange = new Range(parent,offset,parent,offset);
            Selection.setSelectionRange(selectionRange);
        }
        selectionRange.trackWhileExecuting(function() {
            if (previousSibling != null)
                Formatting.mergeWithNeighbours(previousSibling,Formatting.MERGEABLE_INLINE);
            if (nextSibling != null)
                Formatting.mergeWithNeighbours(nextSibling,Formatting.MERGEABLE_INLINE);

            Cursor.updateBRAtEndOfParagraph(parent);
        });
    }

    function pasteImage(href)
    {
        // FIXME
    }

    window.Clipboard = new (function Clipboard(){});
    Clipboard.htmlToText = trace(htmlToText);
    Clipboard.cut = trace(cut);
    Clipboard.copy = trace(copy);
    Clipboard.pasteText = trace(pasteText);
    Clipboard.pasteHTML = trace(pasteHTML);
    Clipboard.pasteNodes = trace(pasteNodes);

})();
