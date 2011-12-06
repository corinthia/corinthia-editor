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

        if (node.nodeName == "LI") {
            if (!arrayContains(array,node))
                array.push(node);
            return;
        }

        if (!isWhitespaceTextNode(node))
            addListItems(array,node.parentNode);
    }
}

function increaseIndent()
{
    var range = Range.fromSelection();
    if (range == null)
        return null;

    // Determine the set of LI nodes that are part of the selection
    // Note that these could be spread out all over the place, e.g. in different lists, some in
    // table cells etc
    var listItems = findLIElements(range);

    // For each LI node that is not the first in the list, move it to the child list of
    // its previous sibling (creating the child list if necessary)

    for (var i = 0; i < listItems.length; i++) {
        var li = listItems[i];
        var prevLi = li.previousSibling;
        while ((prevLi != null) && (prevLi.nodeName != "LI"))
            prevLi = prevLi.previousSibling;
        // We can only increase the indentation of the current list item C if there is another
        // list item P immediately preceding C. In this case, C becomes a child of another list
        // L, where L is inside P. L may already exist, or we may need to create it.
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
                prevList.appendChild(li);
                if (childList != null) {
                    while (childList.firstChild != null)
                        prevList.appendChild(childList.firstChild);
                    li.removeChild(childListContainer);
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
                    prevLi.appendChild(childListContainer);
                }
                else {
                    // alert("Case 4: no prevList and no childList");
                    if (li.parentNode.nodeName == "UL")
                        newList = document.createElement("UL");
                    else
                        newList = document.createElement("OL");
                    prevLi.appendChild(newList);
                }
                newList.insertBefore(li,newList.firstChild);
            }
        }
    }

    range.setSelection();

    function firstDescendentList(node)
    {
        while (true) {
            var node = firstChildElement(node);
            if (node == null)
                return null;
            if ((node.nodeName == "UL") || (node.nodeName == "OL"))
                return node;
        }
    }

    function lastDescendentList(node)
    {
        while (true) {
            var node = lastChildElement(node);
            if (node == null)
                return null;
            if ((node.nodeName == "UL") || (node.nodeName == "OL"))
                return node;
        }
    }
}

function decreaseIndent()
{
    var range = Range.fromSelection();
    if (range == null)
        return null;

    // Determine the set of LI nodes that are part of the selection
    // Note that these could be spread out all over the place, e.g. in different lists, some in
    // table cells etc
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
        for (var ancestor = node.parentNode; ancestor != null; ancestor = ancestor.parentNode) {
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

        // We can only decrease the indentation of a list node if the list it is in is itself
        // inside another list

        if (following != null) {
            var secondHalf;
            if (parentList.nodeName == "UL")
                secondHalf = document.createElement("UL");
            else
                secondHalf = document.createElement("OL");

            var copy = secondHalf;

            for (var p = parentList.parentNode; p != container; p = p.parentNode) {
                var pcopy = shallowCopyElement(p);
                pcopy.appendChild(copy);
                copy = pcopy;
            }

            node.appendChild(copy);

            while (following != null) {
                var next = following.nextSibling;
                secondHalf.appendChild(following);
                following = next;
            }
        }

        container.parentNode.insertBefore(node,container.nextSibling);
        if (firstChildElement(parentList) == null) {
            parentList.parentNode.removeChild(parentList);
        }
    }

    range.setSelection();

    function findContainingListItem(node)
    {
        if (node == null)
            return null;

        if (node.nodeName == "LI")
            return node;

        return findContainingListItem(node.parentNode);
    }
}

function removeAdjacentWhitespace(node)
{
    while ((node.previousSibling != null) && (isWhitespaceTextNode(node.previousSibling)))
        node.parentNode.removeChild(node.previousSibling);
    while ((node.nextSibling != null) && (isWhitespaceTextNode(node.nextSibling)))
        node.parentNode.removeChild(node.nextSibling);
}

function getListOperationNodes(range)
{
    debug("getListOperationNodes");
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
            if (ancestor.nodeName == "LI") {
                nodes.push(ancestor);
                return nodes;
            }
        }
    }

    for (var child = ds; child != de.nextSibling; child = child.nextSibling) {
        if ((child.nodeName == "UL") || (child.nodeName == "OL")) {
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

function clearList()
{
    debug("clearList()");

    var range = Range.fromSelection();
    if (range == null) {
        debug("no selection");
        return;
    }

    var nodes = getListOperationNodes(range);

    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.nodeName == "LI") {
            var li = node;
            var list = li.parentNode;
            var insertionPoint = null;

            removeAdjacentWhitespace(li);

            if (li.previousSibling == null) {
                debug("setList null: case 1");

                insertionPoint = list;
            }
            else if (li.nextSibling == null) {
                debug("setList null: case 2");
                insertionPoint = list.nextSibling;
            }
            else {
                debug("setList null: case 3");

                var secondList = shallowCopyElement(list);
                list.parentNode.insertBefore(secondList,list.nextSibling);
                while (li.nextSibling != null) {
                    secondList.appendChild(li.nextSibling);
                    removeAdjacentWhitespace(li);
                }

                insertionPoint = secondList;
            }

            while (li.firstChild != null) {
                if (isWhitespaceTextNode(li.firstChild)) {
                    li.removeChild(li.firstChild);
                }
                else if (isInlineNode(li.firstChild)) {
                    var p = document.createElement("p");
                    p.appendChild(li.firstChild);
                    list.parentNode.insertBefore(p,insertionPoint);
                }
                else {
                    list.parentNode.insertBefore(li.firstChild,insertionPoint);
                }
            }

            list.removeChild(li);

            if (list.firstChild == null)
                list.parentNode.removeChild(list);
        }
    }

    range.setSelection();
}

function setList(type)
{
    var range = Range.fromSelection();
    if (range == null) {
        debug("no selection");
        return;
    }

    var nodes = getListOperationNodes(range);

    // Set list to UL or OL

    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var next;
        var prev;
        var li = null;
        var oldList = null;
        var listInsertionPoint;

        if ((node.nodeName == "LI") && (node.parentNode.nodeName == type)) {
            // Already in the correct type of list; don't need to do anything
            continue;
        }

        if ((node.nodeName == "LI")) {
            li = node;
            var list = li.parentNode;

            removeAdjacentWhitespace(list);
            prev = list.previousSibling;
            next = list.nextSibling;


            debug("setList "+type+" (list item): prev "+prev+" next "+next);

            removeAdjacentWhitespace(li);

            if (li.previousSibling == null) {
                debug("setList "+type+" (list item): case 1");

                listInsertionPoint = list;
                next = null;
            }
            else if (li.nextSibling == null) {
                debug("setList "+type+" (list item): case 2");
                listInsertionPoint = list.nextSibling;
                prev = null;
            }
            else {
                debug("setList "+type+" (list item): case 3");

                var secondList = shallowCopyElement(list);
                list.parentNode.insertBefore(secondList,list.nextSibling);
                while (li.nextSibling != null) {
                    secondList.appendChild(li.nextSibling);
                    removeAdjacentWhitespace(li);
                }

                listInsertionPoint = secondList;

                prev = null;
                next = null;
            }

            node = list;
            oldList = list;
        }
        else {
            removeAdjacentWhitespace(node);
            prev = node.previousSibling;
            next = node.nextSibling;
            listInsertionPoint = node;
        }

        var list;
        var itemInsertionPoint;

        if ((prev != null) &&
            (prev.nodeName == type)) {
            debug("setList "+type+": case 1");
            list = prev;
            itemInsertionPoint = null;
        }
        else if ((next != null) &&
                 (next.nodeName == type)) {
            debug("setList "+type+": case 2");
            list = next;
            itemInsertionPoint = list.firstChild;
        }
        else {
            debug("setList "+type+": case 3");
            list = document.createElement(type);
            node.parentNode.insertBefore(list,listInsertionPoint);
            itemInsertionPoint = null;
        }

        if (li != null) {
            list.insertBefore(li,itemInsertionPoint);
        }
        else {
            var li = document.createElement("LI");
            list.insertBefore(li,itemInsertionPoint);
            li.appendChild(node);
        }


        if ((oldList != null) && (oldList.firstChild == null))
            oldList.parentNode.removeChild(oldList);

        // Merge with adjacent list
        removeAdjacentWhitespace(list);
        if ((list.nextSibling != null) && (list.nextSibling.nodeName == type)) {
            var followingList = list.nextSibling;
            while (followingList.firstChild != null) {
                if (isWhitespaceTextNode(followingList.firstChild))
                    followingList.removeChild(followingList.firstChild);
                else
                    list.appendChild(followingList.firstChild);
            }
            followingList.parentNode.removeChild(followingList);
        }
    }

    range.setSelection();
    return;
}

function setUnorderedList()
{
    debug("setUnorderedList()");
    setList("UL");
}

function setOrderedList()
{
    debug("setOrderedList()");
    setList("OL");
}
