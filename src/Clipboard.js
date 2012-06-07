// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Markdown_htmlToMarkdown;
var Clipboard_htmlToText;
var Clipboard_cut;
var Clipboard_copy;
var Clipboard_pasteText;
var Clipboard_pasteHTML;
var Clipboard_pasteNodes;

(function() {

    // private
    var blockToText = trace(function blockToText(md,node,indent,nextIndent,listType,listNo)
    {
        var linesBetweenChildren = 1;
        var childIndent = indent;
        if (DOM_upperName(node) == "LI") {
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
        else if (DOM_upperName(node) == "UL") {
            listType = "UL";
            listNo = { value: 1 };
            beginParagraph(md,1,indent,nextIndent);
            linesBetweenChildren = 0;
        }
        else if (DOM_upperName(node) == "OL") {
            listType = "OL";
            listNo = { value: 1 };
            beginParagraph(md,1,indent,nextIndent);
            linesBetweenChildren = 0;
        }
        else if (DOM_upperName(node) == "H1") {
            beginParagraph(md,1,indent,nextIndent,"# "," #");
        }
        else if (DOM_upperName(node) == "H2") {
            beginParagraph(md,1,indent,nextIndent,"## "," ##");
        }
        else if (DOM_upperName(node) == "H3") {
            beginParagraph(md,1,indent,nextIndent,"### "," ###");
        }
        else if (DOM_upperName(node) == "H4") {
            beginParagraph(md,1,indent,nextIndent,"#### "," ####");
        }
        else if (DOM_upperName(node) == "H5") {
            beginParagraph(md,1,indent,nextIndent,"##### "," #####");
        }
        else if (DOM_upperName(node) == "H6") {
            beginParagraph(md,1,indent,nextIndent,"###### "," ######");
        }
        else if (DOM_upperName(node) == "BLOCKQUOTE") {
            beginParagraph(md,1,indent,nextIndent,"> ");
            nextIndent += "> ";
        }
        else if (DOM_upperName(node) == "PRE") {
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

        if (DOM_upperName(node) == "PRE") {
            md.preDepth--;
        }
    });

    // private
    var shipOutParagraph = trace(function shipOutParagraph(md)
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
    });

    // private
    var beginParagraph = trace(function beginParagraph(md,blankLines,indent,nextIndent,
                                                       paraPrefix,paraSuffix)
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
    });

    // private
    var inlineToText = trace(function inlineToText(md,node)
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
        else if ((DOM_upperName(node) == "I") || (DOM_upperName(node) == "EM")) {
            md.buildParagraph.push("*");
            processChildren();
            md.buildParagraph.push("*");
        }
        else if ((DOM_upperName(node) == "B") || (DOM_upperName(node) == "STRONG")) {
            md.buildParagraph.push("**");
            processChildren();
            md.buildParagraph.push("**");
        }
        else if (DOM_upperName(node) == "A") {
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
    });

    // private
    var resetBuild = trace(function resetBuild(md)
    {
        md.buildParagraph = new Array();
        md.buildLines = 0;
        md.buildPrefix = "";
        md.buildSuffix = "";
        md.buildPre = false;
        md.indent = "";
        md.nextIndent = "";
    });

    // private
    function MarkdownBuilder()
    {
    }

    // public
    Markdown_htmlToMarkdown = trace(function htmlToMarkdown(node)
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
    });

})();

(function() {

    // public (FIXME: temp: for testing)
    Clipboard_htmlToText = trace(function htmlToText(node)
    {
        return Markdown_htmlToMarkdown(node);
    });

    // public
    Clipboard_cut = trace(function cut()
    {
        UndoManager_newGroup("Cut");
        var content = Clipboard_copy();

        Selection_hideWhileExecuting(function() {
            Selection_deleteContents();
            var selRange = Selection_get();
            if (selRange != null) {
                var pos = Cursor_closestPositionForwards(selRange.start);
                Selection_set(pos.node,pos.offset,pos.node,pos.offset);
            }
        });

        UndoManager_newGroup();
        return content;
    });

    // public
    Clipboard_copy = trace(function copy()
    {
        var range = Selection_get();
        var html = "";
        var text = "";

        if (range != null) {
            var nodes;
            var region = Tables_regionFromRange(range);
            if (region != null)
                nodes = [Tables_cloneRegion(region)];
            else
                nodes = range.cloneContents();

            var div = DOM_createElement(document,"DIV");
            for (var i = 0; i < nodes.length; i++)
                DOM_appendChild(div,nodes[i]);
            removeCorrections(div);

            html = div.innerHTML;
            text = Clipboard_htmlToText(div);
        }

        return { "text/html": html,
                 "text/plain": text };

        function removeCorrections(node) {
            if ((DOM_upperName(node) == "SPAN") &&
                (node.getAttribute("class") == Keys.AUTOCORRECT_CLASS)) {
                DOM_removeNodeButKeepChildren(node);
            }
            else {
                var next;
                for (var child = node.firstChild; child != null; child = next) {
                    next = child.nextSibling;
                    removeCorrections(child);
                }
            }
        }
    });

    // public
    Clipboard_pasteText = trace(function pasteText(text)
    {
        var converter = new Showdown.converter();
        var html = converter.makeHtml(text);
        UndoManager_newGroup("Paste");
        Clipboard_pasteHTML(html);
        UndoManager_newGroup();
    });

    // public
    Clipboard_pasteHTML = trace(function pasteHTML(html)
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

        var div = DOM_createElement(document,"DIV");
        div.innerHTML = html;
        for (var child = div.firstChild; child != null; child = child.nextSibling)
            DOM_assignNodeIds(child);

        var nodes = new Array();
        for (var child = div.firstChild; child != null; child = child.nextSibling)
            nodes.push(child);

        UndoManager_newGroup("Paste");
        Clipboard_pasteNodes(nodes);
        UndoManager_newGroup();
    });

    // public
    Clipboard_pasteNodes = trace(function pasteNodes(nodes)
    {
        if ((nodes.length == 0) && isTableNode(nodes[0])) {
            // FIXME: this won't work; selectionRange is not defined
            var fromRegion = Tables_getTableRegionFromTable(nodes[0]);
            var toRegion = Tables_regionFromRange(selectionRange);
            if (toRegion != null) {
                return;
            }
        }
        Selection_hideWhileExecuting(function() {
            Selection_deleteContents();
            var range = Selection_get();
            if (range == null)
                return;

            if (nodes.length == 0)
                return;

            var pos = range.start;
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
                Formatting_splitTextBefore(node,offset);
                parent = node.parentNode;
                nextSibling = node;
                previousSibling = node.previousSibling;
            }

            var pasteList = new Array();

            if ((DOM_upperName(parent) == "UL") || (DOM_upperName(parent) == "OL")) {
                for (var i = 0; i < nodes.length; i++) {
                    if (DOM_upperName(nodes[i]) == "LI") {
                        pasteList.push(nodes[i]);
                    }
                    else if (DOM_upperName(nodes[i]) == DOM_upperName(parent)) {
                        for (var child = nodes[i].firstChild;
                             child != null;
                             child = child.nextSibling) {
                            pasteList.push(child);
                        }
                    }
                    else if (!isWhitespaceTextNode(nodes[i])) {
                        var li = DOM_createElement(document,"LI");
                        DOM_appendChild(li,nodes[i]);
                        pasteList.push(li);
                    }
                }
            }
            else {
                for (var i = 0; i < nodes.length; i++)
                    pasteList.push(nodes[i]);
            }

            for (var i = 0; i < pasteList.length; i++)
                DOM_insertBefore(parent,pasteList[i],nextSibling);

            if (pasteList.length == 0) {
                Selection_set(range.start.node,range.start.offset,range.end.node,range.end.offset);
                return;
            }

            var firstNode = pasteList[0];
            var lastNode = pasteList[pasteList.length-1];
            var pastedRange = new Range(firstNode.parentNode,DOM_nodeOffset(firstNode),
                                        lastNode.parentNode,DOM_nodeOffset(lastNode)+1);
            pastedRange.trackWhileExecuting(function() {

                if (nodes.length > 0) {
                    var offset;
                    if (nextSibling != null)
                        offset = DOM_nodeOffset(nextSibling);
                    else
                        offset = parent.childNodes.length;
                    range = new Range(parent,offset,parent,offset);
                    Selection_set(range.start.node,range.start.offset,
                                  range.end.node,range.end.offset);
                }
                range.trackWhileExecuting(function() {
                    if (previousSibling != null)
                        Formatting_mergeWithNeighbours(previousSibling,Formatting_MERGEABLE_INLINE);
                    if (nextSibling != null)
                        Formatting_mergeWithNeighbours(nextSibling,Formatting_MERGEABLE_INLINE);

                    Cursor_updateBRAtEndOfParagraph(parent);

                    pastedRange.ensureRangeValidHierarchy(true);
                });
            });

            Selection_set(range.start.node,range.start.offset,range.end.node,range.end.offset);
        });
    });

    function pasteImage(href)
    {
        // FIXME
    }

})();
