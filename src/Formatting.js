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
                movePreceding(range.start.node,range.start.offset,isBlockNode);
            }
            else {
                movePreceding(range.start.node.parentNode,DOM.nodeOffset(range.start.node),
                              isBlockNode);
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
                moveFollowing(range.end.node,range.end.offset,isBlockNode);
            }
            else {
                moveFollowing(range.end.node.parentNode,DOM.nodeOffset(range.end.node)+1,
                              isBlockNode);
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
               DOM.nodesMergeable(start.previousSibling,start,whiteList))
            start = start.previousSibling;

        while ((end.nextSibling != null) &&
               DOM.nodesMergeable(end,end.nextSibling,whiteList))
            end = end.nextSibling;

        if (start != end) {
            var lastMerge;
            do {
                lastMerge = (start.nextSibling == end);

                var lastChild = null;
                if (start.nodeType == Node.ELEMENT_NODE)
                    lastChild = start.lastChild;

                DOM.mergeWithNextSibling(start,whiteList);

                if (lastChild != null)
                    mergeWithNeighbours(lastChild,whiteList);
            } while (!lastMerge);
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
    function splitTextBefore(node,offset,parentCheckFn,force)
    {
        if (parentCheckFn == null)
            parentCheckFn = isBlockNode;
        var before = DOM.createTextNode(document,node.nodeValue.slice(0,offset));

        DOM.insertBefore(node.parentNode,before,node);
        DOM.deleteCharacters(node,0,offset);

        movePreceding(node.parentNode,DOM.nodeOffset(node),parentCheckFn,force);
        return new Position(before,before.nodeValue.length);
    }

    // public
    function splitTextAfter(node,offset,parentCheckFn,force)
    {
        if (parentCheckFn == null)
            parentCheckFn = isBlockNode;
        var after = DOM.createTextNode(document,node.nodeValue.slice(offset));

        DOM.insertBefore(node.parentNode,after,node.nextSibling);
        DOM.deleteCharacters(node,offset);

        moveFollowing(node.parentNode,DOM.nodeOffset(node)+1,parentCheckFn,force);
        return new Position(after,0);
    }

    // FIXME: movePreceding and moveNext could possibly be optimised by passing in a (parent,child)
    // pair instead of (node,offset), i.e. parent is the same as node, but rather than passing the
    // index of a child, we pass the child itself (or null if the offset is equal to
    // childNodes.length)
    function movePreceding(node,offset,parentCheckFn,force)
    {
        if (parentCheckFn(node) || (node == document.body))
            return new Position(node,offset);

        var toMove = new Array();
        var justWhitespace = true;
        var result = new Position(node,offset);
        for (var i = 0; i < offset; i++) {
            if (!isWhitespaceTextNode(node.childNodes[i]))
                justWhitespace = false;
            toMove.push(node.childNodes[i]);
        }

        if ((toMove.length > 0) || force) {
            if (justWhitespace && !force) {
                for (var i = 0; i < toMove.length; i++)
                    DOM.insertBefore(node.parentNode,toMove[i],node);
            }
            else {
                var copy = DOM.shallowCopyElement(node);
                DOM.insertBefore(node.parentNode,copy,node);

                for (var i = 0; i < toMove.length; i++)
                    DOM.insertBefore(copy,toMove[i],null);
                result = new Position(copy,copy.childNodes.length);
            }
        }

        movePreceding(node.parentNode,DOM.nodeOffset(node),parentCheckFn,force);
        return result;
    }

    function moveFollowing(node,offset,parentCheckFn,force)
    {
        if (parentCheckFn(node) || (node == document.body))
            return new Position(node,offset);

        var toMove = new Array();
        var justWhitespace = true;
        var result =  new Position(node,offset);
        for (var i = offset; i < node.childNodes.length; i++) {
            if (!isWhitespaceTextNode(node.childNodes[i]))
                justWhitespace = false;
            toMove.push(node.childNodes[i]);
        }

        if ((toMove.length > 0) || force) {
            if (justWhitespace && !force) {
                for (var i = 0; i < toMove.length; i++)
                    DOM.insertBefore(node.parentNode,toMove[i],node.nextSibling);
            }
            else {
                var copy = DOM.shallowCopyElement(node);
                DOM.insertBefore(node.parentNode,copy,node.nextSibling);

                for (var i = 0; i < toMove.length; i++)
                    DOM.insertBefore(copy,toMove[i],null);
                result = new Position(copy,0);
            }
        }

        moveFollowing(node.parentNode,DOM.nodeOffset(node)+1,parentCheckFn,force);
        return result;
    }

    // public
    function paragraphTextUpToPosition(pos)
    {
        if (pos.node.nodeType == Node.TEXT_NODE) {
            return stringToStartOfParagraph(pos.node,pos.offset);
        }
        else {
            return stringToStartOfParagraph(pos.closestActualNode(),0);
        }

        function stringToStartOfParagraph(node,offset)
        {
            var start = node;
            var components = new Array();
            while (isInlineNode(node)) {
                if (node.nodeType == Node.TEXT_NODE) {
                    if (node == start)
                        components.push(node.nodeValue.slice(0,offset));
                    else
                        components.push(node.nodeValue);
                }

                if (node.previousSibling != null) {
                    node = node.previousSibling;
                    while (isInlineNode(node) && (node.lastChild != null))
                        node = node.lastChild;
                }
                else {
                    node = node.parentNode;
                }
            }
            return components.reverse().join("");
        }
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

        getFlags(range.start,commonProperties);

        return commonProperties;

        function getFlags(pos,commonProperties)
        {
            var strBeforeCursor = paragraphTextUpToPosition(pos);

            if (isWhitespaceString(strBeforeCursor)) {
                var firstInParagraph = true;
                for (var p = pos.node; isInlineNode(p); p = p.parentNode) {
                    if (p.previousSibling != null)
                        firstInParagraph = false;
                }
                if (firstInParagraph)
                    commonProperties["uxwrite-shift"] = "true";
            }
            if (strBeforeCursor.match(/\.\s+$/))
                commonProperties["uxwrite-shift"] = "true";
            if (strBeforeCursor.match(/\([^\)]*$/))
                commonProperties["uxwrite-inbrackets"] = "true";
            if (strBeforeCursor.match(/\u201c[^\u201d]*$/))
                commonProperties["uxwrite-inquotes"] = "true";
        }

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
            if (DOM.upperName(node) == "B") {
                properties["font-weight"] = "bold";
            }
            else if (DOM.upperName(node) == "I") {
                properties["font-style"] = "italic";
            }
            else if (DOM.upperName(node) == "U") {
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
            else if (DOM.upperName(node) == "H1") {
                properties["uxwrite-style"] = "H1";
            }
            else if (DOM.upperName(node) == "H2") {
                properties["uxwrite-style"] = "H2";
            }
            else if (DOM.upperName(node) == "H3") {
                properties["uxwrite-style"] = "H3";
            }
            else if (DOM.upperName(node) == "H4") {
                properties["uxwrite-style"] = "H4";
            }
            else if (DOM.upperName(node) == "H5") {
                properties["uxwrite-style"] = "H5";
            }
            else if (DOM.upperName(node) == "H6") {
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
        var wasHeading = isHeadingNode(paragraph);
        paragraph.removeAttribute("class");
        if (style == "") {
            if (DOM.upperName(paragraph) != "P")
                paragraph = DOM.replaceElement(paragraph,"P");
        }
        else if (style.charAt(0) == ".") {
            if (DOM.upperName(paragraph) != "P")
                paragraph = DOM.replaceElement(paragraph,"P");
            paragraph.setAttribute("class",style.slice(1));
        }
        else {
            if (DOM.upperName(paragraph) != style)
                paragraph = DOM.replaceElement(paragraph,style);
        }
        var isHeading = isHeadingNode(paragraph);
        if (wasHeading && !isHeading)
            paragraph.removeAttribute("id");
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

            if (DOM.upperName(node) == "B")
                inlineProperties["font-weight"] = "bold";
            if (DOM.upperName(node) == "I")
                inlineProperties["font-style"] = "italic";
            if (DOM.upperName(node) == "U") {
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

            if ((DOM.upperName(node) == "B") ||
                (DOM.upperName(node) == "I") ||
                (DOM.upperName(node) == "U"))
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
             (DOM.upperName(target) == "B") ||
             (DOM.upperName(target) == "I") ||
             (DOM.upperName(target) == "U"))) {
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

        var willRemove = ((DOM.upperName(node) == "B") && (special.bold != null)) ||
                         ((DOM.upperName(node) == "I") && (special.italic != null)) ||
                         ((DOM.upperName(node) == "U") && (special.underline != null)) ||
                         ((DOM.upperName(node) == "SPAN") && !node.hasAttribute("style")
                                                          && !isSpecialSpan(node));

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

        function isSpecialSpan(span)
        {
            return (span.hasAttribute("class") &&
                    (span.getAttribute("class").indexOf(Keys.UXWRITE_PREFIX) == 0));
        }
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

        var selectionRange = Selection.getSelectionRange();
        if (selectionRange == null)
            return;

        var range = new Range(selectionRange.start.node,selectionRange.start.offset,
                              selectionRange.end.node,selectionRange.end.offset);
        var positions = [selectionRange.start,selectionRange.end,
                         range.start,range.end];

        Position.trackWhileExecuting(positions,function() {
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

        Selection.setSelectionRange(selectionRange);
        return;
    }

    // public
    function setStyleElement(cssText)
    {
        // Get the head element, or create it if it doesn't already exist
        var head = DOM.documentHead(document);

        // Remove all existing style elements
        var removed = 0;
        var next;
        for (var child = head.firstChild; child; child = next) {
            var next = child.nextSibling;
            if (DOM.upperName(child) == "STYLE") {
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

    window.Formatting = new (function Formatting(){});
    Formatting.splitTextBefore = trace(splitTextBefore);
    Formatting.splitTextAfter = trace(splitTextAfter);
    Formatting.movePreceding = trace(movePreceding);
    Formatting.moveFollowing = trace(moveFollowing);
    Formatting.splitAroundSelection = trace(splitAroundSelection);
    Formatting.mergeWithNeighbours = trace(mergeWithNeighbours);
    Formatting.mergeRange = trace(mergeRange);
    Formatting.paragraphTextUpToPosition = trace(paragraphTextUpToPosition);
    Formatting.getFormatting = trace(getFormatting);
    Formatting.pushDownInlineProperties = trace(pushDownInlineProperties);
    Formatting.applyFormattingChanges = trace(applyFormattingChanges);
    Formatting.setStyleElement = trace(setStyleElement);

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

        "force": true,
    };

})();
