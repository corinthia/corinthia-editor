// This file is part of the Corinthia project (http://corinthia.io).
//
// See the COPYRIGHT.txt file distributed with this work for
// information regarding copyright ownership.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function(api) {

    var Formatting = api.Formatting; // export

    var Collections = api.Collections; // import
    var Cursor = api.Cursor; // import
    var DOM = api.DOM; // import
    var Hierarchy = api.Hierarchy; // import
    var Position = api.Position; // import
    var Range = api.Range; // import
    var Selection = api.Selection; // import
    var Traversal = api.Traversal; // import
    var Types = api.Types; // import
    var UndoManager = api.UndoManager; // import
    var Util = api.Util; // import

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
    function getStyleProperties(element,dontReplace) {
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
    Formatting.splitAroundSelection = function(range,allowDirectInline) {
        Range.trackWhileExecuting(range,function() {
            if (!allowDirectInline)
                Range.ensureInlineNodesInParagraph(range);
            Range.ensureValidHierarchy(range);

            if ((range.start.node.nodeType == Node.TEXT_NODE) &&
                (range.start.offset > 0)) {
                Formatting.splitTextBefore(range.start);
                if (range.end.node == range.start.node)
                    range.end.offset -= range.start.offset;
                range.start.offset = 0;
            }
            else if (range.start.node.nodeType == Node.ELEMENT_NODE) {
                Formatting.movePreceding(range.start,Types.isBlockOrNoteNode);
            }
            else {
                Formatting.movePreceding(new Position.Position(range.start.node.parentNode,
                                                      DOM.nodeOffset(range.start.node)),
                                         Types.isBlockOrNoteNode);
            }

            // Save the start and end position of the range. The mutation listeners will move it
            // when the following node is moved, which we don't actually want in this case.
            var startNode = range.start.node;
            var startOffset = range.start.offset;
            var endNode = range.end.node;
            var endOffset = range.end.offset;

            if ((range.end.node.nodeType == Node.TEXT_NODE) &&
                (range.end.offset < range.end.node.nodeValue.length)) {
                Formatting.splitTextAfter(range.end);
            }
            else if (range.end.node.nodeType == Node.ELEMENT_NODE) {
                Formatting.moveFollowing(range.end,Types.isBlockOrNoteNode);
            }
            else {
                Formatting.moveFollowing(new Position.Position(range.end.node.parentNode,
                                                      DOM.nodeOffset(range.end.node)+1),
                                         Types.isBlockOrNoteNode);
            }

            range.start.node = startNode;
            range.start.offset = startOffset;
            range.end.node = endNode;
            range.end.offset = endOffset;
        });
    }

    // public
    Formatting.mergeUpwards = function(node,whiteList) {
        while ((node != null) && whiteList[node._type]) {
            var parent = node.parentNode;
            Formatting.mergeWithNeighbours(node,whiteList,true);
            node = parent;
        }
    }

    function isDiscardable(node) {
        if (node.nodeType != Node.ELEMENT_NODE)
            return false;

        if (!Types.isInlineNode(node))
            return false;

        if (Types.isOpaqueNode(node))
            return false;

        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            if (!isDiscardable(child))
                return false;
        }

        return true;
    }

    // public (for use by tests)
    Formatting.mergeWithNeighbours = function(node,whiteList,trim) {
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

        if (trim) {
            while ((start.previousSibling != null) && isDiscardable(start.previousSibling))
                DOM.deleteNode(start.previousSibling);
            while ((end.nextSibling != null) && isDiscardable(end.nextSibling))
                DOM.deleteNode(end.nextSibling);
        }

        if (start != end) {
            var lastMerge;
            do {
                lastMerge = (start.nextSibling == end);

                var lastChild = null;
                if (start.nodeType == Node.ELEMENT_NODE)
                    lastChild = start.lastChild;

                DOM.mergeWithNextSibling(start,whiteList);

                if (lastChild != null)
                    Formatting.mergeWithNeighbours(lastChild,whiteList);
            } while (!lastMerge);
        }
    }

    // private
    function mergeRange(range,whiteList) {
        var nodes = Range.getAllNodes(range);
        for (var i = 0; i < nodes.length; i++) {
            var next;
            for (var p = nodes[i]; p != null; p = next) {
                next = p.parentNode;
                Formatting.mergeWithNeighbours(p,whiteList);
            }
        }
    }

    // public (called from cursor.js)
    Formatting.splitTextBefore = function(pos,parentCheckFn,force) {
        var node = pos.node;
        var offset = pos.offset;
        if (parentCheckFn == null)
            parentCheckFn = Types.isBlockNode;

        if (force || (offset > 0)) {
            var before = DOM.createTextNode(document,"");
            DOM.insertBefore(node.parentNode,before,node);
            DOM.moveCharacters(node,0,offset,before,0,false,true);
            Formatting.movePreceding(new Position.Position(node.parentNode,DOM.nodeOffset(node)),
                                     parentCheckFn,force);
            return new Position.Position(before,before.nodeValue.length);
        }
        else {
            Formatting.movePreceding(new Position.Position(node.parentNode,DOM.nodeOffset(node)),
                                     parentCheckFn,force);
            return pos;
        }
    }

    // public
    Formatting.splitTextAfter = function(pos,parentCheckFn,force) {
        var node = pos.node;
        var offset = pos.offset;
        if (parentCheckFn == null)
            parentCheckFn = Types.isBlockNode;

        if (force || (offset < pos.node.nodeValue.length)) {
            var after = DOM.createTextNode(document,"");
            DOM.insertBefore(node.parentNode,after,node.nextSibling);
            DOM.moveCharacters(node,offset,node.nodeValue.length,after,0,true,false);
            Formatting.moveFollowing(new Position.Position(node.parentNode,DOM.nodeOffset(node)+1),
                                     parentCheckFn,force);
            return new Position.Position(after,0);
        }
        else {
            Formatting.moveFollowing(new Position.Position(node.parentNode,DOM.nodeOffset(node)+1),
                                     parentCheckFn,force);
            return pos;
        }
    }

    // FIXME: movePreceding and moveNext could possibly be optimised by passing in a (parent,child)
    // pair instead of (node,offset), i.e. parent is the same as node, but rather than passing the
    // index of a child, we pass the child itself (or null if the offset is equal to
    // childNodes.length)
    // public
    Formatting.movePreceding = function(pos,parentCheckFn,force) {
        var node = pos.node;
        var offset = pos.offset;
        if (parentCheckFn(node) || (node == document.body))
            return new Position.Position(node,offset);

        var toMove = new Array();
        var justWhitespace = true;
        var result = new Position.Position(node,offset);
        for (var i = 0; i < offset; i++) {
            if (!Traversal.isWhitespaceTextNode(node.childNodes[i]))
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
                result = new Position.Position(copy,copy.childNodes.length);
            }
        }

        Formatting.movePreceding(new Position.Position(node.parentNode,DOM.nodeOffset(node)),
                                 parentCheckFn,force);
        return result;
    }

    // public
    Formatting.moveFollowing = function(pos,parentCheckFn,force) {
        var node = pos.node;
        var offset = pos.offset;
        if (parentCheckFn(node) || (node == document.body))
            return new Position.Position(node,offset);

        var toMove = new Array();
        var justWhitespace = true;
        var result =  new Position.Position(node,offset);
        for (var i = offset; i < node.childNodes.length; i++) {
            if (!Traversal.isWhitespaceTextNode(node.childNodes[i]))
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
                result = new Position.Position(copy,0);
            }
        }

        Formatting.moveFollowing(new Position.Position(node.parentNode,DOM.nodeOffset(node)+1),
                                 parentCheckFn,force);
        return result;
    }

    // public
    Formatting.paragraphTextUpToPosition = function(pos) {
        if (pos.node.nodeType == Node.TEXT_NODE) {
            return stringToStartOfParagraph(pos.node,pos.offset);
        }
        else {
            return stringToStartOfParagraph(Position.closestActualNode(pos),0);
        }

        function stringToStartOfParagraph(node,offset) {
            var start = node;
            var components = new Array();
            while (Types.isInlineNode(node)) {
                if (node.nodeType == Node.TEXT_NODE) {
                    if (node == start)
                        components.push(node.nodeValue.slice(0,offset));
                    else
                        components.push(node.nodeValue);
                }

                if (node.previousSibling != null) {
                    node = node.previousSibling;
                    while (Types.isInlineNode(node) && (node.lastChild != null))
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
    Formatting.getFormatting = function() {
        // FIXME: implement a more efficient version of this algorithm which avoids duplicate checks

        var range = Selection.get();
        if (range == null)
            return {};

        Range.assertValid(range,"Selection");

        var outermost = Range.getOutermostNodes(range,true);

        var leafNodes = new Array();
        for (var i = 0; i < outermost.length; i++) {
            findLeafNodes(outermost[i],leafNodes);
        }
        var empty = Range.isEmpty(range);

        var commonProperties = null;
        for (var i = 0; i < leafNodes.length; i++) {
            if (!Traversal.isWhitespaceTextNode(leafNodes[i]) || empty) {
                var leafNodeProperties = Formatting.getAllNodeProperties(leafNodes[i]);
                if (leafNodeProperties["-uxwrite-paragraph-style"] == null)
                    leafNodeProperties["-uxwrite-paragraph-style"] = Types.Keys.NONE_STYLE;
                if (commonProperties == null)
                    commonProperties = leafNodeProperties;
                else
                    commonProperties = intersection(commonProperties,leafNodeProperties);
            }
        }

        if (commonProperties == null)
            commonProperties = {"-uxwrite-paragraph-style": Types.Keys.NONE_STYLE};

        for (var i = 0; i < leafNodes.length; i++) {
            var leaf = leafNodes[i];
            if (leaf._type == HTML_LI) {
                switch (leaf.parentNode._type) {
                case HTML_UL:
                    commonProperties["-uxwrite-in-ul"] = "true";
                    break;
                case HTML_OL:
                    commonProperties["-uxwrite-in-ol"] = "true";
                    break;
                }
            }
            else {
                for (var ancestor = leaf;
                     ancestor.parentNode != null;
                     ancestor = ancestor.parentNode) {

                    if (ancestor.parentNode._type == HTML_LI) {
                        var havePrev = false;
                        for (var c = ancestor.previousSibling; c != null; c = c.previousSibling) {
                            if (!Traversal.isWhitespaceTextNode(c)) {
                                havePrev = true;
                                break;
                            }
                        }
                        if (!havePrev) {
                            var listNode = ancestor.parentNode.parentNode;
                            switch (listNode._type) {
                            case HTML_UL:
                                commonProperties["-uxwrite-in-ul"] = "true";
                                break;
                            case HTML_OL:
                                commonProperties["-uxwrite-in-ol"] = "true";
                                break;
                            }
                        }
                    }
                }
            }
        }

        getFlags(range.start,commonProperties);

        return commonProperties;

        function getFlags(pos,commonProperties) {
            var strBeforeCursor = Formatting.paragraphTextUpToPosition(pos);

            if (Util.isWhitespaceString(strBeforeCursor)) {
                var firstInParagraph = true;
                for (var p = pos.node; Types.isInlineNode(p); p = p.parentNode) {
                    if (p.previousSibling != null)
                        firstInParagraph = false;
                }
                if (firstInParagraph)
                    commonProperties["-uxwrite-shift"] = "true";
            }
            if (strBeforeCursor.match(/\.\s*$/))
                commonProperties["-uxwrite-shift"] = "true";
            if (strBeforeCursor.match(/\([^\)]*$/))
                commonProperties["-uxwrite-in-brackets"] = "true";
            if (strBeforeCursor.match(/\u201c[^\u201d]*$/))
                commonProperties["-uxwrite-in-quotes"] = "true";
        }

        function intersection(a,b) {
            var result = new Object();
            for (var name in a) {
                if (a[name] == b[name])
                    result[name] = a[name];
            }
            return result;
        }

        function findLeafNodes(node,result) {
            if (node.firstChild == null) {
                result.push(node);
            }
            else {
                for (var child = node.firstChild; child != null; child = child.nextSibling)
                    findLeafNodes(child,result);
            }
        }
    }

    // public
    Formatting.getAllNodeProperties = function(node) {
        if (node == null)
            throw new Error("Node is not in tree");

        if (node == node.ownerDocument.body)
            return new Object();

        var properties = Formatting.getAllNodeProperties(node.parentNode);

        if (node.nodeType == Node.ELEMENT_NODE) {
            // Note: Style names corresponding to element names must be in lowercase, because
            // canonicaliseSelector() in Styles.js always converts selectors to lowercase.
            if (node.hasAttribute("STYLE")) {
                var nodeProperties = getStyleProperties(node);
                for (var name in nodeProperties)
                    properties[name] = nodeProperties[name];
            }

            var type = node._type;
            switch (type) {
            case HTML_B:
                properties["font-weight"] = "bold";
                break;
            case HTML_I:
                properties["font-style"] = "italic";
                break;
            case HTML_U: {
                var components = [];
                if (properties["text-decoration"] != null) {
                    var components = properties["text-decoration"].toLowerCase().split(/\s+/);
                    if (components.indexOf("underline") == -1)
                        properties["text-decoration"] += " underline";
                }
                else {
                    properties["text-decoration"] = "underline";
                }
                break;
            }
//            case HTML_TT:
//                properties["-uxwrite-in-tt"] = "true";
//                break;
            case HTML_IMG:
                properties["-uxwrite-in-image"] = "true";
                break;
            case HTML_FIGURE:
                properties["-uxwrite-in-figure"] = "true";
                break;
            case HTML_TABLE:
                properties["-uxwrite-in-table"] = "true";
                break;
            case HTML_A:
                if (node.hasAttribute("href")) {
                    var href = node.getAttribute("href");
                    if (href.charAt(0) == "#")
                        properties["-uxwrite-in-reference"] = "true";
                    else
                        properties["-uxwrite-in-link"] = "true";
                }
                break;
            case HTML_NAV: {
                var className = DOM.getAttribute(node,"class");
                if ((className == Types.Keys.SECTION_TOC) ||
                    (className == Types.Keys.FIGURE_TOC) ||
                    (className == Types.Keys.TABLE_TOC))
                    properties["-uxwrite-in-toc"] = "true";
                break;
            }
            default:
                if (Types.PARAGRAPH_ELEMENTS[type]) {
                    var name = node.nodeName.toLowerCase();
                    var selector;
                    if (node.hasAttribute("class"))
                        selector = name + "." + node.getAttribute("class");
                    else
                        selector = name;
                    properties["-uxwrite-paragraph-style"] = selector;
                }
                break;
            }

            if (Types.OUTLINE_TITLE_ELEMENTS[type] && node.hasAttribute("id"))
                properties["-uxwrite-in-item-title"] = node.getAttribute("id");
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

        "border-top-left-radius": true,
        "border-top-right-radius": true,
        "border-bottom-left-radius": true,
        "border-bottom-right-radius": true,

        "text-align": true,
        "text-indent": true,
        "line-height": true,
        "display": true,

        "width": true,
        "height": true,
    };

    var SPECIAL_PROPERTIES = {
        "-webkit-text-size-adjust": true, // set on HTML element for text scaling purposes
    };

    function isParagraphProperty(name) {
        return PARAGRAPH_PROPERTIES[name];
    }

    function isInlineProperty(name) {
        return !PARAGRAPH_PROPERTIES[name] && !SPECIAL_PROPERTIES[name];
    }

    // private
    function putDirectInlineChildrenInParagraphs(parent) {
        var inlineChildren = new Array();
        for (var child = parent.firstChild; child != null; child = child.nextSibling)
            if (Types.isInlineNode(child))
                inlineChildren.push(child);
        for (var i = 0; i < inlineChildren.length; i++) {
            if (inlineChildren[i].parentNode == parent) { // may already have been moved
                if (!Traversal.isWhitespaceTextNode(inlineChildren[i]))
                    Hierarchy.wrapInlineNodesInParagraph(inlineChildren[i]);
            }
        }
    }

    // private
    function getParagraphs(nodes) {
        var array = new Array();
        var set = new Collections.NodeSet();
        for (var i = 0; i < nodes.length; i++) {
            for (var anc = nodes[i].parentNode; anc != null; anc = anc.parentNode) {
                if (anc._type == HTML_LI)
                    putDirectInlineChildrenInParagraphs(anc);
            }
            recurse(nodes[i]);
        }

        var remove = new Collections.NodeSet();
        for (var i = 0; i < array.length; i++) {
            for (var anc = array[i].parentNode; anc != null; anc = anc.parentNode)
                remove.add(anc);
        }

        var modified = new Array();
        for (var i = 0; i < array.length; i++) {
            if (!remove.contains(array[i]))
                modified.push(array[i]);
        }

        return modified;

        function recurse(node) {
            if (node._type == HTML_LI)
                putDirectInlineChildrenInParagraphs(node);
            if (node.firstChild == null) {
                // Leaf node
                for (var anc = node; anc != null; anc = anc.parentNode)
                    if (Types.isParagraphNode(anc)) {
                        add(anc);
                    }
            }
            else {
                for (var child = node.firstChild; child != null; child = child.nextSibling)
                    recurse(child);
            }
        }

        function add(node) {
            if (!set.contains(node)) {
                array.push(node);
                set.add(node);
            }
        }
    }

    // private
    function setParagraphStyle(paragraph,selector) {
        var wasHeading = Types.isHeadingNode(paragraph);
        DOM.removeAttribute(paragraph,"class");
        if (selector == "") {
            if (paragraph._type != HTML_P)
                paragraph = DOM.replaceElement(paragraph,"P");
        }
        else {
            var elementClassRegex = /^([a-zA-Z0-9]+)?(\.(.+))?$/;
            var result = elementClassRegex.exec(selector);
            if ((result != null) && (result.length == 4)) {
                var elementName = result[1];
                var className = result[3];

                if (elementName == null)
                    elementName = "P";
                else
                    elementName = elementName.toUpperCase();

                var elementType = ElementTypes[elementName];

                if (!Types.PARAGRAPH_ELEMENTS[elementType])
                    return; // better than throwing an exception

                if (paragraph._type != elementType)
                    paragraph = DOM.replaceElement(paragraph,elementName);

                if (className != null)
                    DOM.setAttribute(paragraph,"class",className);
                else
                    DOM.removeAttribute(paragraph,"class");
            }
        }

        // FIXME: this will need to change when we add Word/ODF support, because the ids serve
        // a purpose other than simply being targets for references
        var isHeading = Types.isHeadingNode(paragraph);
        if (wasHeading && !isHeading)
            DOM.removeAttribute(paragraph,"id");
    }

    // public
    Formatting.pushDownInlineProperties = function(outermost) {
        for (var i = 0; i < outermost.length; i++)
            outermost[i] = pushDownInlinePropertiesSingle(outermost[i]);
    }

    // private
    function pushDownInlinePropertiesSingle(target) {
        recurse(target.parentNode);
        return target;

        function recurse(node) {
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
            DOM.setStyleProperties(node,remove);

            var type = node._type;
            switch (type) {
            case HTML_B:
                inlineProperties["font-weight"] = "bold";
                break;
            case HTML_I:
                inlineProperties["font-style"] = "italic";
                break;
            case HTML_U:
                if (inlineProperties["text-decoration"] != null)
                    inlineProperties["text-decoration"] += " underline";
                else
                    inlineProperties["text-decoration"] = "underline";
                break;
            }

            var special = extractSpecial(inlineProperties);
            var count = Object.getOwnPropertyNames(inlineProperties).length;

            if ((count > 0) || special.bold || special.italic || special.underline) {

                var next;
                for (var child = node.firstChild; child != null; child = next) {
                    next = child.nextSibling;

                    if (Traversal.isWhitespaceTextNode(child))
                        continue;

                    var replacement = applyInlineFormatting(child,inlineProperties,special);
                    if (target == child)
                        target = replacement;
                }
            }

            if (node.hasAttribute("style") && (node.style.length == 0))
                DOM.removeAttribute(node,"style");

            switch (type) {
            case HTML_B:
            case HTML_I:
            case HTML_U:
                DOM.removeNodeButKeepChildren(node);
                break;
            }
        }
    }

    // private
    function wrapInline(node,elementName) {
        if (!Types.isInlineNode(node) || Types.isAbstractSpan(node)) {
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

    // private
    function applyInlineFormatting(target,inlineProperties,special,applyToWhitespace) {
        if (!applyToWhitespace && Traversal.isWhitespaceTextNode(target))
            return;

        if (special.underline)
            target = wrapInline(target,"U");
        if (special.italic)
            target = wrapInline(target,"I");
        if (special.bold)
            target = wrapInline(target,"B");

        var isbiu = false;
        switch (target._type) {
        case HTML_B:
        case HTML_I:
        case HTML_U:
            isbiu = true;
            break;
        }

        if ((Object.getOwnPropertyNames(inlineProperties).length > 0) &&
            ((target.nodeType != Node.ELEMENT_NODE) ||
             isbiu || isSpecialSpan(target))) {
            target = wrapInline(target,"SPAN");
        }


        var propertiesToSet = new Object();
        for (var name in inlineProperties) {
            var existing = target.style.getPropertyValue(name);
            if ((existing == null) || (existing == ""))
                propertiesToSet[name] = inlineProperties[name];
        }
        DOM.setStyleProperties(target,propertiesToSet);

        return target;
    }

    // private
    function extractSpecial(properties) {
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

    // private
    function removeProperties(outermost,properties) {
        properties = Util.clone(properties);
        var special = extractSpecial(properties);
        var remaining = new Array();
        for (var i = 0; i < outermost.length; i++) {
            removePropertiesSingle(outermost[i],properties,special,remaining);
        }
        return remaining;
    }

    // private
    function getOutermostParagraphs(paragraphs) {
        var all = new Collections.NodeSet();
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

    // private
    function removePropertiesSingle(node,properties,special,remaining) {
        if ((node.nodeType == Node.ELEMENT_NODE) && (node.hasAttribute("style"))) {
            var remove = new Object();
            for (var name in properties)
                remove[name] = null;
            DOM.setStyleProperties(node,remove);
        }

        var willRemove = false;
        switch (node._type) {
        case HTML_B:
            willRemove = (special.bold != null);
            break;
        case HTML_I:
            willRemove = (special.italic != null);
            break;
        case HTML_U:
            willRemove = (special.underline != null);
            break;
        case HTML_SPAN:
            willRemove = (!node.hasAttribute("style") && !isSpecialSpan(node));
            break;
        }

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

    function isSpecialSpan(span) {
        if (span._type == HTML_SPAN) {
            if (span.hasAttribute(Types.Keys.ABSTRACT_ELEMENT))
                return true;
            var className = DOM.getStringAttribute(span,"class");
            if (className.indexOf(Types.Keys.UXWRITE_PREFIX) == 0)
                return true;
            if ((className == "footnote") || (className == "endnote"))
                return true;
        }
        return false;
    }

    // private
    function containsOnlyWhitespace(ancestor) {
        for (child = ancestor.firstChild; child != null; child = child.nextSibling) {
            if (!Traversal.isWhitespaceTextNode(child))
                return false;
        }
        return true;
    }

    // public
    Formatting.applyFormattingChanges = function(style,properties) {
        debug("JS: applyFormattingChanges: style = "+JSON.stringify(style));
        if (properties != null) {
            var names = Object.getOwnPropertyNames(properties).sort();
            for (var i = 0; i < names.length; i++) {
                debug("    "+names[i]+" = "+properties[names[i]]);
            }
        }
        UndoManager.newGroup("Apply formatting changes");

        if (properties == null)
            properties = new Object();

        if (style == Types.Keys.NONE_STYLE)
            style = null;

        var paragraphProperties = new Object();
        var inlineProperties = new Object();

        for (var name in properties) {
            if (isParagraphProperty(name))
                paragraphProperties[name] = properties[name];
            else if (isInlineProperty(name))
                inlineProperties[name] = properties[name];
        }

        var selectionRange = Selection.get();
        if (selectionRange == null)
            return;

        // If we're applying formatting properties to an empty selection, and the node of the
        // selection start & end is an element, add an empty text node so that we have something
        // to apply the formatting to.
        if (Range.isEmpty(selectionRange) &&
            (selectionRange.start.node.nodeType == Node.ELEMENT_NODE)) {
            var node = selectionRange.start.node;
            var offset = selectionRange.start.offset;
            var text = DOM.createTextNode(document,"");
            DOM.insertBefore(node,text,node.childNodes[offset]);
            Selection.set(text,0,text,0);
            selectionRange = Selection.get();
        }

        // If the cursor is in a container (such as BODY OR FIGCAPTION), and not inside a paragraph,
        // put it in one so we can set a paragraph style

        if ((style != null) && Range.isEmpty(selectionRange)) {
            var node = Range.singleNode(selectionRange);
            while (Types.isInlineNode(node))
                node = node.parentNode;
            if (Types.isContainerNode(node) && containsOnlyInlineChildren(node)) {
                var p = DOM.createElement(document,"P");
                DOM.appendChild(node,p);
                while (node.firstChild != p)
                    DOM.appendChild(p,node.firstChild);
                Cursor.updateBRAtEndOfParagraph(p);
            }
        }


        var range = new Range.Range(selectionRange.start.node,selectionRange.start.offset,
                              selectionRange.end.node,selectionRange.end.offset);
        var positions = [selectionRange.start,selectionRange.end,
                         range.start,range.end];

        var allowDirectInline = (style == null);
        Position.trackWhileExecuting(positions,function() {
            Formatting.splitAroundSelection(range,allowDirectInline);
            Range.expand(range);
            if (!allowDirectInline)
                Range.ensureInlineNodesInParagraph(range);
            Range.ensureValidHierarchy(range);
            Range.expand(range);
            var outermost = Range.getOutermostNodes(range);
            var target = null;

            var paragraphs;
            if (outermost.length > 0)
                paragraphs = getParagraphs(outermost);
            else
                paragraphs = getParagraphs([Range.singleNode(range)]);

            // Push down inline properties
            Formatting.pushDownInlineProperties(outermost);

            outermost = removeProperties(outermost,inlineProperties);

            // Set properties on inline nodes
            for (var i = 0; i < outermost.length; i++) {
                var existing = Formatting.getAllNodeProperties(outermost[i]);
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
                DOM.setStyleProperties(outermostParagraphs[i],paragraphPropertiesToSet);

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
                    Formatting.mergeWithNeighbours(p,Formatting.MERGEABLE_INLINE);
                }
            }
        });

        // The current cursor position may no longer be valid, e.g. if a heading span was inserted
        // and the cursor is at a position that is now immediately before the span.
        var start = Position.closestMatchForwards(selectionRange.start,Position.okForInsertion);
        var end = Position.closestMatchBackwards(selectionRange.end,Position.okForInsertion);
        var tempRange = new Range.Range(start.node,start.offset,end.node,end.offset);
        tempRange = Range.forwards(tempRange);
        Range.ensureValidHierarchy(tempRange);
        start = tempRange.start;
        end = tempRange.end;
        Selection.set(start.node,start.offset,end.node,end.offset);

        function containsOnlyInlineChildren(node) {
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                if (!Types.isInlineNode(child))
                    return false;
            }
            return true;
        }
    }

    Formatting.formatInlineNode = function(node,properties) {
        properties = Util.clone(properties);
        var special = extractSpecial(properties);
        return applyInlineFormatting(node,properties,special,true);
    }

    Formatting.MERGEABLE_INLINE = new Array(HTML_COUNT);

    Formatting.MERGEABLE_INLINE[HTML_TEXT] = true;

    Formatting.MERGEABLE_INLINE[HTML_SPAN] = true;
    Formatting.MERGEABLE_INLINE[HTML_A] = true;
    Formatting.MERGEABLE_INLINE[HTML_Q] = true;

    // HTML 4.01 Section 9.2.1: Phrase elements
    Formatting.MERGEABLE_INLINE[HTML_EM] = true;
    Formatting.MERGEABLE_INLINE[HTML_STRONG] = true;
    Formatting.MERGEABLE_INLINE[HTML_DFN] = true;
    Formatting.MERGEABLE_INLINE[HTML_CODE] = true;
    Formatting.MERGEABLE_INLINE[HTML_SAMP] = true;
    Formatting.MERGEABLE_INLINE[HTML_KBD] = true;
    Formatting.MERGEABLE_INLINE[HTML_VAR] = true;
    Formatting.MERGEABLE_INLINE[HTML_CITE] = true;
    Formatting.MERGEABLE_INLINE[HTML_ABBR] = true;

    // HTML 4.01 Section 9.2.3: Subscripts and superscripts
    Formatting.MERGEABLE_INLINE[HTML_SUB] = true;
    Formatting.MERGEABLE_INLINE[HTML_SUP] = true;

    // HTML 4.01 Section 15.2.1: Font style elements
    Formatting.MERGEABLE_INLINE[HTML_I] = true;
    Formatting.MERGEABLE_INLINE[HTML_B] = true;
    Formatting.MERGEABLE_INLINE[HTML_SMALL] = true;
    Formatting.MERGEABLE_INLINE[HTML_S] = true;
    Formatting.MERGEABLE_INLINE[HTML_U] = true;

    Formatting.MERGEABLE_BLOCK = new Array(HTML_COUNT);

    Formatting.MERGEABLE_BLOCK[HTML_P] = true;
    Formatting.MERGEABLE_BLOCK[HTML_H1] = true;
    Formatting.MERGEABLE_BLOCK[HTML_H2] = true;
    Formatting.MERGEABLE_BLOCK[HTML_H3] = true;
    Formatting.MERGEABLE_BLOCK[HTML_H4] = true;
    Formatting.MERGEABLE_BLOCK[HTML_H5] = true;
    Formatting.MERGEABLE_BLOCK[HTML_H6] = true;
    Formatting.MERGEABLE_BLOCK[HTML_DIV] = true;
    Formatting.MERGEABLE_BLOCK[HTML_PRE] = true;
    Formatting.MERGEABLE_BLOCK[HTML_BLOCKQUOTE] = true;

    Formatting.MERGEABLE_BLOCK[HTML_UL] = true;
    Formatting.MERGEABLE_BLOCK[HTML_OL] = true;
    Formatting.MERGEABLE_BLOCK[HTML_LI] = true;

    Formatting.MERGEABLE_BLOCK_AND_INLINE = new Array(HTML_COUNT);
    for (var i = 0; i < HTML_COUNT; i++) {
        if (Formatting.MERGEABLE_INLINE[i] || Formatting.MERGEABLE_BLOCK[i])
            Formatting.MERGEABLE_BLOCK_AND_INLINE[i] = true;
        Formatting.MERGEABLE_BLOCK_AND_INLINE["force"] = true;
    }

})(globalAPI);
