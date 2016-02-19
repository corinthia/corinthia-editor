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

import Collections = require("./collections");
import Cursor = require("./cursor");
import DOM = require("./dom");
import ElementTypes = require("./elementTypes");
import Hierarchy = require("./hierarchy");
import Range = require("./range");
import Selection = require("./selection");
import Traversal = require("./traversal");
import Types = require("./types");
import Util = require("./util");

// private
function findLIElements(range: Range.Range): HTMLElement[] {
    let listItems: HTMLElement[] = [];

    let node = range.start.node;
    while (node != null) {

        addListItems(listItems,node);

        if (node == range.end.node)
            break;

        node = Traversal.nextNode(node);
    }
    return listItems;

    function addListItems(array: HTMLElement[], node: Node): void {
        if (node == null)
            return;

        if (node instanceof HTMLLIElement) {
            if (!Util.arrayContains(array,node))
                array.push(node);
            return;
        }

        if (!Traversal.isWhitespaceTextNode(node))
            addListItems(array,node.parentNode);
    }
}

// public
export function increaseIndent(): void {
    Selection.preferElementPositions();
    Selection.preserveWhileExecuting(function() {
        let range = Selection.get();
        if (range == null)
            return null;

        // Determine the set of LI nodes that are part of the selection
        // Note that these could be spread out all over the place, e.g. in different lists,
        // some in table cells etc
        let listItems = findLIElements(range);

        // For each LI node that is not the first in the list, move it to the child list of
        // its previous sibling (creating the child list if necessary)

        for (let i = 0; i < listItems.length; i++) {
            let li = listItems[i];
            let prevLi = li.previousSibling;
            while ((prevLi != null) && (prevLi._type != ElementTypes.HTML_LI))
                prevLi = prevLi.previousSibling;
            // We can only increase the indentation of the current list item C if there is
            // another list item P immediately preceding C. In this case, C becomes a child of
            // another list L, where L is inside P. L may already exist, or we may need to
            // create it.
            if (prevLi != null) {
                let prevList = lastDescendentList(prevLi);
                let childList = firstDescendentList(li);
                let childListContainer: Node = null;
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
                    let newList: Node;
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

    function firstDescendentList(node: Node): Node {
        while (true) {
            node = Traversal.firstChildElement(node);
            if (node == null)
                return null;
            switch (node._type) {
            case ElementTypes.HTML_UL:
            case ElementTypes.HTML_OL:
                return node;
            }
        }
    }

    function lastDescendentList(node: Node): Node {
        while (true) {
            node = Traversal.lastChildElement(node);
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
export function decreaseIndent(): void {
    Selection.preferElementPositions();
    Selection.preserveWhileExecuting(function() {
        let range = Selection.get();
        if (range == null)
            return null;

        // Determine the set of LI nodes that are part of the selection
        // Note that these could be spread out all over the place, e.g. in different lists,
        // some in table cells etc
        let listItems = findLIElements(range);

        // Remove from consideration any list items that have an ancestor that is going to
        // be moved
        let i = 0;
        while (i < listItems.length) {
            let node = listItems[i];

            let ancestorToBeRemoved = false;
            for (let ancestor = node.parentNode;
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

        function haveContentAfter(node: Node): boolean {
            for (node = node.nextSibling; node != null; node = node.nextSibling) {
                if (Types.nodeHasContent(node))
                    return true;
            }
            return false;
        }

        // For LI nodes that are in a top-level list, change them to regular paragraphs
        // For LI nodes that are part of a nested list, move them to the parent (this requires
        // splitting the child list in two)
        for (let i = 0; i < listItems.length; i++) {
            let liNode = listItems[i];
            let listNode = liNode.parentNode;
            let containerChild = findContainerChild(listNode);

            if (haveContentAfter(liNode)) {
                let secondHalf: HTMLElement;
                if (listNode._type == ElementTypes.HTML_UL)
                    secondHalf = DOM.createElement(document,"UL");
                else
                    secondHalf = DOM.createElement(document,"OL");

                DOM.appendChild(liNode,secondHalf);

                let following = liNode.nextSibling;
                while (following != null) {
                    let next = following.nextSibling;
                    DOM.appendChild(secondHalf,following);
                    following = next;
                }
            }

            DOM.insertBefore(containerChild.parentNode,liNode,containerChild.nextSibling);
            if (!Types.isListNode(liNode.parentNode)) {
                Hierarchy.avoidInlineChildren(liNode);
                DOM.removeNodeButKeepChildren(liNode);
            }

            if (!Types.nodeHasContent(listNode))
                DOM.deleteNode(listNode);
        }
    });

    function findContainerChild(node: Node): Node {
        while (node.parentNode != null) {
            if (Types.isContainerNode(node.parentNode) && (node.parentNode._type != ElementTypes.HTML_LI))
                return node;
            node = node.parentNode;
        }
    }
}

// private
function getListOperationNodes(range: Range.Range): Node[] {
    let detail = Range.detail(range);
    let dca = detail.commonAncestor;
    let ds = detail.startAncestor;
    let de = detail.endAncestor;

    while (Types.isInlineNode(dca)) {
        ds = dca;
        de = dca;
        dca = dca.parentNode;
    }

    let nodes: Node[] = [];
    let nodeSet = new Collections.NodeSet();

    if (dca._type == ElementTypes.HTML_LI)
        return [dca];

    // If, after moving up the tree until dca is a container node, a single node is selected,
    // check if it is wholly contained within a single list item. If so, select just that
    // list item.
    let isStartLI = ((ds != null) && (ds._type == ElementTypes.HTML_LI));
    let isEndLI = ((de != null) && (de._type == ElementTypes.HTML_LI));
    if (!isStartLI && !isEndLI) {
        for (let ancestor = dca; ancestor.parentNode != null; ancestor = ancestor.parentNode) {
            if (ancestor.parentNode._type == ElementTypes.HTML_LI) {
                let firstElement = true;

                for (let p = ancestor.previousSibling; p != null; p = p.previousSibling) {
                    if (p instanceof Element) {
                        firstElement = false;
                        break;
                    }
                }

                if (firstElement)
                    return [ancestor.parentNode];
            }
        }
    }

    let end = (de == null) ? null : de.nextSibling;

    for (let child = ds; child != end; child = child.nextSibling) {
        switch (child._type) {
        case ElementTypes.HTML_UL:
        case ElementTypes.HTML_OL:
            for (let gc = child.firstChild; gc != null; gc = gc.nextSibling) {
                if (!Traversal.isWhitespaceTextNode(gc))
                    addNode(gc);
            }
            break;
        default:
            if ((child instanceof Element) &&
                (child._type == ElementTypes.HTML_DIV) &&
                (child.getAttribute("class") == Types.Keys.SELECTION_HIGHLIGHT)) {
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

    function addNode(node: Node): void {
        while (Types.isInlineNode(node) && node.parentNode != document.body)
            node = node.parentNode;
        if (!nodeSet.contains(node)) {
            nodeSet.add(node);
            nodes.push(node);
        }
    }
}

// public
export function clearList(): void {
    Selection.preferElementPositions();
    Selection.preserveWhileExecuting(function() {
        let range = Selection.get();
        if (range == null)
            return;
        Range.ensureInlineNodesInParagraph(range);

        let nodes = getListOperationNodes(range);

        for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];
            if (node._type == ElementTypes.HTML_LI) {
                let li = node;
                let list = li.parentNode;
                let insertionPoint: Node = null;

                DOM.removeAdjacentWhitespace(li);

                if (li.previousSibling == null) {
                    insertionPoint = list;
                }
                else if (li.nextSibling == null) {
                    insertionPoint = list.nextSibling;
                }
                else {
                    let secondList = DOM.shallowCopyElement(list);
                    DOM.insertBefore(list.parentNode,secondList,list.nextSibling);
                    while (li.nextSibling != null) {
                        DOM.appendChild(secondList,li.nextSibling);
                        DOM.removeAdjacentWhitespace(li);
                    }

                    insertionPoint = secondList;
                }

                let child = li.firstChild;
                while (child != null) {
                    let next = child.nextSibling;
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

    let range = Selection.get();
    if (range == null)
        return;
    if (Range.isEmpty(range) &&
        (range.start.node instanceof Element) &&
        (Types.isContainerNode(range.start.node))) {

        let p = DOM.createElement(document,"P");

        let next = range.start.node.childNodes[range.start.offset+1];
        DOM.insertBefore(range.start.node,p,next);

        Cursor.updateBRAtEndOfParagraph(p);
        Selection.set(p,0,p,0);
    }
}

// private
function setList(type: number): void {
    let range = Selection.get();
    if (range == null)
        return;

    let nodes = getListOperationNodes(range);

    if (nodes.length == 0) {
        let text: Node;
        if (range.start.node instanceof Text) {
            text = range.start.node;
        }
        else if (range.start.node instanceof Element) {
            text = DOM.createTextNode(document,"");
            DOM.insertBefore(range.start.node,
                             text,
                             range.start.node[range.start.offset+1]);
        }
        nodes = [text];

        let offset = DOM.nodeOffset(text);
        Selection.set(text,0,text,0);
        range = Selection.get();
    }

    Range.trackWhileExecuting(range,function () {
        // Set list to UL or OL

        for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];
            let next: Node;
            let prev: Node;
            let li: Node = null;
            let oldList: Node = null;
            let listInsertionPoint: Node;

            if ((node._type == ElementTypes.HTML_LI) && (node.parentNode._type == type)) {
                // Already in the correct type of list; don't need to do anything
                continue;
            }

            if (node._type == ElementTypes.HTML_LI) {
                li = node;
                let list = li.parentNode;

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
                    let secondList = DOM.shallowCopyElement(list);
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

            let list: Node;
            let itemInsertionPoint: Node;

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
                let li = DOM.createElement(document,"LI");
                DOM.insertBefore(list,li,itemInsertionPoint);
                DOM.insertBefore(li,node,null);
            }


            if ((oldList != null) && (oldList.firstChild == null))
                DOM.deleteNode(oldList);

            // Merge with adjacent list
            DOM.removeAdjacentWhitespace(list);
            if ((list.nextSibling != null) && (list.nextSibling._type == type)) {
                let followingList = list.nextSibling;
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
export function setUnorderedList(): void {
    setList(ElementTypes.HTML_UL);
}

// public
export function setOrderedList(): void {
    setList(ElementTypes.HTML_OL);
}
