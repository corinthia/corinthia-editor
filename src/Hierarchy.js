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

    var Hierarchy = api.Hierarchy; // export

    var DOM = api.DOM; // import
    var Formatting = api.Formatting; // import
    var Position = api.Position; // import
    var Traversal = api.Traversal; // import
    var Types = api.Types; // import
    var Util = api.Util; // import

    // private
    function wrapInlineChildren(first,last,ancestors) {
        var haveNonWhitespace = false;
        for (var node = first; node != last.nextSibling; node = node.nextSibling) {
            if (!Traversal.isWhitespaceTextNode(node))
                haveNonWhitespace = true;
        }
        if (!haveNonWhitespace)
            return false;

        var parentNode = first.parentNode;
        var nextSibling = first;
        for (var i = ancestors.length-1; i >= 0; i--) {
            var ancestorCopy = DOM.shallowCopyElement(ancestors[i]);
            DOM.insertBefore(parentNode,ancestorCopy,nextSibling);
            parentNode = ancestorCopy;
            nextSibling = null;

            var node = first;
            while (true) {
                var next = node.nextSibling;
                DOM.insertBefore(parentNode,node,null);
                if (node == last)
                    break;
                node = next;
            }
        }
    }

    // private
    function wrapInlineChildrenInAncestors(node,ancestors) {
        var firstInline = null;
        var lastInline = null;

        var child = node.firstChild;
        while (true) {
            var next = (child != null) ? child.nextSibling : null;
            if ((child == null) || !Types.isInlineNode(child)) {

                if ((firstInline != null) && (lastInline != null)) {
                    wrapInlineChildren(firstInline,lastInline,ancestors);
                }
                firstInline = null;
                lastInline = null;
                if (child != null)
                    wrapInlineChildrenInAncestors(child,ancestors);
            }
            else {
                if (firstInline == null)
                    firstInline = child;
                lastInline = child;
            }
            if (child == null)
                break;
            child = next;
        }
    }

    function checkInvalidNesting(node) {
        var parent = node.parentNode;
        if ((parent._type == HTML_DIV) &&
            (DOM.getAttribute(parent,"class") == Types.Keys.SELECTION_CLASS)) {
            parent = parent.parentNode;
        }

        var invalidNesting = !Types.isContainerNode(parent);
        switch (parent._type) {
        case HTML_DIV:
            if (Types.isParagraphNode(node) || Types.isListNode(node))
                invalidNesting = false; // this case is ok
            break;
        case HTML_CAPTION:
        case HTML_FIGCAPTION:
        case HTML_TABLE:
        case HTML_FIGURE:
            switch (node._type) {
            case HTML_FIGURE:
            case HTML_TABLE:
            case HTML_H1:
            case HTML_H2:
            case HTML_H3:
            case HTML_H4:
            case HTML_H5:
            case HTML_H6:
                return true;
            }
            break;
        }

        return invalidNesting;
    }

    function checkInvalidHeadingNesting(node) {
        switch (node._type) {
        case HTML_H1:
        case HTML_H2:
        case HTML_H3:
        case HTML_H4:
        case HTML_H5:
        case HTML_H6:
            switch (node.parentNode._type) {
            case HTML_BODY:
            case HTML_NAV:
            case HTML_DIV:
                return false;
            default:
                return true;
            }
            break;
        default:
            return false;
        }
    }

    function nodeHasSignificantChildren(node) {
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            if (!Traversal.isWhitespaceTextNode(child))
                return true;
        }
        return false;
    }

    // Enforce the restriction that any path from the root to a given node must be of the form
    //    container+ paragraph inline
    // or container+ paragraph
    // or container+
    // public
    Hierarchy.ensureValidHierarchy = function(node,recursive,allowDirectInline) {
        var count = 0;
        while ((node != null) && (node.parentNode != null) && (node != document.body)) {
            count++;
            if (count > 200)
                throw new Error("too many iterations");

            if (checkInvalidHeadingNesting(node)) {
                var offset = DOM.nodeOffset(node);
                var parent = node.parentNode;
                Formatting.moveFollowing(new Position.Position(node.parentNode,offset+1),
                                         function() { return false; });
                DOM.insertBefore(node.parentNode.parentNode,
                                 node,
                                 node.parentNode.nextSibling);

                while ((parent != document.body) && !nodeHasSignificantChildren(parent)) {
                    var grandParent = parent.parentNode;
                    DOM.deleteNode(parent);
                    parent = grandParent;
                }

                continue;
            }
            else if (Types.isContainerNode(node) || Types.isParagraphNode(node)) {
                var invalidNesting = checkInvalidNesting(node);
                if (invalidNesting) {
                    var ancestors = new Array();
                    var child = node;
                    while (!Types.isContainerNode(child.parentNode)) {
                        if (Types.isInlineNode(child.parentNode)) {
                            var keep = false;
                            if (child.parentNode._type == HTML_SPAN) {
                                for (var i = 0; i < child.attributes.length; i++) {
                                    var attr = child.attributes[i];
                                    if (attr.nodeName.toUpperCase() != "ID")
                                        keep = true;
                                }
                                if (keep)
                                    ancestors.push(child.parentNode);
                            }
                            else {
                                ancestors.push(child.parentNode);
                            }
                        }
                        child = child.parentNode;
                    }

                    while (checkInvalidNesting(node)) {
                        var offset = DOM.nodeOffset(node);
                        var parent = node.parentNode;
                        Formatting.moveFollowing(new Position.Position(node.parentNode,offset+1),
                                                 Types.isContainerNode);
                        DOM.insertBefore(node.parentNode.parentNode,
                                         node,
                                         node.parentNode.nextSibling);
                        if (!nodeHasSignificantChildren(parent))
                            DOM.deleteNode(parent);

                    }
                    wrapInlineChildrenInAncestors(node,ancestors);
                }
            }

            node = node.parentNode;
        }
    }

    Hierarchy.ensureInlineNodesInParagraph = function(node,weak) {
        var count = 0;
        while ((node != null) && (node.parentNode != null) && (node != document.body)) {
            count++;
            if (count > 200)
                throw new Error("too many iterations");
            if (Types.isInlineNode(node) &&
                Types.isContainerNode(node.parentNode) && (node.parentNode._type != HTML_LI) &&
                (!weak || !Types.isTableCell(node.parentNode)) &&
                !Traversal.isWhitespaceTextNode(node)) {
                Hierarchy.wrapInlineNodesInParagraph(node);
                return;
            }
            node = node.parentNode;
        }
    }

    // public
    Hierarchy.wrapInlineNodesInParagraph = function(node) {
        var start = node;
        var end = node;

        while ((start.previousSibling != null) && Types.isInlineNode(start.previousSibling))
            start = start.previousSibling;
        while ((end.nextSibling != null) && Types.isInlineNode(end.nextSibling))
            end = end.nextSibling;

        return DOM.wrapSiblings(start,end,"P");
    }

    Hierarchy.avoidInlineChildren = function(parent) {
        var child = parent.firstChild;

        while (child != null) {
            if (Types.isInlineNode(child)) {
                var start = child;
                var end = child;
                var haveContent = Util.nodeHasContent(end);
                while ((end.nextSibling != null) && Types.isInlineNode(end.nextSibling)) {
                    end = end.nextSibling;
                    if (Util.nodeHasContent(end))
                        haveContent = true;
                }
                child = DOM.wrapSiblings(start,end,"P");
                var next = child.nextSibling;
                if (!Util.nodeHasContent(child))
                    DOM.deleteNode(child);
                child = next;
            }
            else {
                child = child.nextSibling;
            }
        }
    }

})(globalAPI);
