// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Lists_increaseIndent;
var Lists_decreaseIndent;
var Lists_clearList;
var Lists_setUnorderedList;
var Lists_setOrderedList;

(function() {

    // private
    var findLIElements = trace(function findLIElements(range)
    {
        var listItems = new Array();

        var node = range.start.node;
        while (node != null) {

            addListItems(listItems,node);

            if (node == range.end.node)
                break;

            node = nextNode(node);
        }
        return listItems;

        function addListItems(array,node)
        {
            if (node == null)
                return;

            if (DOM_upperName(node) == "LI") {
                if (!arrayContains(array,node))
                    array.push(node);
                return;
            }

            if (!isWhitespaceTextNode(node))
                addListItems(array,node.parentNode);
        }
    });

    // public
    Lists_increaseIndent = trace(function increaseIndent()
    {
        Selection_preserveWhileExecuting(function() {
            var range = Selection_get();
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
                while ((prevLi != null) && (DOM_upperName(prevLi) != "LI"))
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
                        DOM_appendChild(prevList,li);
                        if (childList != null) {
                            while (childList.firstChild != null)
                                DOM_appendChild(prevList,childList.firstChild);
                            DOM_deleteNode(childListContainer);
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
                            DOM_appendChild(prevLi,childListContainer);
                        }
                        else {
                            // alert("Case 4: no prevList and no childList");
                            if (DOM_upperName(li.parentNode) == "UL")
                                newList = DOM_createElement(document,"UL");
                            else
                                newList = DOM_createElement(document,"OL");
                            DOM_appendChild(prevLi,newList);
                        }
                        DOM_insertBefore(newList,li,newList.firstChild);
                    }
                }
            }
        });

        function firstDescendentList(node)
        {
            while (true) {
                var node = firstChildElement(node);
                if (node == null)
                    return null;
                if ((DOM_upperName(node) == "UL") || (DOM_upperName(node) == "OL"))
                    return node;
            }
        }

        function lastDescendentList(node)
        {
            while (true) {
                var node = lastChildElement(node);
                if (node == null)
                    return null;
                if ((DOM_upperName(node) == "UL") || (DOM_upperName(node) == "OL"))
                    return node;
            }
        }
    });

    // public
    Lists_decreaseIndent = trace(function decreaseIndent()
    {
        Selection_preserveWhileExecuting(function() {
            var range = Selection_get();
            if (range == null)
                return null;

            // Determine the set of LI nodes that are part of the selection
            // Note that these could be spread out all over the place, e.g. in different lists,
            // some in table cells etc
            var listItems = findLIElements(range);

            // Remove from consideration any list items that are not inside a nested list
            var i = 0;
            while (i < listItems.length) {
                var node = listItems[i];
                var container = findContainingListItem(node.parentNode);
                if (container == null)
                    listItems.splice(i,1);
                else
                    i++;
            }

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
                    if (arrayContains(listItems,ancestor))
                        ancestorToBeRemoved = true;
                }

                if (ancestorToBeRemoved)
                    listItems.splice(i,1);
                else
                    i++;
            }

            function haveContentAfter(node)
            {
                for (node = node.nextSibling; node != null; node = node.nextSibling) {
                    if (nodeHasContent(node))
                        return true;
                }
                return false;
            }

            // For LI nodes that are in a top-level list, change them to regular paragraphs
            // For LI nodes that are part of a nested list, move them to the parent (this requires
            // splitting the child list in two)
            for (var i = 0; i < listItems.length; i++) {
                var node = listItems[i];
                var parentList = node.parentNode;


                var container = findContainingListItem(node.parentNode);

                // We can only decrease the indentation of a list node if the list it is in is
                // itself inside another list

                if (haveContentAfter(node)) {
                    var secondHalf;
                    if (DOM_upperName(parentList) == "UL")
                        secondHalf = DOM_createElement(document,"UL");
                    else
                        secondHalf = DOM_createElement(document,"OL");

                    var copy = secondHalf;

                    for (var p = parentList.parentNode; p != container; p = p.parentNode) {
                        var pcopy = DOM_shallowCopyElement(p);
                        DOM_appendChild(pcopy,copy);
                        copy = pcopy;
                    }

                    DOM_appendChild(node,copy);

                    var following = node.nextSibling;
                    while (following != null) {
                        var next = following.nextSibling;
                        DOM_appendChild(secondHalf,following);
                        following = next;
                    }
                }

                DOM_insertBefore(container.parentNode,node,container.nextSibling);
                if (!nodeHasContent(parentList))
                    DOM_deleteNode(parentList);
            }
        });

        function findContainingListItem(node)
        {
            if (node == null)
                return null;

            if (DOM_upperName(node) == "LI")
                return node;

            return findContainingListItem(node.parentNode);
        }
    });

    // public
    var getListOperationNodes = trace(function getListOperationNodes(range)
    {
        var detail = range.detail();
        var dca = detail.commonAncestor;
        var ds = detail.startAncestor;
        var de = detail.endAncestor;

        while (!isContainerNode(dca)) {
            ds = dca;
            de = dca;
            dca = dca.parentNode;
        }

        var nodes = new Array();

        // If, after moving up the tree until dca is a container node, a single node is selected,
        // check if it is wholly contained within a single list item. If so, select just that
        // list item.
        if ((ds == de) || ((ds != null) && (ds.nextSibling == null) && (de == null))) {
            for (var ancestor = dca; ancestor != null; ancestor = ancestor.parentNode) {
                if (DOM_upperName(ancestor) == "LI") {
                    nodes.push(ancestor);
                    return nodes;
                }
            }
        }

        var end = (de == null) ? null : de.nextSibling;

        for (var child = ds; child != end; child = child.nextSibling) {
            if ((DOM_upperName(child) == "UL") || (DOM_upperName(child) == "OL")) {
                for (var gc = child.firstChild; gc != null; gc = gc.nextSibling) {
                    if (!isWhitespaceTextNode(gc))
                        nodes.push(gc);
                }
            }
            else if ((DOM_upperName(child) == "DIV") &&
                     child.getAttribute("class") == Keys.SELECTION_HIGHLIGHT) {
                // skip
            }
            else {
                if (!isWhitespaceTextNode(child))
                    nodes.push(child);
            }
        }
        return nodes;
    });

    // public
    Lists_clearList = trace(function clearList()
    {
        Selection_preserveWhileExecuting(function() {
            var range = Selection_get();
            if (range == null)
                return;

            var nodes = getListOperationNodes(range);

            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                if (DOM_upperName(node) == "LI") {
                    var li = node;
                    var list = li.parentNode;
                    var insertionPoint = null;

                    DOM_removeAdjacentWhitespace(li);

                    if (li.previousSibling == null) {
                        insertionPoint = list;
                    }
                    else if (li.nextSibling == null) {
                        insertionPoint = list.nextSibling;
                    }
                    else {
                        var secondList = DOM_shallowCopyElement(list);
                        DOM_insertBefore(list.parentNode,secondList,list.nextSibling);
                        while (li.nextSibling != null) {
                            DOM_appendChild(secondList,li.nextSibling);
                            DOM_removeAdjacentWhitespace(li);
                        }

                        insertionPoint = secondList;
                    }

                    while (li.firstChild != null) {
                        if (isWhitespaceTextNode(li.firstChild)) {
                            DOM_deleteNode(li.firstChild);
                        }
                        else if (isInlineNode(li.firstChild)) {
                            var p = DOM_createElement(document,"p");
                            DOM_appendChild(p,li.firstChild);
                            DOM_insertBefore(list.parentNode,p,insertionPoint);
                        }
                        else {
                            DOM_insertBefore(list.parentNode,li.firstChild,insertionPoint);
                        }
                    }

                    DOM_deleteNode(li);

                    if (list.firstChild == null)
                        DOM_deleteNode(list);
                }
            }
        });
    });

    // private
    var setList = trace(function setList(type)
    {
        var range;
        Selection_hideWhileExecuting(function() {
            range = Selection_get();
            if (range == null)
                return;

            var nodes = getListOperationNodes(range);

            if (nodes.length == 0) {
                var text;
                if (range.start.node.nodeType == Node.TEXT_NODE) {
                    text = range.start.node;
                }
                else if (range.start.node.nodeType == Node.ELEMENT_NODE) {
                    text = DOM_createTextNode(document,"");
                    DOM_insertBefore(range.start.node,
                                     text,
                                     range.start.node[range.start.offset+1]);
                }
                nodes = [text];

                var offset = DOM_nodeOffset(text);
                Selection_set(text,0,text,0);
                range = Selection_get();
            }

            range.trackWhileExecuting(function () {
                // Set list to UL or OL

                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i];
                    var next;
                    var prev;
                    var li = null;
                    var oldList = null;
                    var listInsertionPoint;

                    if ((DOM_upperName(node) == "LI") && (DOM_upperName(node.parentNode) == type)) {
                        // Already in the correct type of list; don't need to do anything
                        continue;
                    }

                    if ((DOM_upperName(node) == "LI")) {
                        li = node;
                        var list = li.parentNode;

                        DOM_removeAdjacentWhitespace(list);
                        prev = list.previousSibling;
                        next = list.nextSibling;


                        DOM_removeAdjacentWhitespace(li);

                        if (li.previousSibling == null) {
                            listInsertionPoint = list;
                            next = null;
                        }
                        else if (li.nextSibling == null) {
                            listInsertionPoint = list.nextSibling;
                            prev = null;
                        }
                        else {
                            var secondList = DOM_shallowCopyElement(list);
                            DOM_insertBefore(list.parentNode,secondList,list.nextSibling);
                            while (li.nextSibling != null) {
                                DOM_insertBefore(secondList,li.nextSibling,null);
                                DOM_removeAdjacentWhitespace(li);
                            }

                            listInsertionPoint = secondList;

                            prev = null;
                            next = null;
                        }

                        node = list;
                        oldList = list;
                    }
                    else {
                        DOM_removeAdjacentWhitespace(node);
                        prev = node.previousSibling;
                        next = node.nextSibling;
                        listInsertionPoint = node;
                    }

                    var list;
                    var itemInsertionPoint;

                    if ((prev != null) &&
                        (DOM_upperName(prev) == type)) {
                        list = prev;
                        itemInsertionPoint = null;
                    }
                    else if ((next != null) &&
                             (DOM_upperName(next) == type)) {
                        list = next;
                        itemInsertionPoint = list.firstChild;
                    }
                    else {
                        list = DOM_createElement(document,type);
                        DOM_insertBefore(node.parentNode,list,listInsertionPoint);
                        itemInsertionPoint = null;
                    }

                    if (li != null) {
                        DOM_insertBefore(list,li,itemInsertionPoint);
                    }
                    else {
                        var li = DOM_createElement(document,"LI");
                        DOM_insertBefore(list,li,itemInsertionPoint);
                        DOM_insertBefore(li,node,null);
                    }


                    if ((oldList != null) && (oldList.firstChild == null))
                        DOM_deleteNode(oldList);

                    // Merge with adjacent list
                    DOM_removeAdjacentWhitespace(list);
                    if ((list.nextSibling != null) && (DOM_upperName(list.nextSibling) == type)) {
                        var followingList = list.nextSibling;
                        while (followingList.firstChild != null) {
                            if (isWhitespaceTextNode(followingList.firstChild))
                                DOM_deleteNode(followingList.firstChild);
                            else
                                DOM_insertBefore(list,followingList.firstChild,null);
                        }
                        DOM_deleteNode(followingList);
                    }
                }
            });
            range.ensureRangeValidHierarchy();
            Selection_set(range.start.node,range.start.offset,range.end.node,range.end.offset);
        });
    });

    // public
    Lists_setUnorderedList = trace(function setUnorderedList()
    {
        setList("UL");
    });

    // public
    Lists_setOrderedList = trace(function setOrderedList()
    {
        setList("OL");
    });

})();
