// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Formatting_splitTextBefore;
var Formatting_splitTextAfter;
var Formatting_movePreceding;
var Formatting_moveFollowing;
var Formatting_splitAroundSelection;
var Formatting_mergeWithNeighbours;
var Formatting_mergeRange;
var Formatting_paragraphTextUpToPosition;
var Formatting_getFormatting;
var Formatting_pushDownInlineProperties;
var Formatting_applyFormattingChanges;
var Formatting_formatInlineNode;

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

    // private
    var getStyleProperties = trace(function getStyleProperties(element,dontReplace)
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
    });

    // public (for testing purposes only)
    Formatting_splitAroundSelection = trace(function splitAroundSelection(range,allowDirectInline)
    {
        range.trackWhileExecuting(function() {

//            range.omitEmptyTextSelection(); // FIXME: enable this again?
            if (!allowDirectInline)
                range.ensureRangeInlineNodesInParagraph();
            range.ensureRangeValidHierarchy();

            if ((range.start.node.nodeType == Node.TEXT_NODE) &&
                (range.start.offset > 0)) {
                Formatting_splitTextBefore(range.start);
                if (range.end.node == range.start.node)
                    range.end.offset -= range.start.offset;
                range.start.offset = 0;
            }
            else if (range.start.node.nodeType == Node.ELEMENT_NODE) {
                Formatting_movePreceding(range.start,isBlockNode);
            }
            else {
                Formatting_movePreceding(new Position(range.start.node.parentNode,
                                                      DOM_nodeOffset(range.start.node)),
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
                Formatting_splitTextAfter(range.end);
            }
            else if (range.end.node.nodeType == Node.ELEMENT_NODE) {
                Formatting_moveFollowing(range.end,isBlockNode);
            }
            else {
                Formatting_moveFollowing(new Position(range.end.node.parentNode,
                                                      DOM_nodeOffset(range.end.node)+1),
                                         isBlockNode);
            }

            range.start.node = startNode;
            range.start.offset = startOffset;
            range.end.node = endNode;
            range.end.offset = endOffset;
        });
    });

    // public (for use by tests)
    Formatting_mergeWithNeighbours = trace(function mergeWithNeighbours(node,whiteList)
    {
        var parent = node.parentNode;
        if (parent == null)
            return;

        var start = node;
        var end = node;

        while ((start.previousSibling != null) &&
               DOM_nodesMergeable(start.previousSibling,start,whiteList))
            start = start.previousSibling;

        while ((end.nextSibling != null) &&
               DOM_nodesMergeable(end,end.nextSibling,whiteList))
            end = end.nextSibling;

        if (start != end) {
            var lastMerge;
            do {
                lastMerge = (start.nextSibling == end);

                var lastChild = null;
                if (start.nodeType == Node.ELEMENT_NODE)
                    lastChild = start.lastChild;

                DOM_mergeWithNextSibling(start,whiteList);

                if (lastChild != null)
                    Formatting_mergeWithNeighbours(lastChild,whiteList);
            } while (!lastMerge);
        }
    });

    // public
    Formatting_mergeRange = trace(function mergeRange(range,whiteList)
    {
        var nodes = range.getAllNodes();
        for (var i = 0; i < nodes.length; i++) {
            var next;
            for (var p = nodes[i]; p != null; p = next) {
                next = p.parentNode;
                Formatting_mergeWithNeighbours(p,whiteList);
            }
        }
    });

    // public (called from cursor.js)
    Formatting_splitTextBefore = trace(function splitTextBefore(pos,parentCheckFn,force)
    {
        var node = pos.node;
        var offset = pos.offset;
        if (parentCheckFn == null)
            parentCheckFn = isBlockNode;

        if (force || (offset > 0)) {
            var before = DOM_createTextNode(document,"");
            DOM_insertBefore(node.parentNode,before,node);
            DOM_moveCharacters(node,0,offset,before,0,false,true);
            Formatting_movePreceding(new Position(node.parentNode,DOM_nodeOffset(node)),
                                     parentCheckFn,force);
            return new Position(before,before.nodeValue.length);
        }
        else {
            Formatting_movePreceding(new Position(node.parentNode,DOM_nodeOffset(node)),
                                     parentCheckFn,force);
            return pos;
        }
    });

    // public
    Formatting_splitTextAfter = trace(function splitTextAfter(pos,parentCheckFn,force)
    {
        var node = pos.node;
        var offset = pos.offset;
        if (parentCheckFn == null)
            parentCheckFn = isBlockNode;

        if (force || (offset < pos.node.nodeValue.length)) {
            var after = DOM_createTextNode(document,"");
            DOM_insertBefore(node.parentNode,after,node.nextSibling);
            DOM_moveCharacters(node,offset,node.nodeValue.length,after,0,true,false);
            Formatting_moveFollowing(new Position(node.parentNode,DOM_nodeOffset(node)+1),
                                     parentCheckFn,force);
            return new Position(after,0);
        }
        else {
            Formatting_moveFollowing(new Position(node.parentNode,DOM_nodeOffset(node)+1),
                                     parentCheckFn,force);
            return pos;
        }
    });

    // FIXME: movePreceding and moveNext could possibly be optimised by passing in a (parent,child)
    // pair instead of (node,offset), i.e. parent is the same as node, but rather than passing the
    // index of a child, we pass the child itself (or null if the offset is equal to
    // childNodes.length)
    // public
    Formatting_movePreceding = trace(function movePreceding(pos,parentCheckFn,force)
    {
        var node = pos.node;
        var offset = pos.offset;
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
                    DOM_insertBefore(node.parentNode,toMove[i],node);
            }
            else {
                var copy = DOM_shallowCopyElement(node);
                DOM_insertBefore(node.parentNode,copy,node);

                for (var i = 0; i < toMove.length; i++)
                    DOM_insertBefore(copy,toMove[i],null);
                result = new Position(copy,copy.childNodes.length);
            }
        }

        Formatting_movePreceding(new Position(node.parentNode,DOM_nodeOffset(node)),
                                 parentCheckFn,force);
        return result;
    });

    // public
    Formatting_moveFollowing = trace(function moveFollowing(pos,parentCheckFn,force)
    {
        var node = pos.node;
        var offset = pos.offset;
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
                    DOM_insertBefore(node.parentNode,toMove[i],node.nextSibling);
            }
            else {
                var copy = DOM_shallowCopyElement(node);
                DOM_insertBefore(node.parentNode,copy,node.nextSibling);

                for (var i = 0; i < toMove.length; i++)
                    DOM_insertBefore(copy,toMove[i],null);
                result = new Position(copy,0);
            }
        }

        Formatting_moveFollowing(new Position(node.parentNode,DOM_nodeOffset(node)+1),
                                 parentCheckFn,force);
        return result;
    });

    // public
    Formatting_paragraphTextUpToPosition = trace(function paragraphTextUpToPosition(pos)
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
    });

    // public
    Formatting_getFormatting = trace(function getFormatting()
    {
        // FIXME: implement a more efficient version of this algorithm which avoids duplicate checks

        var range = Selection_get();
        if (range == null)
            return {};

        var outermost = range.getOutermostNodes(true);

        var leafNodes = new Array();
        for (var i = 0; i < outermost.length; i++) {
            findLeafNodes(outermost[i],leafNodes);
        }
        var empty = range.isEmpty();

        var commonProperties = null;
        for (var i = 0; i < leafNodes.length; i++) {
            if (!isWhitespaceTextNode(leafNodes[i]) || empty) {
                var leafNodeProperties = getAllProperties(leafNodes[i]);
                if (leafNodeProperties["uxwrite-style"] == null)
                    leafNodeProperties["uxwrite-style"] = Keys.NONE_STYLE;
                if (commonProperties == null)
                    commonProperties = leafNodeProperties;
                else
                    commonProperties = intersection(commonProperties,leafNodeProperties);
            }
        }

        if (commonProperties == null)
            commonProperties = {"uxwrite-style": Keys.NONE_STYLE};

        for (var i = 0; i < leafNodes.length; i++) {
            var leaf = leafNodes[i];
            if (isListItemNode(leaf)) {
                if (DOM_upperName(leaf.parentNode) == "UL")
                    commonProperties["uxwrite-in-ul"] = "true";
                else if (DOM_upperName(leaf.parentNode) == "OL")
                    commonProperties["uxwrite-in-ol"] = "true";
            }
            else {
                for (var ancestor = leaf;
                     ancestor.parentNode != null;
                     ancestor = ancestor.parentNode) {

                    if (isListItemNode(ancestor.parentNode)) {
                        var havePrev = false;
                        for (var c = ancestor.previousSibling; c != null; c = c.previousSibling) {
                            if (!isWhitespaceTextNode(c)) {
                                havePrev = true;
                                break;
                            }
                        }
                        if (!havePrev) {
                            var listNode = ancestor.parentNode.parentNode;
                            if (DOM_upperName(listNode) == "UL")
                                commonProperties["uxwrite-in-ul"] = "true";
                            else if (DOM_upperName(listNode) == "OL")
                                commonProperties["uxwrite-in-ol"] = "true";
                        }
                    }
                }
            }
        }

        getFlags(range.start,commonProperties);

        return commonProperties;

        function getFlags(pos,commonProperties)
        {
            var strBeforeCursor = Formatting_paragraphTextUpToPosition(pos);

            if (isWhitespaceString(strBeforeCursor)) {
                var firstInParagraph = true;
                for (var p = pos.node; isInlineNode(p); p = p.parentNode) {
                    if (p.previousSibling != null)
                        firstInParagraph = false;
                }
                if (firstInParagraph)
                    commonProperties["uxwrite-shift"] = "true";
            }
            if (strBeforeCursor.match(/\.\s*$/))
                commonProperties["uxwrite-shift"] = "true";
            if (strBeforeCursor.match(/\([^\)]*$/))
                commonProperties["uxwrite-in-brackets"] = "true";
            if (strBeforeCursor.match(/\u201c[^\u201d]*$/))
                commonProperties["uxwrite-in-quotes"] = "true";
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
    });

    // private
    var getAllProperties = trace(function getAllProperties(node)
    {
        if (node == node.ownerDocument.body)
            return new Object();

        var properties = getAllProperties(node.parentNode);

        if (node.nodeType == Node.ELEMENT_NODE) {
            // Note: Style names corresponding to element names must be in lowercase, because
            // canonicaliseSelector() in Styles.js always converts selectors to lowercase.
            if (node.hasAttribute("STYLE")) {
                var nodeProperties = getStyleProperties(node);
                for (var name in nodeProperties)
                    properties[name] = nodeProperties[name];
            }
            if (DOM_upperName(node) == "B") {
                properties["font-weight"] = "bold";
            }
            else if (DOM_upperName(node) == "I") {
                properties["font-style"] = "italic";
            }
            else if (DOM_upperName(node) == "U") {
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
            else if (DOM_upperName(node) == "TT") {
                properties["uxwrite-in-tt"] = "true";
            }
            else if (DOM_upperName(node) == "H1") {
                properties["uxwrite-style"] = "h1";
            }
            else if (DOM_upperName(node) == "H2") {
                properties["uxwrite-style"] = "h2";
            }
            else if (DOM_upperName(node) == "H3") {
                properties["uxwrite-style"] = "h3";
            }
            else if (DOM_upperName(node) == "H4") {
                properties["uxwrite-style"] = "h4";
            }
            else if (DOM_upperName(node) == "H5") {
                properties["uxwrite-style"] = "h5";
            }
            else if (DOM_upperName(node) == "H6") {
                properties["uxwrite-style"] = "h6";
            }
            else if (DOM_upperName(node) == "PRE") {
                properties["uxwrite-style"] = "pre";
            }
            else if (DOM_upperName(node) == "BLOCKQUOTE") {
                properties["uxwrite-style"] = "blockquote";
            }
            else if (DOM_upperName(node) == "IMG") {
                properties["uxwrite-in-image"] = "true";
            }
            else if (DOM_upperName(node) == "TABLE") {
                properties["uxwrite-in-table"] = "true";
            }
            else if ((DOM_upperName(node) == "A") && node.hasAttribute("href")) {
                var href = node.getAttribute("href");
                if (href.charAt(0) == "#")
                    properties["uxwrite-in-reference"] = "true";
                else
                    properties["uxwrite-in-link"] = "true";
            }
            else if (isParagraphNode(node)) {
                if (node.hasAttribute("class"))
                    properties["uxwrite-style"] = "."+node.getAttribute("class");
                else
                    properties["uxwrite-style"] = "p";
            }

            if (isOutlineItemTitleNode(node) && node.hasAttribute("id")) {
                properties["uxwrite-in-item-title"] = node.getAttribute("id");
            }
        }

        return properties;
    });

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

        "border-top-left-radius": true,
        "border-top-right-radius": true,
        "border-bottom-left-radius": true,
        "border-bottom-right-radius": true,

        "text-align": true,
        "line-height": true,
        "display": true,

        "width": true,
        "height": true,
    };

    var SPECIAL_PROPERTIES = {
        "-webkit-text-size-adjust": true, // set on HTML element for text scaling purposes
    };

    function isParagraphProperty(name)
    {
        return PARAGRAPH_PROPERTIES[name];
    }

    function isInlineProperty(name)
    {
        return !PARAGRAPH_PROPERTIES[name] && !SPECIAL_PROPERTIES[name];
    }

    // private
    var putDirectInlineChildrenInParagraphs = trace(
        function putDirectInlineChildrenInParagraphs(parent)
    {
        var inlineChildren = new Array();
        for (var child = parent.firstChild; child != null; child = child.nextSibling)
            if (isInlineNode(child))
                inlineChildren.push(child);
        for (var i = 0; i < inlineChildren.length; i++) {
            if (inlineChildren[i].parentNode == parent) { // may already have been moved
                if (!isWhitespaceTextNode(inlineChildren[i]))
                    Hierarchy_wrapInlineNodesInParagraph(inlineChildren[i]);
            }
        }
    });

    // private
    var getParagraphs = trace(function getParagraphs(nodes)
    {
        var array = new Array();
        var set = new NodeSet();
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];

            var haveParagraph = false;
            for (var ancestor = node; ancestor != null; ancestor = ancestor.parentNode) {   
                if (isListItemNode(ancestor))
                    putDirectInlineChildrenInParagraphs(ancestor);
            }
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
            if (isListItemNode(node))
                putDirectInlineChildrenInParagraphs(node);
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
            if (!set.contains(node)) {
                array.push(node);
                set.add(node);
            }
        }
    });

    // private
    var setParagraphStyle = trace(function setParagraphStyle(paragraph,style)
    {
        var wasHeading = isHeadingNode(paragraph);
        DOM_removeAttribute(paragraph,"class");
        if (style == "") {
            if (DOM_upperName(paragraph) != "P")
                paragraph = DOM_replaceElement(paragraph,"P");
        }
        else if (style.charAt(0) == ".") {
            if (DOM_upperName(paragraph) != "P")
                paragraph = DOM_replaceElement(paragraph,"P");
            DOM_setAttribute(paragraph,"class",style.slice(1));
        }
        else {
            var elementName = style.toUpperCase();
            if (!PARAGRAPH_ELEMENTS[elementName])
                throw new Error(style+" is not a valid paragraph element");
            if (DOM_upperName(paragraph) != elementName)
                paragraph = DOM_replaceElement(paragraph,elementName);
        }
        var isHeading = isHeadingNode(paragraph);
        if (wasHeading && !isHeading)
            DOM_removeAttribute(paragraph,"id");
    });

    // public
    Formatting_pushDownInlineProperties = trace(function pushDownInlineProperties(outermost)
    {
        for (var i = 0; i < outermost.length; i++)
            outermost[i] = pushDownInlinePropertiesSingle(outermost[i]);
    });

    // private
    var pushDownInlinePropertiesSingle = trace(function pushDownInlinePropertiesSingle(target)
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

            var remove = new Object();
            for (var name in inlineProperties)
                remove[name] = null;
            DOM_setStyleProperties(node,remove);

            if (DOM_upperName(node) == "B")
                inlineProperties["font-weight"] = "bold";
            if (DOM_upperName(node) == "I")
                inlineProperties["font-style"] = "italic";
            if (DOM_upperName(node) == "U") {
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
                DOM_removeAttribute(node,"style");

            if ((DOM_upperName(node) == "B") ||
                (DOM_upperName(node) == "I") ||
                (DOM_upperName(node) == "U"))
                DOM_removeNodeButKeepChildren(node);
        }
    });

    // private
    var wrapInline = trace(function wrapInline(node,elementName)
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
            return DOM_wrapNode(node,elementName);
        }
    });

    // private
    var applyInlineFormatting = trace(function applyInlineFormatting(target,inlineProperties,
                                                                     special,applyToWhitespace)
    {
        if (!applyToWhitespace && isWhitespaceTextNode(target))
            return;

        if (special.underline)
            target = wrapInline(target,"U");
        if (special.italic)
            target = wrapInline(target,"I");
        if (special.bold)
            target = wrapInline(target,"B");

        if ((Object.getOwnPropertyNames(inlineProperties).length > 0) &&
            ((target.nodeType != Node.ELEMENT_NODE) ||
             isSpecialSpan(target) ||
             (DOM_upperName(target) == "B") ||
             (DOM_upperName(target) == "I") ||
             (DOM_upperName(target) == "U"))) {
            target = wrapInline(target,"SPAN");
        }


        var propertiesToSet = new Object();
        for (var name in inlineProperties) {
            var existing = target.style.getPropertyValue(name);
            if ((existing == null) || (existing == ""))
                propertiesToSet[name] = inlineProperties[name];
        }
        DOM_setStyleProperties(target,propertiesToSet);

        return target;
    });

    // private
    var extractSpecial = trace(function extractSpecial(properties)
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
    });

    // private
    var removeProperties = trace(function removeProperties(outermost,properties)
    {
        properties = clone(properties);
        var special = extractSpecial(properties);
        var remaining = new Array();
        for (var i = 0; i < outermost.length; i++) {
            removePropertiesSingle(outermost[i],properties,special,remaining);
        }
        return remaining;
    });

    // private
    var getOutermostParagraphs = trace(function getOutermostParagraphs(paragraphs)
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
    });

    // private
    var removePropertiesSingle = trace(function removePropertiesSingle(node,properties,
                                                                       special,remaining)
    {
        if ((node.nodeType == Node.ELEMENT_NODE) && (node.hasAttribute("style"))) {
            var remove = new Object();
            for (var name in properties)
                remove[name] = null;
            DOM_setStyleProperties(node,remove);
        }

        var willRemove = ((DOM_upperName(node) == "B") && (special.bold != null)) ||
                         ((DOM_upperName(node) == "I") && (special.italic != null)) ||
                         ((DOM_upperName(node) == "U") && (special.underline != null)) ||
                         ((DOM_upperName(node) == "SPAN") && !node.hasAttribute("style")
                                                          && !isSpecialSpan(node));

        var childRemaining = willRemove ? remaining : null;

        var next;
        for (var child = node.firstChild; child != null; child = next) {
            next = child.nextSibling;
            removePropertiesSingle(child,properties,special,childRemaining);
        }

        if (willRemove)
            DOM_removeNodeButKeepChildren(node);
        else if (remaining != null)
            remaining.push(node);
    });

    function isSpecialSpan(span)
    {
        return ((DOM_upperName(span) == "SPAN") &&
                span.hasAttribute("class") &&
                (span.getAttribute("class").indexOf(Keys.UXWRITE_PREFIX) == 0));
    }

    // private
    var containsOnlyWhitespace = trace(function containsOnlyWhitespace(ancestor)
    {
        for (child = ancestor.firstChild; child != null; child = child.nextSibling) {
            if (!isWhitespaceTextNode(child))
                return false;
        }
        return true;
    });

    // public
    Formatting_applyFormattingChanges = trace(function applyFormattingChanges(style,properties)
    {
        UndoManager_newGroup("Apply formatting changes");

        if (properties == null)
            properties = new Object();

        if (style == Keys.NONE_STYLE)
            style = null;

        var paragraphProperties = new Object();
        var inlineProperties = new Object();

        for (var name in properties) {
            if (isParagraphProperty(name))
                paragraphProperties[name] = properties[name];
            else if (isInlineProperty(name))
                inlineProperties[name] = properties[name];
        }

        var selectionRange = Selection_get();
        if (selectionRange == null)
            return;

        // If we're applying formatting properties to an empty selection, and the node of the
        // selection start & end is an element, add an empty text node so that we have something
        // to apply the formatting to.
        if (selectionRange.isEmpty() && (selectionRange.start.node.nodeType == Node.ELEMENT_NODE)) {
            var node = selectionRange.start.node;
            var offset = selectionRange.start.offset;
            var text = DOM_createTextNode(document,"");
            DOM_insertBefore(node,text,node.childNodes[offset]);
            Selection_set(text,0,text,0);
            selectionRange = Selection_get();
        }

        // If the cursor is in a container (such as BODY OR FIGCAPTION), and not inside a paragraph,
        // put it in one so we can set a paragraph style

        if ((style != null) && selectionRange.isEmpty()) {
            var node = selectionRange.singleNode();
            while (isInlineNode(node))
                node = node.parentNode;
            if (isContainerNode(node) && containsOnlyInlineChildren(node)) {
                var p = DOM_createElement(document,"P");
                DOM_appendChild(node,p);
                while (node.firstChild != p)
                    DOM_appendChild(p,node.firstChild);
                Cursor_updateBRAtEndOfParagraph(p);
            }
        }


        var range = new Range(selectionRange.start.node,selectionRange.start.offset,
                              selectionRange.end.node,selectionRange.end.offset);
        var positions = [selectionRange.start,selectionRange.end,
                         range.start,range.end];

        var allowDirectInline = (style == null);
        Position.trackWhileExecuting(positions,function() {
            Formatting_splitAroundSelection(range,allowDirectInline);
            range.expand();
            if (!allowDirectInline)
                range.ensureRangeInlineNodesInParagraph();
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
            Formatting_pushDownInlineProperties(outermost);

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
                var applyToWhitespace = (outermost.length == 1);
                applyInlineFormatting(outermost[i],toSet,special,applyToWhitespace);
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
            for (var i = 0; i < outermostParagraphs.length; i++)
                DOM_setStyleProperties(outermostParagraphs[i],paragraphPropertiesToSet);

            // Set style on paragraph nodes
            if (style != null) {
                for (var i = 0; i < paragraphs.length; i++) {
                    setParagraphStyle(paragraphs[i],style);
                }
            }

            Formatting_mergeRange(range,Formatting_MERGEABLE_INLINE);

            if (target != null) {
                for (var p = target; p != null; p = next) {
                    next = p.parentNode;
                    Formatting_mergeWithNeighbours(p,Formatting_MERGEABLE_INLINE);
                }
            }
        });

        // The current cursor position may no longer be valid, e.g. if a heading span was inserted
        // and the cursor is at a position that is now immediately before the span.
        var start = Position_closestMatchForwards(selectionRange.start,Position_okForInsertion);
        var end = Position_closestMatchBackwards(selectionRange.end,Position_okForInsertion);
        var tempRange = new Range(start.node,start.offset,end.node,end.offset);
        tempRange = tempRange.forwards();
        tempRange.ensureRangeValidHierarchy();
        start = tempRange.start;
        end = tempRange.end;
        Selection_set(start.node,start.offset,end.node,end.offset);

        function containsOnlyInlineChildren(node)
        {
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                if (!isInlineNode(child))
                    return false;
            }
            return true;
        }
    });

    Formatting_formatInlineNode = trace(function formatInlineNode(node,properties)
    {
        properties = clone(properties);
        var special = extractSpecial(properties);
        return applyInlineFormatting(node,properties,special,true);
    });

    Formatting_MERGEABLE_INLINE = {
        "SPAN": true,
        "A": true,
        "Q": true,
        "FONT": true,
        "BASEFONT": true,

         // HTML 4.01 Section 9.2.1: Phrase elements
        "EM": true,
        "STRONG": true,
        "DFN": true,
        "CODE": true,
        "SAMP": true,
        "KBD": true,
        "VAR": true,
        "CITE": true,
        "ABBR": true,
        "ACRONYM": true,

        // HTML 4.01 Section 9.2.3: Subscripts and superscripts
        "SUB": true,
        "SUP": true,

        // HTML 4.01 Section 15.2.1: Font style elements
        "TT": true,
        "I": true,
        "B": true,
        "BIG": true,
        "SMALL": true,
        "STRIKE": true,
        "S": true,
        "U": true,
    };

    Formatting_MERGEABLE_BLOCK = {
        "P": true,
        "H1": true,
        "H2": true,
        "H3": true,
        "H4": true,
        "H5": true,
        "H6": true,
        "DIV": true,
        "PRE": true,
        "BLOCKQUOTE": true,

        "UL": true,
        "OL":  true,
        "LI": true,
    };

    Formatting_MERGEABLE_BLOCK_AND_INLINE = new Object();
    for (var name in Formatting_MERGEABLE_INLINE)
        Formatting_MERGEABLE_BLOCK_AND_INLINE[name] = Formatting_MERGEABLE_INLINE[name];
    for (var name in Formatting_MERGEABLE_BLOCK)
        Formatting_MERGEABLE_BLOCK_AND_INLINE[name] = Formatting_MERGEABLE_BLOCK[name];
    Formatting_MERGEABLE_BLOCK_AND_INLINE["force"] = true;

})();
