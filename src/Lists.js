// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function() {
    function findLIElements(range)
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

            if (DOM.upperName(node) == "LI") {
                if (!arrayContains(array,node))
                    array.push(node);
                return;
            }

            if (!isWhitespaceTextNode(node))
                addListItems(array,node.parentNode);
        }
    }

    // public
    // FIXME: write testcases for this
    function increaseIndent()
    {
        var range = Selection.getSelectionRange();
        if (range == null)
            return null;

        range.trackWhileExecuting(function() {

            // Determine the set of LI nodes that are part of the selection
            // Note that these could be spread out all over the place, e.g. in different lists,
            // some in table cells etc
            var listItems = findLIElements(range);

            // For each LI node that is not the first in the list, move it to the child list of
            // its previous sibling (creating the child list if necessary)

            for (var i = 0; i < listItems.length; i++) {
                var li = listItems[i];
                var prevLi = li.previousSibling;
                while ((prevLi != null) && (DOM.upperName(prevLi) != "LI"))
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
                            if (DOM.upperName(li.parentNode) == "UL")
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

        Selection.setSelectionRange(range);

        function firstDescendentList(node)
        {
            while (true) {
                var node = firstChildElement(node);
                if (node == null)
                    return null;
                if ((DOM.upperName(node) == "UL") || (DOM.upperName(node) == "OL"))
                    return node;
            }
        }

        function lastDescendentList(node)
        {
            while (true) {
                var node = lastChildElement(node);
                if (node == null)
                    return null;
                if ((DOM.upperName(node) == "UL") || (DOM.upperName(node) == "OL"))
                    return node;
            }
        }
    }

    // public
    // FIXME: write testcases for this
    function decreaseIndent()
    {
        var range = Selection.getSelectionRange();
        if (range == null)
            return null;

        range.trackWhileExecuting(function() {

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

            // For LI nodes that are in a top-level list, change them to regular paragraphs
            // For LI nodes that are part of a nested list, move them to the parent (this requires
            // splitting the child list in two)
            for (var i = 0; i < listItems.length; i++) {
                var node = listItems[i];
                var parentList = node.parentNode;
                var following = node.nextSibling;
                var container = findContainingListItem(node.parentNode);

                // We can only decrease the indentation of a list node if the list it is in is
                // itself inside another list

                if (following != null) {
                    var secondHalf;
                    if (DOM.upperName(parentList) == "UL")
                        secondHalf = DOM.createElement(document,"UL");
                    else
                        secondHalf = DOM.createElement(document,"OL");

                    var copy = secondHalf;

                    for (var p = parentList.parentNode; p != container; p = p.parentNode) {
                        var pcopy = DOM.shallowCopyElement(p);
                        DOM.appendChild(pcopy,copy);
                        copy = pcopy;
                    }

                    DOM.appendChild(node,copy);

                    while (following != null) {
                        var next = following.nextSibling;
                        DOM.appendChild(secondHalf,following);
                        following = next;
                    }
                }

                DOM.insertBefore(container.parentNode,node,container.nextSibling);
                if (firstChildElement(parentList) == null) {
                    DOM.deleteNode(parentList);
                }
            }
        });

        Selection.setSelectionRange(range);

        function findContainingListItem(node)
        {
            if (node == null)
                return null;

            if (DOM.upperName(node) == "LI")
                return node;

            return findContainingListItem(node.parentNode);
        }
    }

    // public
    function getListOperationNodes(range)
    {
        var dca = null;
        for (var ds = range.start.node; ds != null; ds = ds.parentNode) {
            for (var de = range.end.node; de != null; de = de.parentNode) {
                if (ds.parentNode == de.parentNode) {
                    dca = ds.parentNode;
                    break;
                }
            }
            if (dca != null)
                break;
        }

        while (!isContainerNode(dca)) {
            dca = dca.parentNode;
            ds = ds.parentNode;
            de = de.parentNode;
        }

        var nodes = new Array();

        // If, after moving up the tree until dca is a container node, a single node is selected,
        // check if it is wholly contained within a single list item. If so, select just that
        // list item.
        if (ds == de) {
            for (var ancestor = dca; ancestor != null; ancestor = ancestor.parentNode) {
                if (DOM.upperName(ancestor) == "LI") {
                    nodes.push(ancestor);
                    return nodes;
                }
            }
        }

        for (var child = ds; child != de.nextSibling; child = child.nextSibling) {
            if ((DOM.upperName(child) == "UL") || (DOM.upperName(child) == "OL")) {
                for (var gc = child.firstChild; gc != null; gc = gc.nextSibling) {
                    if (!isWhitespaceTextNode(gc))
                        nodes.push(gc);
                }
            }
            else {
                if (!isWhitespaceTextNode(child))
                    nodes.push(child);
            }
        }
        return nodes;
    }

    // public
    function clearList()
    {
        var range = Selection.getSelectionRange();
        if (range == null)
            return;

        range.trackWhileExecuting(function() {

            var nodes = getListOperationNodes(range);

            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                if (DOM.upperName(node) == "LI") {
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

                    while (li.firstChild != null) {
                        if (isWhitespaceTextNode(li.firstChild)) {
                            DOM.deleteNode(li.firstChild);
                        }
                        else if (isInlineNode(li.firstChild)) {
                            var p = DOM.createElement(document,"p");
                            DOM.appendChild(p,li.firstChild);
                            DOM.insertBefore(list.parentNode,p,insertionPoint);
                        }
                        else {
                            DOM.insertBefore(list.parentNode,li.firstChild,insertionPoint);
                        }
                    }

                    DOM.deleteNode(li);

                    if (list.firstChild == null)
                        DOM.deleteNode(list);
                }
            }
        });

        Selection.setSelectionRange(range);
    }

    function setList(type)
    {
        var range = Selection.getSelectionRange();
        if (range == null)
            return;

        range.trackWhileExecuting(function() {

            var nodes = getListOperationNodes(range);

            // Set list to UL or OL

            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                var next;
                var prev;
                var li = null;
                var oldList = null;
                var listInsertionPoint;

                if ((DOM.upperName(node) == "LI") && (DOM.upperName(node.parentNode) == type)) {
                    // Already in the correct type of list; don't need to do anything
                    continue;
                }

                if ((DOM.upperName(node) == "LI")) {
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
                            DOM.appendChild(secondList,li.nextSibling);
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

                if ((prev != null) &&
                    (DOM.upperName(prev) == type)) {
                    list = prev;
                    itemInsertionPoint = null;
                }
                else if ((next != null) &&
                         (DOM.upperName(next) == type)) {
                    list = next;
                    itemInsertionPoint = list.firstChild;
                }
                else {
                    list = DOM.createElement(document,type);
                    DOM.insertBefore(node.parentNode,list,listInsertionPoint);
                    itemInsertionPoint = null;
                }

                if (li != null) {
                    DOM.insertBefore(list,li,itemInsertionPoint);
                }
                else {
                    var li = DOM.createElement(document,"LI");
                    DOM.insertBefore(list,li,itemInsertionPoint);
                    DOM.appendChild(li,node);
                }


                if ((oldList != null) && (oldList.firstChild == null))
                    DOM.deleteNode(oldList);

                // Merge with adjacent list
                DOM.removeAdjacentWhitespace(list);
                if ((list.nextSibling != null) && (DOM.upperName(list.nextSibling) == type)) {
                    var followingList = list.nextSibling;
                    while (followingList.firstChild != null) {
                        if (isWhitespaceTextNode(followingList.firstChild))
                            DOM.deleteNode(followingList.firstChild);
                        else
                            DOM.appendChild(list,followingList.firstChild);
                    }
                    DOM.deleteNode(followingList);
                }
            }
        });

        Selection.setSelectionRange(range);
        return;
    }

    // public
    function setUnorderedList()
    {
        setList("UL");
    }

    // public
    function setOrderedList()
    {
        setList("OL");
    }

    window.Lists = new (function Lists(){});
    Lists.increaseIndent = trace(increaseIndent);
    Lists.decreaseIndent = trace(decreaseIndent);
    Lists.clearList = trace(clearList);
    Lists.setUnorderedList = trace(setUnorderedList);
    Lists.setOrderedList = trace(setOrderedList);
})();
