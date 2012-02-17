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

            range.start.node = startNode;
            range.start.offset = startOffset;
            range.end.node = endNode;
            range.end.offset = endOffset;
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

                    if (node == next) {
                        positions[i].node = current;
                        positions[i].offset = offset+currentLength;
                    }
                    else if ((node == parent) && (offset == nextOffset)) {
                        positions[i].node = current;
                        positions[i].offset = currentLength;
                    }
                    else if ((node == parent) && (offset > nextOffset)) {
                        positions[i].offset--;
                    }
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
        var justWhitespace = true;
        for (var i = 0; i < offset; i++) {
            if (!isWhitespaceTextNode(node.childNodes[i]))
                justWhitespace = false;
            toMove.push(node.childNodes[i]);
        }

        if (toMove.length > 0) {
            if (justWhitespace) {
                for (var i = 0; i < toMove.length; i++)
                    moveNode(toMove[i],node.parentNode,node);
            }
            else {
                var copy = shallowCopyElement(node);
                node.parentNode.insertBefore(copy,node);

                for (var i = 0; i < toMove.length; i++)
                    moveNode(toMove[i],copy,null);
            }
        }

        movePreceding(node.parentNode,getOffsetOfNodeInParent(node),parentCheckFn);
    }

    function moveFollowing(node,offset,parentCheckFn)
    {
        if (parentCheckFn(node) || (node == document.body))
            return;

        var toMove = new Array();
        var justWhitespace = true;
        for (var i = offset; i < node.childNodes.length; i++) {
            if (!isWhitespaceTextNode(node.childNodes[i]))
                justWhitespace = false;
            toMove.push(node.childNodes[i]);
        }

        if (toMove.length > 0) {
            if (justWhitespace) {
                for (var i = 0; i < toMove.length; i++)
                    moveNode(toMove[i],node.parentNode,node.nextSibling);
            }
            else {
                var copy = shallowCopyElement(node);
                node.parentNode.insertBefore(copy,node.nextSibling);

                for (var i = 0; i < toMove.length; i++)
                    moveNode(toMove[i],copy,null);
            }
        }

        moveFollowing(node.parentNode,getOffsetOfNodeInParent(node)+1,parentCheckFn);
    }

    // public
    function getFormatting()
    {
        // FIXME: implement a more efficient version of this algorithm which avoids duplicate checks

        var range = getSelectionRange();
        var outermost = range.getOutermostNodes();
        var leafNodes = new Array();
        for (var i = 0; i < outermost.length; i++) {
            findLeafNodes(outermost[i],leafNodes);
        }

        var commonProperties = null;
        for (var i = 0; i < leafNodes.length; i++) {
            if (!isWhitespaceTextNode(leafNodes[i])) {
                var leafNodeProperties = getAllProperties(leafNodes[i]);
                if (commonProperties == null)
                    commonProperties = leafNodeProperties;
                else
                    commonProperties = intersection(commonProperties,leafNodeProperties);
            }
        }

        if (commonProperties == null)
            commonProperties = {};
        return commonProperties;

        function intersection(a,b)
        {
            var result = new Object();
            for (var name in a) {
                if (a[name] == b[name])
                    result[name] = a[name];
            }
            return result;
        }

        function findLeafNodes(node,result)
        {
            if (node.firstChild == null) {
                result.push(node);
            }
            else {
                for (var child = node.firstChild; child != null; child = child.nextSibling)
                    findLeafNodes(child,result);
            }
        }

        function getAllProperties(node)
        {
            if (node == node.ownerDocument.body)
                return new Object();

            var properties = getAllProperties(node.parentNode);

            if (node.nodeType == Node.ELEMENT_NODE) {
                if (node.hasAttribute("STYLE")) {
                    for (var i = 0; i < node.style.length; i++) {
                        var name = node.style[i];
                        var value = node.style.getPropertyValue(name);
                        properties[name] = value;
                    }
                }
                if (node.nodeName == "B") {
                    properties["font-weight"] = "bold";
                }
                else if (node.nodeName == "I") {
                    properties["font-style"] = "italic";
                }
                else if (node.nodeName == "U") {
                    var components = [];
                    if (properties["text-decoration"] != null) {
                        var components = properties["text-decoration"].toLowerCase().split(/\s+/);
                        if (components.indexOf("underline") == -1)
                            properties["text-decoration"] += " underline";
                    }
                    else {
                        properties["text-decoration"] = "underline";
                    }
                }
                else if (node.nodeName == "H1") {
                    properties["uxwrite-style"] = "H1";
                }
                else if (node.nodeName == "H2") {
                    properties["uxwrite-style"] = "H2";
                }
                else if (node.nodeName == "H3") {
                    properties["uxwrite-style"] = "H3";
                }
                else if (node.nodeName == "H4") {
                    properties["uxwrite-style"] = "H4";
                }
                else if (node.nodeName == "H5") {
                    properties["uxwrite-style"] = "H5";
                }
                else if (node.nodeName == "H6") {
                    properties["uxwrite-style"] = "H6";
                }
                else if (isParagraphNode(node)) {
                    if (node.hasAttribute("class"))
                        properties["uxwrite-style"] = "."+node.getAttribute("class");
                    else
                        properties["uxwrite-style"] = "";
                }
            }

            return properties;
        }
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
        var nodes = selectionRange.getOutermostNodes();
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
        "display": true,
    };

    function isParagraphProperty(name)
    {
        return PARAGRAPH_PROPERTIES[name];
    }

    function isInlineProperty(name)
    {
        return !PARAGRAPH_PROPERTIES[name];
    }

    function getParagraphs(nodes)
    {
        var array = new Array();
        var set = new NodeSet();
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];

            var haveParagraph = false;
            for (var ancestor = node; ancestor != null; ancestor = ancestor.parentNode) {   
                if (isParagraphNode(ancestor)) {
                    add(ancestor);
                    haveParagraph = true;
                }
            }

            if (!haveParagraph)
                recurse(node);
        }
        return array;

        function recurse(node)
        {
            if (isParagraphNode(node)) {
                add(node);
            }
            else {
                for (var child = node.firstChild; child != null; child = child.nextSibling)
                    recurse(child);
            }
        }

        function add(node)
        {
            array.push(node);
            set.add(node);
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

    function pushDownInlineProperties(outermost)
    {
        for (var i = 0; i < outermost.length; i++)
            outermost[i] = pushDownInlinePropertiesSingle(outermost[i]);
    }

    function pushDownInlinePropertiesSingle(target)
    {
        recurse(target.parentNode);
        return target;

        function recurse(node)
        {
            if (node.nodeType == Node.DOCUMENT_NODE)
                return;

            if (node.parentNode != null)
                recurse(node.parentNode);

            var inlineProperties = new Object();
            for (var i = 0; i < node.style.length; i++) {
                if (isInlineProperty(node.style[i]))
                    inlineProperties[node.style[i]] = node.style.getPropertyValue(node.style[i]);
            }

            for (var name in inlineProperties)
                node.style.removeProperty(name);

            if (node.nodeName == "B")
                inlineProperties["font-weight"] = "bold";
            if (node.nodeName == "I")
                inlineProperties["font-style"] = "italic";
            if (node.nodeName == "U") {
                if (inlineProperties["text-decoration"] != null)
                    inlineProperties["text-decoration"] += " underline";
                else
                    inlineProperties["text-decoration"] = "underline";
            }


            var special = extractSpecial(inlineProperties);
            var count = Object.getOwnPropertyNames(inlineProperties).length;

            if ((count > 0) || special.bold || special.italic || special.underline) {

                var next;
                for (var child = node.firstChild; child != null; child = next) {
                    next = child.nextSibling;

                    if (isWhitespaceTextNode(child))
                        continue;

                    var replacement = applyInlineFormatting(child,inlineProperties,special);
                    if (target == child)
                        target = replacement;
                }
            }

            if (node.hasAttribute("style") && (node.style.length == 0))
                node.removeAttribute("style");

            if ((node.nodeName == "B") || (node.nodeName == "I") || (node.nodeName == "U"))
                removeNodeButKeepChildren(node);
        }
    }

    function wrapInline(node,elementName)
    {
        if (!isInlineNode(node)) {
            var next;
            for (var child = node.firstChild; child != null; child = next) {
                next = child.nextSibling;
                wrapInline(child,elementName);
            }
            return node;
        }
        else {
            return wrapNode(node,elementName);
        }
    }

    function applyInlineFormatting(target,inlineProperties,special)
    {
        if (isWhitespaceTextNode(target))
            return;

        if (special.underline)
            target = wrapInline(target,"U");
        if (special.italic)
            target = wrapInline(target,"I");
        if (special.bold)
            target = wrapInline(target,"B");

        if ((Object.getOwnPropertyNames(inlineProperties).length > 0) &&
            ((target.nodeType != Node.ELEMENT_NODE) ||
             (target.nodeName == "B") ||
             (target.nodeName == "I") ||
             (target.nodeName == "U"))) {
            target = wrapInline(target,"SPAN");
        }

        for (var name in inlineProperties) {
            if (target.style.getPropertyValue(name) == null)
                target.style.setProperty(name,inlineProperties[name]);
        }

        return target;
    }

    function extractSpecial(properties)
    {
        var special = { bold: null, italic: null, underline: null };
        var fontWeight = properties["font-weight"];
        var fontStyle = properties["font-style"];
        var textDecoration = properties["text-decoration"];

        if (typeof(fontWeight) != "undefined") {
            special.bold = false;
            if ((fontWeight != null) &&
                (fontWeight.toLowerCase() == "bold")) {
                special.bold = true;
                delete properties["font-weight"];
            }
        }

        if (typeof(fontStyle) != "undefined") {
            special.italic = false;
            if ((fontStyle != null) &&
                (fontStyle.toLowerCase() == "italic")) {
                special.italic = true;
                delete properties["font-style"];
            }
        }

        if (typeof(textDecoration) != "undefined") {
            special.underline = false;
            if (textDecoration != null) {
                var values = textDecoration.toLowerCase().split(/\s+/);
                var index;
                while ((index = values.indexOf("underline")) >= 0) {
                    values.splice(index,1);
                    special.underline = true;
                }
                if (values.length == 0)
                    delete properties["text-decoration"];
                else
                    properties["text-decoration"] = values.join(" ");
            }
        }
        return special;
    }

    function removeProperties(outermost,properties,special)
    {
        var remaining = new Array();
        for (var i = 0; i < outermost.length; i++) {
            removePropertiesSingle(outermost[i],properties,special,remaining);
        }
        return remaining;
    }

    function getOutermostParagraphs(paragraphs)
    {
        var all = new NodeSet();
        for (var i = 0; i < paragraphs.length; i++)
            all.add(paragraphs[i]);

        var result = new Array();
        for (var i = 0; i < paragraphs.length; i++) {
            var haveAncestor = false;
            for (var p = paragraphs[i].parentNode; p != null; p = p.parentNode) {
                if (all.contains(p)) {
                    haveAncestor = true;
                    break;
                }
            }
            if (!haveAncestor)
                result.push(paragraphs[i]);
        }
        return result;
    }

    function removePropertiesSingle(node,properties,special,remaining)
    {
        if ((node.nodeType == Node.ELEMENT_NODE) && (node.hasAttribute("style"))) {
            for (var name in properties)
                node.style.removeProperty(name);
            if (node.style.length == 0)
                node.removeAttribute("style");
        }

        var willRemove = ((node.nodeName == "B") && (special.bold == false)) ||
                         ((node.nodeName == "I") && (special.italic == false)) ||
                         ((node.nodeName == "U") && (special.underline == false)) ||
                         ((node.nodeName == "SPAN") && !node.hasAttribute("style"));

        var childRemaining = willRemove ? remaining : null;

        var next;
        for (var child = node.firstChild; child != null; child = next) {
            next = child.nextSibling;
            removePropertiesSingle(child,properties,special,childRemaining);
        }

        if (willRemove)
            removeNodeButKeepChildren(node);
        else if (remaining != null)
            remaining.push(node);
    }

    // public
    function applyFormattingChanges(style,properties)
    {
        if (properties == null)
            properties = new Object();

        var paragraphProperties = new Object();
        var inlineProperties = new Object();

        for (var name in properties) {
            if (isParagraphProperty(name))
                paragraphProperties[name] = properties[name];
            else if (isInlineProperty(name))
                inlineProperties[name] = properties[name];
        }

        var range = getSelectionRange();
        if (range == null)
            return;

        range.trackWhileExecuting(function() {
            splitAroundSelection(range);
            range.expand();
            range.ensureRangeValidHierarchy();
            range.expand();
            var outermost = range.getOutermostNodes();
            var target = null;

            var paragraphs;
            if (outermost.length > 0) {
                paragraphs = getParagraphs(outermost);
            }
            else {
                if ((range.start.node.nodeType == Node.ELEMENT_NODE) &&
                    (range.start.node.childNodes[range.start.offset] != null)) {
                    target = range.start.node.childNodes[range.start.offset];
                }
                else {
                    target = range.start.node;
                }
                ensureValidHierarchy(target);
                paragraphs = getParagraphs([target]);
            }

            var special = extractSpecial(inlineProperties);

            // Push down inline properties
            pushDownInlineProperties(outermost);

            outermost = removeProperties(outermost,inlineProperties,special);

            // Set properties on inline nodes
            var inlinePropertiesToSet = new Object();
            for (var name in inlineProperties) {
                if (inlineProperties[name] != null)
                    inlinePropertiesToSet[name] = inlineProperties[name];
            }

            for (var i = 0; i < outermost.length; i++) {
                applyInlineFormatting(outermost[i],inlinePropertiesToSet,special);
            }


            // Remove properties from paragraph nodes
            paragraphs = removeProperties(paragraphs,paragraphProperties,{});

            // Set properties on paragraph nodes
            var paragraphPropertiesToSet = new Object();
            for (var name in paragraphProperties) {
                if (paragraphProperties[name] != null)
                    paragraphPropertiesToSet[name] = paragraphProperties[name];
            }

            var outermostParagraphs = getOutermostParagraphs(paragraphs);
            for (var i = 0; i < outermostParagraphs.length; i++) {
                for (var name in paragraphPropertiesToSet) {
                    var p = outermostParagraphs[i];
                    p.style.setProperty(name,paragraphPropertiesToSet[name],null);
                }
            }

            // Set style on paragraph nodes
            if (style != null) {
                for (var i = 0; i < paragraphs.length; i++) {
                    setParagraphStyle(paragraphs[i],style);
                }
            }

            mergeRange(range);

            if (target != null) {
                for (var p = target; p != null; p = next) {
                    next = p.parentNode;
                    mergeWithNeighbours(p);
                }
            }
        });

        updateSelectionDisplay();
        return;
    }

    window.splitTextBefore = splitTextBefore;
    window.splitTextAfter = splitTextAfter;
    window.movePreceding = movePreceding;
    window.moveFollowing = moveFollowing;
    window.splitAroundSelection = splitAroundSelection;
    window.mergeWithNeighbours = mergeWithNeighbours;
    window.reportSelectionFormatting = reportSelectionFormatting;
    window.getFormatting = getFormatting;
    window.selectionWrapElement = selectionWrapElement;
    window.selectionUnwrapElement = selectionUnwrapElement;
    window.isParagraphProperty = isParagraphProperty;
    window.isInlineProperty = isInlineProperty;
    window.getParagraphs = getParagraphs;
    window.pushDownInlineProperties = pushDownInlineProperties;
    window.removeProperties = removeProperties;
    window.applyFormattingChanges = applyFormattingChanges;
})();
