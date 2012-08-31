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
        else if ((DOM_upperName(node) == "A") && node.hasAttribute("href")) {
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

    var expandRangeForCopy = trace(function expandRangeForCopy(range)
    {
        if (range == null)
            return range;

        var startInLI = null;
        for (var node = range.start.node; node != null; node = node.parentNode) {
            if (DOM_upperName(node) == "LI")
                startInLI = node;
        }

        var endInLI = null;
        for (var node = range.end.node; node != null; node = node.parentNode) {
            if (DOM_upperName(node) == "LI")
                endInLI = node;
        }

        if ((startInLI != null) && (startInLI == endInLI)) {
            var beforeRange = new Range(startInLI,0,
                                        range.start.node,range.start.offset);
            var afterRange = new Range(range.end.node,range.end.offset,
                                       endInLI,DOM_maxChildOffset(endInLI));
            var contentBefore = Range_hasContent(beforeRange);
            var contentAfter = Range_hasContent(afterRange);

            if (!contentBefore && !contentAfter) {
                var li = startInLI;
                var offset = DOM_nodeOffset(li);
                range = new Range(li.parentNode,offset,li.parentNode,offset+1);
            }
        }
        return range;
    });

    var copyRange = trace(function copyRange(range)
    {
        var html = "";
        var text = "";

        if (range != null) {
            var nodes;
            var region = Tables_regionFromRange(range);
            if (region != null) {
                nodes = [Tables_cloneRegion(region)];
            }
            else {
                nodes = Range_cloneContents(range);
            };

            var div = DOM_createElement(document,"DIV");
            for (var i = 0; i < nodes.length; i++)
                DOM_appendChild(div,nodes[i]);
            Main_removeSpecial(div);

            html = div.innerHTML;
            text = Clipboard_htmlToText(div);
        }

        return { "text/html": html,
                 "text/plain": text };
    });

    // public (FIXME: temp: for testing)
    Clipboard_htmlToText = trace(function htmlToText(node)
    {
        return Markdown_htmlToMarkdown(node);
    });

    // public
    Clipboard_cut = trace(function cut()
    {
        UndoManager_newGroup("Cut");
        var content;

        var range = Selection_get();
        range = expandRangeForCopy(range);
        content = copyRange(range);

        Selection_set(range.start.node,range.start.offset,range.end.node,range.end.offset);
        Selection_deleteContents();
        var selRange = Selection_get();
        if (selRange != null) {
            Range_trackWhileExecuting(selRange,function() {
                var node = Position_closestActualNode(selRange.start);
                while (node != null) {
                    var parent = node.parentNode;
                    if (isListItemNode(node)) {
                        if (!nodeHasContent(node))
                            DOM_deleteNode(node);
                    }
                    else if (isListNode(node)) {
                        var haveLI = false;
                        for (var c = node.firstChild; c != null; c = c.nextSibling) {
                            if (isListItemNode(c)) {
                                haveLI = true;
                                break;
                            }
                        }
                        if (!haveLI)
                            DOM_deleteNode(node);
                    }
                    node = parent;
                }
            });

            var pos = Position_closestMatchForwards(selRange.start,Position_okForMovement);
            Selection_set(pos.node,pos.offset,pos.node,pos.offset);
        }

        Cursor_ensureCursorVisible();

        PostponedActions_perform(UndoManager_newGroup);
        return content;
    });

    // public
    Clipboard_copy = trace(function copy()
    {
        var range = Selection_get();
        range = expandRangeForCopy(range);
        return copyRange(range);
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

    function insertChildrenBefore(parent,child,nextSibling,pastedNodes)
    {
        var next;
        for (var grandChild = child.firstChild; grandChild != null; grandChild = next) {
            next = grandChild.nextSibling;
            pastedNodes.push(grandChild);
            DOM_insertBefore(parent,grandChild,nextSibling);
        }
    }

    // public
    Clipboard_pasteNodes = trace(function pasteNodes(nodes)
    {
        for (var i = 0; i < nodes.length; i++)
            removeDuplicateIds(nodes[i]);

        if ((nodes.length == 0) && isTableNode(nodes[0])) {
            // FIXME: this won't work; selectionRange is not defined
            var fromRegion = Tables_getTableRegionFromTable(nodes[0]);
            var toRegion = Tables_regionFromRange(selectionRange);
            if (toRegion != null) {
                return;
            }
        }

        Selection_deleteContents(true);
        var range = Selection_get();
        if (range == null)
            return;

        if (nodes.length == 0)
            return;

        var parent;
        var previousSibling;
        var nextSibling;

        var start = range.start;
        start = Position_preferElementPosition(start);
        if (start.node.nodeType == Node.ELEMENT_NODE) {
            parent = start.node;
            nextSibling = start.node.childNodes[start.offset];
            previousSibling = start.node.childNodes[start.offset-1];
        }
        else {
            Formatting_splitTextAfter(start);
            parent = start.node.parentNode;
            nextSibling = start.node.nextSibling;
            previousSibling = start.node;
        }

        var prevLI = null;
        var inItem = null;
        var inList = null;
        var containerParent = null;

        for (var temp = parent; temp != null; temp = temp.parentNode) {
            if (isContainerNode(temp)) {
                if (isListItemNode(temp))
                    inItem = temp;
                if (isListNode(temp))
                    inList = temp;
                containerParent = temp.parentNode;
                break;
            }
        }

        var pastedNodes;
        if (inItem) {
            pastedNodes = new Array();
            for (var i = 0; i < nodes.length; i++) {
                var child = nodes[i];

                var offset = DOM_nodeOffset(nextSibling,parent);

                if (isListNode(child)) {
                    Formatting_movePreceding(new Position(parent,offset),
                                             function(x) { return (x == containerParent); });
                    insertChildrenBefore(inItem.parentNode,child,inItem,pastedNodes);
                }
                else if (isListItemNode(child)) {
                    Formatting_movePreceding(new Position(parent,offset),
                                             function(x) { return (x == containerParent); });
                    DOM_insertBefore(inItem.parentNode,child,inItem);
                    pastedNodes.push(child);
                }
                else {
                    DOM_insertBefore(parent,child,nextSibling);
                    pastedNodes.push(child);
                }
            }
        }
        else if (inList) {
            pastedNodes = new Array();
            for (var i = 0; i < nodes.length; i++) {
                var child = nodes[i];

                var offset = DOM_nodeOffset(nextSibling,parent);
                
                if (isListNode(child)) {
                    insertChildrenBefore(parent,child,nextSibling,pastedNodes);
                    prevLI = null;
                }
                else if (isListItemNode(child)) {
                    DOM_insertBefore(parent,child,nextSibling);
                    pastedNodes.push(child);
                    prevLI = null;
                }
                else if (!isWhitespaceTextNode(child)) {
                    if (prevLI == null)
                        prevLI = DOM_createElement(document,"LI");
                    DOM_appendChild(prevLI,child);
                    DOM_insertBefore(parent,prevLI,nextSibling);
                    pastedNodes.push(child);
                }
            }
        }
        else {
            pastedNodes = nodes;
            for (var i = 0; i < nodes.length; i++) {
                var child = nodes[i];
                DOM_insertBefore(parent,child,nextSibling);
            }
        }

        var prevOffset;
        if (previousSibling == null)
            prevOffset = 0;
        else
            prevOffset = DOM_nodeOffset(previousSibling);
        var nextOffset = DOM_nodeOffset(nextSibling,parent);

        var origRange = new Range(parent,prevOffset,parent,nextOffset);

        var firstPasted = pastedNodes[0];
        var lastPasted = pastedNodes[pastedNodes.length-1];
        var pastedRange = new Range(firstPasted,0,lastPasted,DOM_maxChildOffset(lastPasted));
        Range_trackWhileExecuting(origRange,function() {
        Range_trackWhileExecuting(pastedRange,function() {
            if (previousSibling != null)
                Formatting_mergeWithNeighbours(previousSibling,Formatting_MERGEABLE_INLINE);
            if (nextSibling != null)
                Formatting_mergeWithNeighbours(nextSibling,Formatting_MERGEABLE_INLINE);

            Cursor_updateBRAtEndOfParagraph(parent);

            Range_ensureValidHierarchy(pastedRange,true);
        })});

        var pos = new Position(origRange.end.node,origRange.end.offset);
        Position_trackWhileExecuting(pos,function() {
            while (true) {
                if (pos.node == document.body)
                    break;
                if (isContainerNode(pos.node) && !isListItemNode(pos.node))
                    break;
                if (!nodeHasContent(pos.node)) {
                    var oldNode = pos.node;
                    pos = new Position(pos.node.parentNode,DOM_nodeOffset(pos.node));
                    DOM_deleteNode(oldNode);
                }
                else
                    break;
            }
        });

        pos = new Position(pastedRange.end.node,pastedRange.end.offset);
        while (isOpaqueNode(pos.node))
            pos = new Position(pos.node.parentNode,DOM_nodeOffset(pos.node)+1);
        pos = Position_closestMatchBackwards(pos,Position_okForInsertion);

        Selection_set(pos.node,pos.offset,pos.node,pos.offset);
        Cursor_ensureCursorVisible();

        function removeDuplicateIds(node)
        {
            if ((node.nodeType == Node.ELEMENT_NODE) && node.hasAttribute("id")) {
                var existing = document.getElementById(node.getAttribute("id"));
                if ((existing != null) && (existing != node))
                    DOM_removeAttribute(node,"id");
            }
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                removeDuplicateIds(child);
        }
    });

    function pasteImage(href)
    {
        // FIXME
    }

})();
