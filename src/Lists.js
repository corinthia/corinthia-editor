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

define("Lists",function(require,exports) {
    "use strict";

    var Collections = require("Collections");
    var Cursor = require("Cursor");
    var DOM = require("DOM");
    var ElementTypes = require("ElementTypes");
    var Hierarchy = require("Hierarchy");
    var Range = require("Range");
    var Selection = require("Selection");
    var Traversal = require("Traversal");
    var Types = require("Types");
    var Util = require("Util");

    // private
    function findLIElements(range) {
        var listItems = new Array();

        var node = range.start.node;
        while (node != null) {

            addListItems(listItems,node);

            if (node == range.end.node)
                break;

            node = Traversal.nextNode(node);
        }
        return listItems;

        function addListItems(array,node) {
            if (node == null)
                return;

            if (node._type == ElementTypes.HTML_LI) {
                if (!Util.arrayContains(array,node))
                    array.push(node);
                return;
            }

            if (!Traversal.isWhitespaceTextNode(node))
                addListItems(array,node.parentNode);
        }
    }

    // public
    function increaseIndent() {
        Selection.preferElementPositions();
        Selection.preserveWhileExecuting(function() {
            var range = Selection.get();
            if (range == null)
                return null;

            // Determine the set of LI nodes that are part of the selection
            // Note that these could be spread out all over the place, e.g. in different lists,
            // some in table cells etc
            var listItems = findLIElements(range);

            // For each LI node that is not the first in the list, move it to the child list of
            // its previous sibling (creating the child list if necessary)

            for (var i = 0; i < listItems.length; i++) {
                var li = listItems[i];
                var prevLi = li.previousSibling;
                while ((prevLi != null) && (prevLi._type != ElementTypes.HTML_LI))
                    prevLi = prevLi.previousSibling;
                // We can only increase the indentation of the current list item C if there is
                // another list item P immediately preceding C. In this case, C becomes a child of
                // another list L, where L is inside P. L may already exist, or we may need to
                // create it.
                if (prevLi != null) {
                    var prevList = lastDescendentList(prevLi);
                    var childList = firstDescendentList(li);
                    var childListContainer = null;
                    if (childList != null) {
                        // childList may be contained inside one or more wrapper elements, in which
                        // case we set childListContainer to point to the wrapper element that is a
                        // child of li. Otherwise childListContainer will just be childList.
                        childListContainer = childList;
                        while (childListContainer.parentNode != li)
                            childListContainer = childListContainer.parentNode;
                    }

                    if (prevList != null) {
                        DOM.appendChild(prevList,li);
                        if (childList != null) {
                            while (childList.firstChild != null)
                                DOM.appendChild(prevList,childList.firstChild);
                            DOM.deleteNode(childListContainer);
                            // alert("Case 1: prevList and childList");
                        }
                        else {
                            // alert("Case 2: prevList and no childList");
                        }
                    }
                    else {
                        var newList;
                        if (childList != null) {
                            // alert("Case 3: no prevList but childList");
                            newList = childList;
                            DOM.appendChild(prevLi,childListContainer);
                        }
                        else {
                            // alert("Case 4: no prevList and no childList");
                            if (li.parentNode._type == ElementTypes.HTML_UL)
                                newList = DOM.createElement(document,"UL");
                            else
                                newList = DOM.createElement(document,"OL");
                            DOM.appendChild(prevLi,newList);
                        }
                        DOM.insertBefore(newList,li,newList.firstChild);
                    }
                }
            }
        });

        function firstDescendentList(node) {
            while (true) {
                var node = Traversal.firstChildElement(node);
                if (node == null)
                    return null;
                switch (node._type) {
                case ElementTypes.HTML_UL:
                case ElementTypes.HTML_OL:
                    return node;
                }
            }
        }

        function lastDescendentList(node) {
            while (true) {
                var node = Traversal.lastChildElement(node);
                if (node == null)
                    return null;
                switch (node._type) {
                case ElementTypes.HTML_UL:
                case ElementTypes.HTML_OL:
                    return node;
                }
            }
        }
    }

    // public
    function decreaseIndent() {
        Selection.preferElementPositions();
        Selection.preserveWhileExecuting(function() {
            var range = Selection.get();
            if (range == null)
                return null;

            // Determine the set of LI nodes that are part of the selection
            // Note that these could be spread out all over the place, e.g. in different lists,
            // some in table cells etc
            var listItems = findLIElements(range);

            // Remove from consideration any list items that have an ancestor that is going to
            // be moved
            var i = 0;
            var changed;
            while (i < listItems.length) {
                var node = listItems[i];

                var ancestorToBeRemoved = false;
                for (var ancestor = node.parentNode;
                     ancestor != null;
                     ancestor = ancestor.parentNode) {
                    if (Util.arrayContains(listItems,ancestor))
                        ancestorToBeRemoved = true;
                }

                if (ancestorToBeRemoved)
                    listItems.splice(i,1);
                else
                    i++;
            }

            function haveContentAfter(node) {
                for (node = node.nextSibling; node != null; node = node.nextSibling) {
                    if (Util.nodeHasContent(node))
                        return true;
                }
                return false;
            }

            // For LI nodes that are in a top-level list, change them to regular paragraphs
            // For LI nodes that are part of a nested list, move them to the parent (this requires
            // splitting the child list in two)
            for (var i = 0; i < listItems.length; i++) {
                var liNode = listItems[i];
                var listNode = liNode.parentNode;
                var containerChild = findContainerChild(listNode);

                if (haveContentAfter(liNode)) {
                    var secondHalf;
                    if (listNode._type == ElementTypes.HTML_UL)
                        secondHalf = DOM.createElement(document,"UL");
                    else
                        secondHalf = DOM.createElement(document,"OL");

                    DOM.appendChild(liNode,secondHalf);

                    var following = liNode.nextSibling;
                    while (following != null) {
                        var next = following.nextSibling;
                        DOM.appendChild(secondHalf,following);
                        following = next;
                    }
                }

                DOM.insertBefore(containerChild.parentNode,liNode,containerChild.nextSibling);
                if (!Types.isListNode(liNode.parentNode)) {
                    Hierarchy.avoidInlineChildren(liNode);
                    DOM.removeNodeButKeepChildren(liNode);
                }

                if (!Util.nodeHasContent(listNode))
                    DOM.deleteNode(listNode);
            }
        });

        function findContainerChild(node) {
            while (node.parentNode != null) {
                if (Types.isContainerNode(node.parentNode) && (node.parentNode._type != ElementTypes.HTML_LI))
                    return node;
                node = node.parentNode;
            }
        }
    }

    // private
    function getListOperationNodes(range) {
        var detail = Range.detail(range);
        var dca = detail.commonAncestor;
        var ds = detail.startAncestor;
        var de = detail.endAncestor;

        while (Types.isInlineNode(dca)) {
            ds = dca;
            de = dca;
            dca = dca.parentNode;
        }

        var nodes = new Array();
        var nodeSet = new Collections.NodeSet();

        if (dca._type == ElementTypes.HTML_LI)
            return [dca];

        // If, after moving up the tree until dca is a container node, a single node is selected,
        // check if it is wholly contained within a single list item. If so, select just that
        // list item.
        var isStartLI = ((ds != null) && (ds._type == ElementTypes.HTML_LI));
        var isEndLI = ((de != null) && (de._type == ElementTypes.HTML_LI));
        if (!isStartLI && !isEndLI) {
            for (var ancestor = dca; ancestor.parentNode != null; ancestor = ancestor.parentNode) {
                if (ancestor.parentNode._type == ElementTypes.HTML_LI) {
                    var firstElement = true;

                    for (var p = ancestor.previousSibling; p != null; p = p.previousSibling) {
                        if (p.nodeType == Node.ELEMENT_NODE) {
                            firstElement = false;
                            break;
                        }
                    }

                    if (firstElement)
                        return [ancestor.parentNode];
                }
            }
        }

        var end = (de == null) ? null : de.nextSibling;

        for (var child = ds; child != end; child = child.nextSibling) {
            switch (child._type) {
            case ElementTypes.HTML_UL:
            case ElementTypes.HTML_OL:
                for (var gc = child.firstChild; gc != null; gc = gc.nextSibling) {
                    if (!Traversal.isWhitespaceTextNode(gc))
                        addNode(gc);
                }
                break;
            default:
                if ((child._type == ElementTypes.HTML_DIV) &&
                     child.getAttribute("class") == Types.Keys.SELECTION_HIGHLIGHT) {
                    // skip
                }
                else if (!Traversal.isWhitespaceTextNode(child)) {
                    addNode(child);
                }
                break;
            }
        }
        if ((nodes.length == 0) && Types.isParagraphNode(dca))
            nodes.push(dca);
        return nodes;

        function addNode(node) {
            while (Types.isInlineNode(node) && node.parentNode != document.body)
                node = node.parentNode;
            if (!nodeSet.contains(node)) {
                nodeSet.add(node);
                nodes.push(node);
            }
        }
    }

    // public
    function clearList() {
        Selection.preferElementPositions();
        Selection.preserveWhileExecuting(function() {
            var range = Selection.get();
            if (range == null)
                return;
            Range.ensureInlineNodesInParagraph(range);

            var nodes = getListOperationNodes(range);

            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                if (node._type == ElementTypes.HTML_LI) {
                    var li = node;
                    var list = li.parentNode;
                    var insertionPoint = null;

                    DOM.removeAdjacentWhitespace(li);

                    if (li.previousSibling == null) {
                        insertionPoint = list;
                    }
                    else if (li.nextSibling == null) {
                        insertionPoint = list.nextSibling;
                    }
                    else {
                        var secondList = DOM.shallowCopyElement(list);
                        DOM.insertBefore(list.parentNode,secondList,list.nextSibling);
                        while (li.nextSibling != null) {
                            DOM.appendChild(secondList,li.nextSibling);
                            DOM.removeAdjacentWhitespace(li);
                        }

                        insertionPoint = secondList;
                    }

                    var parent = null;
                    var child = li.firstChild;
                    while (child != null) {
                        var next = child.nextSibling;
                        if (Types.isInlineNode(child) && !Traversal.isWhitespaceTextNode(child)) {
                            child = Hierarchy.wrapInlineNodesInParagraph(child);
                            next = child.nextSibling;
                        }
                        child = next;
                    }
                    DOM.insertBefore(list.parentNode,li,insertionPoint);
                    DOM.removeNodeButKeepChildren(li);

                    if (list.firstChild == null)
                        DOM.deleteNode(list);
                }
            }
        });

        var range = Selection.get();
        if (range == null)
            return;
        if (Range.isEmpty(range) &&
            (range.start.node.nodeType == Node.ELEMENT_NODE) &&
            (Types.isContainerNode(range.start.node))) {

            var p = DOM.createElement(document,"P");

            var next = range.start.node.childNodes[range.start.offset+1];
            DOM.insertBefore(range.start.node,p,next);

            Cursor.updateBRAtEndOfParagraph(p);
            Selection.set(p,0,p,0);
        }
    }

    // private
    function setList(type) {
        var range = Selection.get();
        if (range == null)
            return;

        var nodes = getListOperationNodes(range);

        if (nodes.length == 0) {
            var text;
            if (range.start.node.nodeType == Node.TEXT_NODE) {
                text = range.start.node;
            }
            else if (range.start.node.nodeType == Node.ELEMENT_NODE) {
                text = DOM.createTextNode(document,"");
                DOM.insertBefore(range.start.node,
                                 text,
                                 range.start.node[range.start.offset+1]);
            }
            nodes = [text];

            var offset = DOM.nodeOffset(text);
            Selection.set(text,0,text,0);
            range = Selection.get();
        }

        Range.trackWhileExecuting(range,function () {
            // Set list to UL or OL

            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                var next;
                var prev;
                var li = null;
                var oldList = null;
                var listInsertionPoint;

                if ((node._type == ElementTypes.HTML_LI) && (node.parentNode._type == type)) {
                    // Already in the correct type of list; don't need to do anything
                    continue;
                }

                if (node._type == ElementTypes.HTML_LI) {
                    li = node;
                    var list = li.parentNode;

                    DOM.removeAdjacentWhitespace(list);
                    prev = list.previousSibling;
                    next = list.nextSibling;


                    DOM.removeAdjacentWhitespace(li);

                    if (li.previousSibling == null) {
                        listInsertionPoint = list;
                        next = null;
                    }
                    else if (li.nextSibling == null) {
                        listInsertionPoint = list.nextSibling;
                        prev = null;
                    }
                    else {
                        var secondList = DOM.shallowCopyElement(list);
                        DOM.insertBefore(list.parentNode,secondList,list.nextSibling);
                        while (li.nextSibling != null) {
                            DOM.insertBefore(secondList,li.nextSibling,null);
                            DOM.removeAdjacentWhitespace(li);
                        }

                        listInsertionPoint = secondList;

                        prev = null;
                        next = null;
                    }

                    node = list;
                    oldList = list;
                }
                else {
                    DOM.removeAdjacentWhitespace(node);
                    prev = node.previousSibling;
                    next = node.nextSibling;
                    listInsertionPoint = node;
                }

                var list;
                var itemInsertionPoint;

                if ((prev != null) && (prev._type == type)) {
                    list = prev;
                    itemInsertionPoint = null;
                }
                else if ((next != null) && (next._type == type)) {
                    list = next;
                    itemInsertionPoint = list.firstChild;
                }
                else {
                    if (type == ElementTypes.HTML_UL)
                        list = DOM.createElement(document,"UL");
                    else
                        list = DOM.createElement(document,"OL");
                    DOM.insertBefore(node.parentNode,list,listInsertionPoint);
                    itemInsertionPoint = null;
                }

                if (li != null) {
                    DOM.insertBefore(list,li,itemInsertionPoint);
                }
                else {
                    var li = DOM.createElement(document,"LI");
                    DOM.insertBefore(list,li,itemInsertionPoint);
                    DOM.insertBefore(li,node,null);
                }


                if ((oldList != null) && (oldList.firstChild == null))
                    DOM.deleteNode(oldList);

                // Merge with adjacent list
                DOM.removeAdjacentWhitespace(list);
                if ((list.nextSibling != null) && (list.nextSibling._type == type)) {
                    var followingList = list.nextSibling;
                    while (followingList.firstChild != null) {
                        if (Traversal.isWhitespaceTextNode(followingList.firstChild))
                            DOM.deleteNode(followingList.firstChild);
                        else
                            DOM.insertBefore(list,followingList.firstChild,null);
                    }
                    DOM.deleteNode(followingList);
                }
            }
        });
        Range.ensureValidHierarchy(range);
        Selection.set(range.start.node,range.start.offset,range.end.node,range.end.offset);
    }

    // public
    function setUnorderedList() {
        setList(ElementTypes.HTML_UL);
    }

    // public
    function setOrderedList() {
        setList(ElementTypes.HTML_OL);
    }

    exports.increaseIndent = increaseIndent;
    exports.decreaseIndent = decreaseIndent;
    exports.clearList = clearList;
    exports.setUnorderedList = setUnorderedList;
    exports.setOrderedList = setOrderedList;

});
