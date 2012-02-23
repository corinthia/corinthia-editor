// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function() {

    // Some properties in CSS, such as 'margin', 'border', and 'padding', are shorthands which
    // set multiple, more fine-grained properties. The CSS spec outlines what these are - e.g.
    // an assignment to the 'margin' property is considered a simultaneous assignment to
    // 'margin-left', 'margin-right', 'margin-top', and 'margin-bottom' properties.

    // However, Firefox contains a bug (https://bugzilla.mozilla.org/show_bug.cgi?id=241234),
    // which has gone unfixed for more than six years, whereby it actually sets different
    // properties for *-left and *-right, which are reflected when examining the style property
    // of an element. Additionally, it also gives an error if you try to set these, so if you simply
    // get all the style properties and try to set them again it won't work.

    // To get around this problem, we record the following set of replacements. When getting the
    // style properties of an element, we replace any properties with the names given below with
    // their corresponding spec name. A null entry means that property should be ignored altogether.

    // You should always use getStyleProperties() instead of accessing element.style directly.

    var CSS_PROPERTY_REPLACEMENTS = {
        "margin-left-value": "margin-left",
        "margin-left-ltr-source": null,
        "margin-left-rtl-source": null,
        "margin-right-value": "margin-right",
        "margin-right-ltr-source": null,
        "margin-right-rtl-source": null,
        "padding-left-value": "padding-left",
        "padding-left-ltr-source": null,
        "padding-left-rtl-source": null,
        "padding-right-value": "padding-right",
        "padding-right-ltr-source": null,
        "padding-right-rtl-source": null,
        "border-right-width-value": "border-right-width",
        "border-right-width-ltr-source": null,
        "border-right-width-rtl-source": null,
        "border-left-width-value": "border-left-width",
        "border-left-width-ltr-source": null,
        "border-left-width-rtl-source": null,
        "border-right-color-value": "border-right-color",
        "border-right-color-ltr-source": null,
        "border-right-color-rtl-source": null,
        "border-left-color-value": "border-left-color",
        "border-left-color-ltr-source": null,
        "border-left-color-rtl-source": null,
        "border-right-style-value": "border-right-style",
        "border-right-style-ltr-source": null,
        "border-right-style-rtl-source": null,
        "border-left-style-value": "border-left-style",
        "border-left-style-ltr-source": null,
        "border-left-style-rtl-source": null,
    };

    function getStyleProperties(element,dontReplace)
    {
        var properties = new Object();

        for (var i = 0; i < element.style.length; i++) {
            var name = element.style[i];
            var value = element.style.getPropertyValue(name);

            var replacement;
            if (dontReplace) {
                replacement = name;
            }
            else {
                replacement = CSS_PROPERTY_REPLACEMENTS[name];
                if (typeof(replacement) == "undefined")
                    replacement = name;
            }

            if (replacement != null)
                properties[replacement] = value;
        }
        return properties;
    }

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

    // FIXME: call this from getFormatting()
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
    function mergeWithNeighbours(node,whiteList)
    {
        var parent = node.parentNode;
        if (parent == null)
            return;

        var start = node;
        var end = node;

        while ((start.previousSibling != null) &&
               nodesMergable(start.previousSibling,start,whiteList))
            start = start.previousSibling;

        while ((end.nextSibling != null) &&
               nodesMergable(end,end.nextSibling,whiteList))
            end = end.nextSibling;

        if (start != end) {
            var lastMerge;
            do {
                lastMerge = (start.nextSibling == end);

                var lastChild = null;
                if (start.nodeType == Node.ELEMENT_NODE)
                    lastChild = start.lastChild;

                mergeWithNextSibling(start,whiteList);

                if (lastChild != null)
                    mergeWithNeighbours(lastChild,whiteList);
            } while (!lastMerge);
        }
    }

    function mergeWithNextSibling(current,whiteList)
    {
        var parent = current.parentNode;
        var next = current.nextSibling;

        var currentLength = maxNodeOffset(current);
        var positions = Position.trackedPositions;
        var nextOffset = getOffsetOfNodeInParent(next);

        var lastChild = null;

        if (current.nodeType == Node.ELEMENT_NODE) {
            lastChild = current.lastChild;
            DOM.moveNode(next,current,null);
            DOM.removeNodeButKeepChildren(next);
        }
        else {
            Position.ignoreEventsWhileExecuting(function() {
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

                if (current.nodeType == Node.TEXT_NODE) {
                    current.nodeValue += next.nodeValue;
                }

                DOM.deleteNode(next);
            });
        }

        if ((lastChild != null) && (lastChild.nextSibling != null) &&
            nodesMergable(lastChild,lastChild.nextSibling,whiteList)) {
            mergeWithNextSibling(lastChild);
        }
    }

    function nodesMergable(a,b,whiteList)
    {
        if ((a.nodeType == Node.TEXT_NODE) && (b.nodeType == Node.TEXT_NODE))
            return true;
        else if ((a.nodeType == Node.ELEMENT_NODE) && (b.nodeType == Node.ELEMENT_NODE))
            return elementsMergable(a,b);
        else
            return false;

        function elementsMergable(a,b)
        {
            if ((a.nodeName == b.nodeName) &&
                whiteList[a.nodeName] &&
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

    function mergeRange(range,whiteList)
    {
        var nodes = range.getAllNodes();
        for (var i = 0; i < nodes.length; i++) {
            var next;
            for (var p = nodes[i]; p != null; p = next) {
                next = p.parentNode;
                mergeWithNeighbours(p,whiteList);
            }
        }
    }

    // public (called from cursor.js)
    function splitTextBefore(node,offset)
    {
        var before = DOM.createTextNode(document,node.nodeValue.slice(0,offset));

        DOM.insertBefore(node.parentNode,before,node);
        node.nodeValue = node.nodeValue.slice(offset);

        movePreceding(node.parentNode,getOffsetOfNodeInParent(node),isParagraphOrContainerNode);
    }

    // public
    function splitTextAfter(node,offset)
    {
        var after = DOM.createTextNode(document,node.nodeValue.slice(offset));

        DOM.insertBefore(node.parentNode,after,node.nextSibling);
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
                    DOM.moveNode(toMove[i],node.parentNode,node);
            }
            else {
                var copy = DOM.shallowCopyElement(node);
                DOM.insertBefore(node.parentNode,copy,node);

                for (var i = 0; i < toMove.length; i++)
                    DOM.moveNode(toMove[i],copy,null);
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
                    DOM.moveNode(toMove[i],node.parentNode,node.nextSibling);
            }
            else {
                var copy = DOM.shallowCopyElement(node);
                DOM.insertBefore(node.parentNode,copy,node.nextSibling);

                for (var i = 0; i < toMove.length; i++)
                    DOM.moveNode(toMove[i],copy,null);
            }
        }

        moveFollowing(node.parentNode,getOffsetOfNodeInParent(node)+1,parentCheckFn);
    }

    // public
    function getFormatting()
    {
        // FIXME: implement a more efficient version of this algorithm which avoids duplicate checks

        var range = Selection.getSelectionRange();
        if (range == null)
            return {};

        var outermost = range.getOutermostNodes(true);

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
    }

    function getAllProperties(node)
    {
        if (node == node.ownerDocument.body)
            return new Object();

        var properties = getAllProperties(node.parentNode);

        if (node.nodeType == Node.ELEMENT_NODE) {
            if (node.hasAttribute("STYLE")) {
                var nodeProperties = getStyleProperties(node);
                for (var name in nodeProperties)
                    properties[name] = nodeProperties[name];
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
                paragraph = DOM.replaceElement(paragraph,"P");
        }
        else if (style.charAt(0) == ".") {
            if (paragraph.nodeName != "P")
                paragraph = DOM.replaceElement(paragraph,"P");
            paragraph.setAttribute("class",style.slice(1));
        }
        else {
            if (paragraph.nodeName != style)
                DOM.replaceElement(paragraph,style);
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
            var nodeProperties = getStyleProperties(node);
            for (var name in nodeProperties) {
                if (isInlineProperty(name)) {
                    inlineProperties[name] = nodeProperties[name];
                }
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
                DOM.removeNodeButKeepChildren(node);
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
            return DOM.wrapNode(node,elementName);
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
            var existing = target.style.getPropertyValue(name);
            if ((existing == null) || (existing == ""))
                target.style.setProperty(name,inlineProperties[name],null);
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

    function removeProperties(outermost,properties)
    {
        properties = clone(properties);
        var special = extractSpecial(properties);
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

        var willRemove = ((node.nodeName == "B") && (special.bold != null)) ||
                         ((node.nodeName == "I") && (special.italic != null)) ||
                         ((node.nodeName == "U") && (special.underline != null)) ||
                         ((node.nodeName == "SPAN") && !node.hasAttribute("style"));

        var childRemaining = willRemove ? remaining : null;

        var next;
        for (var child = node.firstChild; child != null; child = next) {
            next = child.nextSibling;
            removePropertiesSingle(child,properties,special,childRemaining);
        }

        if (willRemove)
            DOM.removeNodeButKeepChildren(node);
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

        var range = Selection.getSelectionRange();
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
            if (outermost.length > 0)
                paragraphs = getParagraphs(outermost);
            else
                paragraphs = getParagraphs([range.singleNode()]);

            // Push down inline properties
            pushDownInlineProperties(outermost);

            outermost = removeProperties(outermost,inlineProperties);

            // Set properties on inline nodes
            for (var i = 0; i < outermost.length; i++) {
                var existing = getAllProperties(outermost[i]);
                var toSet = new Object();
                for (var name in inlineProperties) {
                    if ((inlineProperties[name] != null) &&
                        (existing[name] != inlineProperties[name])) {
                        toSet[name] = inlineProperties[name];
                    }
                }

                var special = extractSpecial(toSet);
                applyInlineFormatting(outermost[i],toSet,special);
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

            mergeRange(range,Formatting.MERGEABLE_INLINE);

            if (target != null) {
                for (var p = target; p != null; p = next) {
                    next = p.parentNode;
                    mergeWithNeighbours(p,Formatting.MERGEABLE_INLINE);
                }
            }
        });

        Selection.updateSelectionDisplay();
        return;
    }

    // public
    function setStyleElement(cssText)
    {
        // Get the head element, or create it if it doesn't already exist
        var heads = document.getElementsByTagName("HEAD");
        var head;
        if (heads.length == 0) {
            head = DOM.createElement(document,"HEAD");
            DOM.insertBefore(document.documentElement,head,document.documentElement.firstChild);
        }
        else {
            head = heads[0];
        }

        // Remove all existing style elements
        var removed = 0;
        var next;
        for (var child = head.firstChild; child; child = next) {
            var next = child.nextSibling;
            if (child.nodeName == "STYLE") {
                DOM.deleteNode(child);
                removed++;
            }
        }

        // Add the new style element
        var style = DOM.createElement(document,"STYLE");
        style.setAttribute("type","text/css");
        DOM.appendChild(style,DOM.createTextNode(document,cssText));
        DOM.appendChild(head,style);
    }

    window.Formatting = new Object();
    Formatting.splitTextBefore = splitTextBefore;
    Formatting.splitTextAfter = splitTextAfter;
    Formatting.movePreceding = movePreceding;
    Formatting.moveFollowing = moveFollowing;
    Formatting.splitAroundSelection = splitAroundSelection;
    Formatting.mergeWithNeighbours = mergeWithNeighbours;
    Formatting.mergeWithNextSibling = mergeWithNextSibling;
    Formatting.nodesMergable = nodesMergable;
    Formatting.mergeRange = mergeRange;
    Formatting.getFormatting = getFormatting;
    Formatting.pushDownInlineProperties = pushDownInlineProperties;
    Formatting.applyFormattingChanges = applyFormattingChanges;
    Formatting.setStyleElement = setStyleElement;

    Formatting.MERGEABLE_INLINE = {
        "B": true,
        "I": true,
        "U": true,
        "SPAN": true,
        "A": true,
        "S": true
    };

    Formatting.MERGEABLE_BLOCK_AND_INLINE = {
        "B": true,
        "I": true,
        "U": true,
        "SPAN": true,
        "A": true,
        "S": true,

        "P": true,
        "H1": true,
        "H2": true,
        "H3": true,
        "H4": true,
        "H5": true,
        "H6": true,
        "DIV": true,
        "PRE": true,

        "UL": true,
        "OL":  true,
        "LI": true,
    };

})();
