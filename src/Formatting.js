// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function() {
    function SelectionFormatting()
    {
        this.style = null;
        this.multipleStyles = false;
        this.bold = false;
        this.italic = false;
        this.underline = false;
        this.linethrough = false;
        this.overline = false;
        this.typewriter = false;
        this.ul = false;
        this.ol = false;
        this.inBrackets = false;
        this.inQuote = false;
    }

    SelectionFormatting.prototype.setStyle = function(style)
    {
        if (!this.multipleStyles) {
            if ((this.style != null) && (this.style != style)) {
                this.style = null;
                this.multipleStyles = true;
            }
            else {
                this.style = style;
            }
        }
    }

    function checkBracketsAndQuotes(node,offset,formatting)
    {
        var haveClosingBracket = false;
        var haveClosingQuote = false;
        while ((node != null) && (isInlineNode(node))) {
            if (node.nodeType == Node.TEXT_NODE) {
                for (var i = offset-1; i >= 0; i--) {
                    switch (node.nodeValue.charCodeAt(i)) {
                    case 0x28: // opening (
                        if (!haveClosingBracket)
                            formatting.inBrackets = true;
                        break;
                    case 0x29: // closing )
                        haveClosingBracket = true;
                        break;
                    case 0x201C: // opening "
                        if (!haveClosingQuote)
                            formatting.inQuote = true;
                        break;
                    case 0x201D: // closing "
                        haveClosingQuote = true;
                        break;
                    }
                }
            }

            node = prevNode(node);
            
            if (node.nodeType == Node.TEXT_NODE)
                offset = node.nodeValue.length;
            else
                offset = 0;
        }
    }

    function wrapNode(node,elementName)
    {
        var wrapper = document.createElement(elementName);
        node.parentNode.insertBefore(wrapper,node);
        moveNode(node,wrapper,null);
    }

    // public (for testing purposes only)
    function splitAroundSelection(range)
    {
        range.trackWhileExecuting(function() {

//            range.omitEmptyTextSelection(); // FIXME: enable this again?
            range.ensureRangeValidHierarchy();

            if ((range.start.node.nodeType == Node.TEXT_NODE) &&
                (range.start.offset > 0)) {
                splitTextBefore(range.start.node,range.start.offset);
                if (range.end.node == range.start.node)
                    range.end.offset -= range.start.offset;
                range.start.offset = 0;
            }
            else if (range.start.node.nodeType == Node.ELEMENT_NODE) {
                movePreceding(range.start.node,range.start.offset,isParagraphOrContainerNode);
            }
            else {
                movePreceding(range.start.node.parentNode,getOffsetOfNodeInParent(range.start.node),
                              isParagraphOrContainerNode);
            }

            // Save the start and end position of the range. The mutation listeners will move it
            // when the following node is moved, which we don't actually want in this case.
            var startNode = range.start.node;
            var startOffset = range.start.offset;
            var endNode = range.end.node;
            var endOffset = range.end.offset;

            if ((range.end.node.nodeType == Node.TEXT_NODE) &&
                (range.end.offset < range.end.node.nodeValue.length)) {
                splitTextAfter(range.end.node,range.end.offset);
            }
            else if (range.end.node.nodeType == Node.ELEMENT_NODE) {
                moveFollowing(range.end.node,range.end.offset,isParagraphOrContainerNode);
            }
            else {
                moveFollowing(range.end.node.parentNode,getOffsetOfNodeInParent(range.end.node)+1,
                              isParagraphOrContainerNode);
            }

            range.start.setNodeAndOffset(startNode,startOffset);
            range.end.setNodeAndOffset(endNode,endOffset);
        });
    }

    // public (for use by tests)
    function mergeWithNeighbours(node)
    {
        var parent = node.parentNode;
        if (parent == null)
            return;

        var start = node;
        var end = node;

        while ((start.previousSibling != null) && nodesMergable(start.previousSibling,start))
            start = start.previousSibling;

        while ((end.nextSibling != null) && nodesMergable(end,end.nextSibling))
            end = end.nextSibling;

        if (start != end) {
            var lastMerge;
            do {
                lastMerge = (start.nextSibling == end);
                mergeWithNextSibling(start);
            } while (!lastMerge);
        }

        function removePrecedingWhitespace(node)
        {
            while ((node.previousSibling != null) && isWhitespaceTextNode(node.previousSibling))
                node.parentNode.removeChild(node.previousSibling);
        }

        function removeFollowingWhitespace(node)
        {
            while ((node.nextSibling != null) && isWhitespaceTextNode(node.nextSibling))
                node.parentNode.removeChild(node.nextSibling);
        }

        function mergeWithNextSibling(current)
        {
            var parent = current.parentNode;
            var next = current.nextSibling;

            var currentLength = maxNodeOffset(current);
            var positions = Position.trackedPositions;
            var nextOffset = getOffsetOfNodeInParent(next);

            var lastChild = null;

            Position.ignoreEventsWhileExecuting(function() {
                if (current.nodeType == Node.TEXT_NODE) {
                    current.nodeValue += next.nodeValue;
                }
                else if (current.nodeType == Node.ELEMENT_NODE) {
                    lastChild = next.lastChild;
                    while (next.firstChild != null)
                        moveNode(next.firstChild,current,null);
                }
                parent.removeChild(next);

                for (var i = 0; i < positions.length; i++) {
                    var node = positions[i].node;
                    var offset = positions[i].offset;

                    if (node == next)
                        positions[i].setNodeAndOffset(current,offset+currentLength);
                    else if ((node == parent) && (offset == nextOffset))
                        positions[i].setNodeAndOffset(current,currentLength);
                    else if ((node == parent) && (offset > nextOffset))
                        positions[i].offset--;
                }
            });

            if (lastChild != null)
                mergeWithNeighbours(lastChild);
        }

        function nodesMergable(a,b)
        {
            if ((a.nodeType == Node.TEXT_NODE) && (b.nodeType == Node.TEXT_NODE))
                return true;
            else if ((a.nodeType == Node.ELEMENT_NODE) && (b.nodeType == Node.ELEMENT_NODE))
                return elementsMergable(a,b);
            else
                return false;
        }

        function elementsMergable(a,b)
        {
            if (isInlineNode(a) && isInlineNode(b) &&
                (a.nodeName == b.nodeName) &&
                (a.attributes.length == b.attributes.length)) {
                for (var i = 0; i < a.attributes.length; i++) {
                    var attrName = a.attributes[i].nodeName;
                    if (a.getAttribute(attrName) != b.getAttribute(attrName))
                        return false;
                }
                return true;
            }

            return false;
        }

    }

    function mergeRange(range)
    {
        var nodes = range.getAllNodes();
        for (var i = 0; i < nodes.length; i++) {
            var next;
            for (var p = nodes[i]; p != null; p = next) {
                next = p.parentNode;
                mergeWithNeighbours(p);
            }
        }
    }

    // public (called from cursor.js)
    function splitTextBefore(node,offset)
    {
        var before = document.createTextNode(node.nodeValue.slice(0,offset));

        node.parentNode.insertBefore(before,node);
        node.nodeValue = node.nodeValue.slice(offset);

        movePreceding(node.parentNode,getOffsetOfNodeInParent(node),isParagraphOrContainerNode);
    }

    // public
    function splitTextAfter(node,offset)
    {
        var after = document.createTextNode(node.nodeValue.slice(offset));

        node.parentNode.insertBefore(after,node.nextSibling);
        node.nodeValue = node.nodeValue.slice(0,offset);

        moveFollowing(node.parentNode,getOffsetOfNodeInParent(node)+1,isParagraphOrContainerNode);
    }

    // FIXME: movePreceding and moveNext could possibly be optimised by passing in a (parent,child)
    // pair instead of (node,offset), i.e. parent is the same as node, but rather than passing the
    // index of a child, we pass the child itself (or null if the offset is equal to
    // childNodes.length)
    function movePreceding(node,offset,parentCheckFn)
    {
        if (parentCheckFn(node) || (node == document.body))
            return;

        var toMove = new Array();
        for (var i = 0; i < offset; i++)
            toMove.push(node.childNodes[i]);

        if (toMove.length > 0) {
            var copy = shallowCopyElement(node);
            node.parentNode.insertBefore(copy,node);

            for (var i = 0; i < toMove.length; i++)
                moveNode(toMove[i],copy,null);
        }

        movePreceding(node.parentNode,getOffsetOfNodeInParent(node),parentCheckFn);
    }

    function moveFollowing(node,offset,parentCheckFn)
    {
        if (parentCheckFn(node) || (node == document.body))
            return;

        var toMove = new Array();
        for (var i = offset; i < node.childNodes.length; i++)
            toMove.push(node.childNodes[i]);

        if (toMove.length > 0) {
            var copy = shallowCopyElement(node);
            node.parentNode.insertBefore(copy,node.nextSibling);

            for (var i = 0; i < toMove.length; i++)
                moveNode(toMove[i],copy,null);
        }

        moveFollowing(node.parentNode,getOffsetOfNodeInParent(node)+1,parentCheckFn);
    }

    // public
    function reportSelectionFormatting()
    {
        var formatting = new SelectionFormatting();
        var selectionRange = getSelectionRange();
        if (selectionRange == null) {
            debug("reportSelectionFormatting: no selection");
            return; // FIXME: report that there is no formatting info available
        }
        var nodes = selectionRange.getOutermostSelectedNodes();
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            detectFormatting(formatting,node);
        }
        if (selectionRange != null) {
            checkBracketsAndQuotes(selectionRange.start.node,
                                   selectionRange.start.offset,
                                   formatting);
        }
        editor.reportFormatting(formatting);
        return;

        function detectFormatting(formatting,node)
        {
            if (node == null)
                return;

            if (node.nodeName == "B")
                formatting.bold = true;
            if (node.nodeName == "I")
                formatting.italic = true;
            if (node.nodeName == "U")
                formatting.underline = true;
            if (node.nodeName == "TT")
                formatting.typewriter = true;
            if (node.nodeName == "UL")
                formatting.ul = true;
            if (node.nodeName == "OL")
                formatting.ol = true;

            // In the case where a heading or PRE element has the class attribute set, we ignore
            // the class attribute and just go with the element name - otherwise it would really
            // complicate things (we don't support multiple styles for a single paragraph).
            if ((node.nodeName == "H1") ||
                (node.nodeName == "H2") ||
                (node.nodeName == "H3") ||
                (node.nodeName == "H4") ||
                (node.nodeName == "H5") ||
                (node.nodeName == "H6") ||
                (node.nodeName == "PRE")) {
                formatting.setStyle(node.nodeName);
            }
            else if ((node.nodeType == Node.ELEMENT_NODE) && node.hasAttribute("class")) {
                formatting.setStyle("."+node.getAttribute("class"));
            }
            else if (node.nodeName == "P") {
                formatting.setStyle(node.nodeName);
            }

            detectFormatting(formatting,node.parentNode);
        }
    }

    // public
    // "Wraps" a selection in a given element, i.e. ensures that all inline nodes that are part of
    // the selection have an ancestor of the given element type, e.g. B or UL. If the selection
    // starts or ends part-way through a text node, the text node(s) are split and the operation
    // is applied only to the portion of the text that is actually selected.
    function selectionWrapElement(elementName)
    {
        var range = selectionUnwrapElement(elementName);

        if ((range == null) ||
            ((range.start.node == range.end.node) && (range.start.offset == range.end.offset))) {
            return null;
        }

        range.trackWhileExecuting(function() {
            splitAroundSelection(range);

            var inlineNodes = range.getInlineNodes();
            for (var i = 0; i < inlineNodes.length; i++) {
                var node = inlineNodes[i];
                ensureValidHierarchy(node,true);

                // splitAroundSelection() ensured that there is a child element of the current
                // paragraph that is wholly contained within the selection. It is this element that
                // we will wrap.
                // Note that this part of the selection might already be wrapped in the requested
                // element; so we include a check to avoid double-wrapping.
                for (var p = node; p.parentNode != null; p = p.parentNode) {
                    if ((p.nodeName != elementName) && isParagraphNode(p.parentNode)) {
                        wrapNode(p,elementName);
                        break;
                    }
                }
            }

            mergeRange(range);
        });

        setSelectionRange(range);
        reportSelectionFormatting();
        return range;
    }

    // public
    // For all nodes in the selection, remove any ancestor nodes with the given name from the tree
    // (replacing them with their children)
    function selectionUnwrapElement(elementName)
    {
        var range = getSelectionRange();
        if ((range == null) ||
            ((range.start.node == range.end.node) && (range.start.offset == range.end.offset)))
            return null;

        range.trackWhileExecuting(function() {
            splitAroundSelection(range);

            var nodes = range.getAllNodes();
            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i].nodeType == Node.TEXT_NODE)
                    unwrapSingle(nodes[i],elementName);
            }

            mergeRange(range);
        });

        setSelectionRange(range);
        reportSelectionFormatting();
        return range;

        function unwrapSingle(node,elementName)
        {
            if (node == null)
                return;

            var parent = node.parentNode;
            if (node.nodeName == elementName) {
                // We found the node we're looking for. Move all of its children to its parent
                // and then remove the node
                removeNodeButKeepChildren(node);
            }

            unwrapSingle(parent,elementName);
        }
    }

    var PARAGRAPH_PROPERTIES = {
        "margin-left": true,
        "margin-right": true,
        "margin-top": true,
        "margin-bottom": true,

        "padding-left": true,
        "padding-right": true,
        "padding-top": true,
        "padding-bottom": true,

        "border-left-width": true,
        "border-right-width": true,
        "border-top-width": true,
        "border-bottom-width": true,

        "border-left-style": true,
        "border-right-style": true,
        "border-top-style": true,
        "border-bottom-style": true,

        "border-left-color": true,
        "border-right-color": true,
        "border-top-color": true,
        "border-bottom-color": true,

        "text-align": true,
        "line-height": true,
    };

    function getParagraphs(nodes)
    {
        var result = new Array();
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            getParagraphsRecursive(node);
            for (var ancestor = node.parentNode; ancestor != null; ancestor = ancestor.parentNode) {
                // FIXME: this is O(n^2)
                if (isParagraphNode(ancestor) && !haveNode(ancestor))
                    result.push(ancestor);
            }
        }
        return result;

        function haveNode(node)
        {
            for (var i = 0; i < result.length; i++) {
                if (result[i] == node)
                    return true;
            }
            return false;
        }

        function getParagraphsRecursive(node)
        {
            if (isParagraphNode(node)) {
                result.push(node);
            }
            else {
                for (var child = node.firstChild; child != null; child = child.nextSibling)
                    getParagraphsRecursive(child);
            }
        }
    }

    function removeProperties(node,propertiesToRemove)
    {
        for (var name in propertiesToRemove)
            node.style.removeProperty(name);
    }

    function removePropertiesRecursive(node,propertiesToRemove)
    {
        if (node.nodeType == Node.ELEMENT_NODE) {
            var next;
            for (var child = node.firstChild; child != null; child = next) {
                var next = child.nextSibling;
                removePropertiesRecursive(child,propertiesToRemove);
            }
            removeProperties(node,propertiesToRemove);

            if (node.nodeName == "SPAN") {
                var spanValue = node.getAttribute("style");
                if ((spanValue == null) || (spanValue == ""))
                    removeNodeButKeepChildren(node);
            }
            else if (node.nodeName == "B") {
                if (propertiesToRemove.hasOwnProperty("font-weight"))
                    removeNodeButKeepChildren(node);
            }
            else if (node.nodeName == "I") {
                if (propertiesToRemove.hasOwnProperty("font-style"))
                    removeNodeButKeepChildren(node);
            }
            else if (node.nodeName == "U") {
                if (propertiesToRemove.hasOwnProperty("text-decoration"))
                    removeNodeButKeepChildren(node);
            }
        }
    }

    function setInlinePropertiesRecursive(node,inlinePropertiesToSet)
    {
        if (isInlineNode(node)) {
            if (node.nodeType == Node.ELEMENT_NODE) {
                for (var name in inlinePropertiesToSet)
                    node.style.setProperty(name,inlinePropertiesToSet[name],null);
            }
        }
        else {
            var next;
            for (var child = node.firstChild; child != null; child = next)
                setInlinePropertiesRecursive(child,inlinePropertiesToSet);
        }
    }

    function setParagraphStyle(paragraph,style)
    {
        paragraph.removeAttribute("class");
        if (style == "") {
            if (paragraph.nodeName != "P")
                paragraph = replaceElement(paragraph,"P");
        }
        else if (style.charAt(0) == ".") {
            if (paragraph.nodeName != "P")
                paragraph = replaceElement(paragraph,"P");
            paragraph.setAttribute("class",style.slice(1));
        }
        else {
            if (paragraph.nodeName != style)
                replaceElement(paragraph,style);
        }
    }

    // public
    function applyFormattingChanges(style,properties)
    {
        if (properties == null)
            properties = new Object();

        var paragraphPropertiesToSet = new Object();
        var inlinePropertiesToSet = new Object();
        var paragraphPropertiesToRemove = new Object();
        var inlinePropertiesToRemove = new Object();

        for (var name in properties) {
            if (PARAGRAPH_PROPERTIES[name]) {
                if (properties[name] == null)
                    paragraphPropertiesToRemove[name] = properties[name];
                else
                    paragraphPropertiesToSet[name] = properties[name];
            }
            else {
                if (properties[name] == null)
                    inlinePropertiesToRemove[name] = properties[name];
                else
                    inlinePropertiesToSet[name] = properties[name];
            }
        }

        var range = getSelectionRange();
        if (range == null)
            return;

        range.trackWhileExecuting(function() {
            range.ensureRangeValidHierarchy();
            var nodes = range.getOutermostSelectedNodes();
            var paragraphs = getParagraphs(nodes);

/*
            // Set properties on inline nodes
            for (var i = 0; i < nodes.length; i++) {
                setInlinePropertiesRecursive(nodes[i],inlinePropertiesToSet);
            }

            // Remove properties from inline nodes
            for (var i = 0; i < nodes.length; i++) {
                removePropertiesRecursive(nodes[i],inlinePropertiesToRemove);
            }

            // Set properties on paragraph nodes
            for (var i = 0; i < paragraphs.length; i++) {
                for (var name in paragraphPropertiesToSet)
                    paragraphs[i].setProperty(name,paragraphPropertiesToSet[name],null);
            }

            // Remove properties from paragraph nodes
            for (var i = 0; i < paragraphs.length; i++) {
                removeProperties(paragraphs[i],paragraphPropertiesToRemove);
            }
*/

            // Set style on paragraph nodes
            if (style != null) {
                for (var i = 0; i < paragraphs.length; i++) {
                    setParagraphStyle(paragraphs[i],style);
                }
            }
        });

        return;
    }

    window.splitTextBefore = splitTextBefore;
    window.splitTextAfter = splitTextAfter;
    window.movePreceding = movePreceding;
    window.moveFollowing = moveFollowing;
    window.splitAroundSelection = splitAroundSelection;
    window.mergeWithNeighbours = mergeWithNeighbours;
    window.reportSelectionFormatting = reportSelectionFormatting;
    window.selectionWrapElement = selectionWrapElement;
    window.selectionUnwrapElement = selectionUnwrapElement;
    window.applyFormattingChanges = applyFormattingChanges;
})();
