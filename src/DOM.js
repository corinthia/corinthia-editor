// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

// Helper functions
var DOM_assignNodeIds;

// Primitive node creation operations
var DOM_createElement;
var DOM_createElementNS;
var DOM_createTextNode;
var DOM_createComment;
var DOM_cloneNode;

// Primitive and high-level node mutation operations
var DOM_appendChild;
var DOM_insertBefore;
var DOM_deleteNode;
var DOM_setAttribute;
var DOM_setAttributeNS;
var DOM_removeAttribute;
var DOM_removeAttributeNS;
var DOM_setStyleProperties;
var DOM_insertCharacters;
var DOM_deleteCharacters;
var DOM_setNodeValue;

// High-level DOM operations
var DOM_deleteAllChildren;
var DOM_shallowCopyElement;
var DOM_removeNodeButKeepChildren;
var DOM_replaceElement;
var DOM_wrapNode;
var DOM_wrapSiblings;
var DOM_mergeWithNextSibling;
var DOM_nodesMergeable;
var DOM_addTrackedPosition;
var DOM_removeTrackedPosition;
var DOM_removeAdjacentWhitespace;
var DOM_lowerName;
var DOM_upperName;
var DOM_documentHead;
var DOM_ensureUniqueIds;
var DOM_nodeOffset;
var DOM_maxChildOffset;
var DOM_ignoreMutationsWhileExecuting;
var DOM_getIgnoreMutations;
var DOM_addListener;
var DOM_removeListener;
var DOM_Listener;

(function() {

    // Assign a unique prefix to the ids, to ensure namespaces don't clash when multiple instances
    // of this are used in different browser windows
    var prefix = Math.random()+":";
    var nextNodeId = 0;
    var nodeData = new Object();
    var ignoreMutations = 0;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                            //
    //                                    DOM Helper Functions                                    //
    //                                                                                            //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    function addUndoAction()
    {
        if (window.undoSupported)
            UndoManager_addAction.apply(null,arrayCopy(arguments));
    }

    function disableUndoWhileExecuting(fun)
    {
        if (window.undoSupported)
            return UndoManager_disableWhileExecuting(fun);
        else
            return fun();
    }

    function assignNodeId(node)
    {
        if (node._nodeId != null)
            throw new Error(node+" already has id");
        node._nodeId = prefix+nextNodeId++;
        return node;
    }

    function checkNodeId(node)
    {
        if (node._nodeId == null)
            throw new Error(DOM_upperName(node)+" lacks _nodeId");
    }


    // public
    function assignNodeIds(node)
    {
        if (node._nodeId != null)
            throw new Error(node+" already has id");
        node._nodeId = prefix+nextNodeId++;
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            assignNodeIds(child);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                            //
    //                                  Primitive DOM Operations                                  //
    //                                                                                            //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /*

      The following functions are considered "primitive", in that they are the core functions
      through which all manipulation of the DOM ultimately occurs. All other DOM functions call
      these, either directly or indirectly, instead of making direct method calls on node objects.
      These functions are divided into two categories: node creation and mode mutation.

      The creation functions are as follows:

      * createElement(document,elementName)
      * createElementNS(document,namespaceURI,qualifiedName)
      * createTextNode(document,data)
      * createComment(document,data)
      * cloneNode(original,deep,noIdAttr)

      The purpose of these is to ensure that a unique _nodeId value is assigned to each node object,
      which is needed for using the NodeSet and NodeMap classes. All nodes in a document must have
      this set; we use our own functions for this because DOM provides no other way of uniquely
      identifying nodes in a way that allows them to be stored in a hash table.

      The mutation functions are as follows:

      * insertBeforeInternal(parent,newChild,refChild)
      * deleteNodeInternal(node,deleteDescendantData)
      * setAttribute(element,name,value)
      * setAttributeNS(element,namespaceURI,qualifiedName,value)
      * setStyleProperties(element,properties)
      * insertCharacters(textNode,offset,characters)
      * deleteCharacters(textNode,startOffset,endOffset)
      * setNodeValue(textNode,value)

      These functions exist to allow us to record undo information. We can't use DOM mutation events
      for this purpose they're not fully supported in WebKit.

      Every time a mutation operation is performed on a node, we add an action to the undo stack
      corresponding to the inverse of that operaton, i.e. an action that undoes the operaton. It
      is absolutely critical that all changes to a DOM node go through these functions, regardless
      of whether or not the node currently resides in the tree. This ensures that the undo history
      is able to correctly revert the tree to the same state that it was in at the relevant point
      in time.

      By routing all DOM modifications through these few functions, virtually all of the other
      javascript code can be ignorant of the undo manager, provided the only state they change is
      in the DOM. Parts of the code which maintain their own state about the document, such as the
      style manager, must implement their own undo-compliant state manipulation logic.

      *** IMPORTANT ***

      Just in case it isn't already clear, you must *never* make direct calls to methods like
      appendChild() and createElement() on the node objects themselves. Doing so will result in
      subtle and probably hard-to-find bugs. As far as all javascript code for UX Write is
      concerned, consider the public functions defined in this file to be the DOM API. You can use
      check-dom-methods.sh to search for any cases where this rule has been violated.

      */

    // public
    function createElement(document,elementName)
    {
        return assignNodeId(document.createElement(elementName)); // check-ok
    }

    // public
    function createElementNS(document,namespaceURI,qualifiedName)
    {
        return assignNodeId(document.createElementNS(namespaceURI,qualifiedName)); // check-ok
    }

    // public
    function createTextNode(document,data)
    {
        return assignNodeId(document.createTextNode(data)); // check-ok
    }

    // public
    function createComment(document,data)
    {
        return assignNodeId(document.createComment(data)); // check-ok
    }

    // public
    function cloneNode(original,deep,noIdAttr)
    {
        var clone = original.cloneNode(deep); // check-ok
        DOM_assignNodeIds(clone);
        if (noIdAttr)
            clone.removeAttribute("id"); // check-ok
        return clone;
    }

    function insertBeforeInternal(parent,newChild,refChild)
    {
        if (newChild.parentNode == null) {
            addUndoAction(deleteNodeInternal,newChild)
        }
        else {
            var oldParent = newChild.parentNode;
            var oldNext = newChild.nextSibling;
            addUndoAction(insertBeforeInternal,oldParent,newChild,oldNext);
        }

        disableUndoWhileExecuting(function() {
            parent.insertBefore(newChild,refChild); // check-ok
        });
    }

    function deleteNodeInternal(node,deleteDescendantData)
    {
        checkNodeId(node);

        addUndoAction(insertBeforeInternal,node.parentNode,node,node.nextSibling);

        disableUndoWhileExecuting(function() {
            node.parentNode.removeChild(node); // check-ok

            // Delete all data associated with the node. This is not preserved across undo/redo;
            // currently the only thing we are using this data for is tracked positions, and we
            // are going to be recording undo information for the selection separately, so this is
            // not a problem.
            if (deleteDescendantData)
                deleteNodeDataRecursive(node);
            else
                deleteNodeData(node);
        });

        return;

        function deleteNodeData(current)
        {
            delete nodeData[current._nodeId];
        }

        function deleteNodeDataRecursive(current)
        {
            deleteNodeData(current);
            for (var child = current.firstChild; child != null; child = child.nextSibling)
                deleteNodeDataRecursive(child);
        }
    }

    // public
    function setAttribute(element,name,value)
    {
        if (element.hasAttribute(name))
            addUndoAction(setAttribute,element,name,element.getAttribute(name));
        else
            addUndoAction(setAttribute,element,name,null);

        if (value == null)
            element.removeAttribute(name); // check-ok
        else
            element.setAttribute(name,value); // check-ok
    }

    // public
    function setAttributeNS(element,namespaceURI,qualifiedName,value)
    {
        var localName = qualifiedName.replace(/^.*:/,"");
        if (element.hasAttributeNS(namespaceURI,localName)) {
            var oldValue = element.getAttributeNS(namespaceURI,localName);
            var oldQName = element.getAttributeNodeNS(namespaceURI,localName).nodeName; // check-ok
            addUndoAction(setAttributeNS,element,namespaceURI,oldQName,oldValue)
        }
        else {
            addUndoAction(setAttributeNS,element,namespaceURI,localName,null);
        }

        if (value == null)
            element.removeAttributeNS(namespaceURI,localName); // check-ok
        else
            element.setAttributeNS(namespaceURI,qualifiedName,value); // check-ok
    }

    // public
    function setStyleProperties(element,properties)
    {
        if (Object.getOwnPropertyNames(properties).length == 0)
            return;

        if (element.hasAttribute("style"))
            addUndoAction(DOM_setAttribute,element,"style",element.getAttribute("style"));
        else
            addUndoAction(DOM_setAttribute,element,"style",null);

        for (var name in properties)
            element.style.setProperty(name,properties[name]); // check-ok

        if (element.getAttribute("style") == "")
            element.removeAttribute("style"); // check-ok
    }

    // public
    function insertCharacters(textNode,offset,characters)
    {
        if (textNode.nodeType != Node.TEXT_NODE)
            throw new Error("DOM_insertCharacters called on non-text node");
        if ((offset < 0) || (offset > textNode.nodeValue.length))
            throw new Error("DOM_insertCharacters called with invalid offset");
        trackedPositionsForNode(textNode).forEach(function (position) {
            if (position.offset > offset)
                position.offset += characters.length;
        });
        textNode.nodeValue = textNode.nodeValue.slice(0,offset) +
                             characters +
                             textNode.nodeValue.slice(offset);
        var startOffset = offset;
        var endOffset = offset + characters.length;
        addUndoAction(deleteCharacters,textNode,startOffset,endOffset);
    }

    // public
    function deleteCharacters(textNode,startOffset,endOffset)
    {
        if (textNode.nodeType != Node.TEXT_NODE)
            throw new Error("DOM_deleteCharacters called on non-text node "+nodeString(textNode));
        if (endOffset == null)
            endOffset = textNode.nodeValue.length;
        if (endOffset < startOffset)
            throw new Error("DOM_deleteCharacters called with invalid start/end offset");
        trackedPositionsForNode(textNode).forEach(function (position) {
            var deleteCount = endOffset - startOffset;
            if ((position.offset > startOffset) && (position.offset < endOffset))
                position.offset = startOffset;
            else if (position.offset >= endOffset)
                position.offset -= deleteCount;
        });

        var removed = textNode.nodeValue.slice(startOffset,endOffset);
        addUndoAction(insertCharacters,textNode,startOffset,removed);

        textNode.nodeValue = textNode.nodeValue.slice(0,startOffset) +
                             textNode.nodeValue.slice(endOffset);
    }

    // public
    function setNodeValue(textNode,value)
    {
        if (textNode.nodeType != Node.TEXT_NODE)
            throw new Error("DOM_setNodeValue called on non-text node");
        trackedPositionsForNode(textNode).forEach(function (position) {
            position.offset = 0;
        });
        var oldValue = textNode.nodeValue;
        addUndoAction(setNodeValue,textNode,oldValue);
        textNode.nodeValue = value;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                            //
    //                                  High-level DOM Operations                                 //
    //                                                                                            //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    function appendChildInternal(parent,newChild)
    {
        insertBeforeInternal(parent,newChild,null);
    }

    // public
    function appendChild(node,child)
    {
        return DOM_insertBefore(node,child,null);
    }

    // public
    function insertBefore(parent,child,nextSibling)
    {
        var newOffset;
        if (nextSibling != null)
            newOffset = DOM_nodeOffset(nextSibling);
        else
            newOffset = parent.childNodes.length;

        var oldParent = child.parentNode;
        if (oldParent != null) { // already in tree
            var oldOffset = DOM_nodeOffset(child);

            if ((oldParent == parent) && (newOffset > oldOffset))
                newOffset--;

            trackedPositionsForNode(oldParent).forEach(function (position) {
                if (position.offset > oldOffset) {
                    position.offset--;
                }
                else if (position.offset == oldOffset) {
                    position.node = parent;
                    position.offset = newOffset;
                }
            });
        }

        var result = insertBeforeInternal(parent,child,nextSibling);
        trackedPositionsForNode(parent).forEach(function (position) {
            if (position.offset > newOffset)
                position.offset++;
        });
        return result;
    }

    // public
    function deleteNode(node)
    {
        if (node.parentNode == null) // already deleted
            return;
        adjustPositionsRecursive(node);
        deleteNodeInternal(node,true);

        function adjustPositionsRecursive(current)
        {
            for (var child = current.firstChild; child != null; child = child.nextSibling)
                adjustPositionsRecursive(child);

            trackedPositionsForNode(current.parentNode).forEach(function (position) {
                var offset = DOM_nodeOffset(current);
                if (offset < position.offset) {
                    position.offset--;
                }
            });
            trackedPositionsForNode(current).forEach(function (position) {
                var offset = DOM_nodeOffset(current);
                position.node = current.parentNode;
                position.offset = offset;
            });
        }
    }

    // public
    function removeAttribute(element,name,value)
    {
        DOM_setAttribute(element,name,null);
    }

    // public
    function removeAttributeNS(element,namespaceURI,localName)
    {
        DOM_setAttributeNS(element,namespaceURI,localName)
    }

    // public
    function deleteAllChildren(parent)
    {
        while (parent.firstChild != null)
            DOM_deleteNode(parent.firstChild);
    }

    // public
    function shallowCopyElement(element)
    {
        return DOM_cloneNode(element,false,true);
    }

    // public
    function removeNodeButKeepChildren(node)
    {
        var offset = DOM_nodeOffset(node);
        var childCount = node.childNodes.length;

        trackedPositionsForNode(node.parentNode).forEach(function (position) {
            if (position.offset > offset)
                position.offset += childCount-1;
        });

        trackedPositionsForNode(node).forEach(function (position) {
            position.node = node.parentNode;
            position.offset += offset;
        });

        var parent = node.parentNode;
        var nextSibling = node.nextSibling;
        deleteNodeInternal(node,false);

        while (node.firstChild != null) {
            var child = node.firstChild;
            insertBeforeInternal(parent,child,nextSibling);
        }
    }

    // public
    function replaceElement(oldElement,newName)
    {
        var listeners = listenersForNode(oldElement);
        var newElement = DOM_createElement(document,newName);
        for (var i = 0; i < oldElement.attributes.length; i++) {
            var name = oldElement.attributes[i].nodeName; // check-ok
            var value = oldElement.getAttribute(name);
            DOM_setAttribute(newElement,name,value);
        }

        var positions = arrayCopy(trackedPositionsForNode(oldElement));
        if (positions != null) {
            for (var i = 0; i < positions.length; i++) {
                if (positions[i].node != oldElement)
                    throw new Error("replaceElement: position with wrong node");
                positions[i].node = newElement;
            }
        }

        var parent = oldElement.parentNode;
        var nextSibling = oldElement.nextSibling;
        while (oldElement.firstChild != null)
            appendChildInternal(newElement,oldElement.firstChild);
        // Deletion must be done first so if it's a heading, the outline code picks up the change
        // correctly. Otherwise, there could be two elements in the document with the same id at
        // the same time.
        deleteNodeInternal(oldElement,false);
        insertBeforeInternal(parent,newElement,nextSibling);

        for (var i = 0; i < listeners.length; i++)
            listeners[i].afterReplaceElement(oldElement,newElement);

        return newElement;
    }

    // public
    function wrapNode(node,elementName)
    {
        var wrapper = DOM_createElement(document,elementName);

        insertBeforeInternal(node.parentNode,wrapper,node);
        appendChildInternal(wrapper,node);

        return wrapper;
    }

    function wrapSiblings(first,last,elementName)
    {
        var parent = first.parentNode;
        var wrapper = DOM_createElement(document,elementName);

        if (first.parentNode != last.parentNode)
            throw new Error("first and last are not siblings");
        var firstOffset = DOM_nodeOffset(first);
        var lastOffset = DOM_nodeOffset(last);
        var nodeCount = lastOffset - firstOffset + 1;
        debug("firstOffset = "+firstOffset);
        debug("lastOffset = "+lastOffset);
        debug("nodeCount = "+nodeCount);
        debug("first = "+first.outerHTML);
        debug("last = "+last.outerHTML);
        trackedPositionsForNode(parent).forEach(function (position) {
            if ((position.offset >= firstOffset) && (position.offset <= lastOffset+1)) {
                var old = position.toString();
                position.node = wrapper;
                position.offset -= firstOffset;
                var nw = position.toString();
                debug("Changed "+old+" to "+nw);
            }
            else if (position.offset > lastOffset+1) {
                position.offset -= (nodeCount-1);
            }
        });

        insertBeforeInternal(parent,wrapper,first);
        var end = last.nextSibling;
        var current = first;
        while (current != end) {
            var next = current.nextSibling;
            appendChildInternal(wrapper,current);
            current = next;
        }
    }

    // public
    function mergeWithNextSibling(current,whiteList)
    {
        var parent = current.parentNode;
        var next = current.nextSibling;

        if ((next == null) || !DOM_nodesMergeable(current,next,whiteList))
            return;

        var currentLength = DOM_maxChildOffset(current);
        var nextOffset = DOM_nodeOffset(next);

        var lastChild = null;

        if (current.nodeType == Node.ELEMENT_NODE) {
            lastChild = current.lastChild;
            DOM_insertBefore(current,next,null);
            DOM_removeNodeButKeepChildren(next);
        }
        else {
            DOM_insertCharacters(current,current.nodeValue.length,next.nodeValue);

            trackedPositionsForNode(next).forEach(function (position) {
                position.node = current;
                position.offset = position.offset+currentLength;
            });

            trackedPositionsForNode(current.parentNode).forEach(function (position) {
                if (position.offset == nextOffset) {
                    position.node = current;
                    position.offset = currentLength;
                }
            });

            DOM_deleteNode(next);
        }

        if (lastChild != null)
            DOM_mergeWithNextSibling(lastChild,whiteList);
    }

    // public
    function nodesMergeable(a,b,whiteList)
    {
        if ((a.nodeType == Node.TEXT_NODE) && (b.nodeType == Node.TEXT_NODE))
            return true;
        else if ((a.nodeType == Node.ELEMENT_NODE) && (b.nodeType == Node.ELEMENT_NODE))
            return elementsMergable(a,b);
        else
            return false;

        function elementsMergable(a,b)
        {
            if (whiteList["force"] && isParagraphNode(a) && isParagraphNode(b))
                return true;
            if ((DOM_upperName(a) == DOM_upperName(b)) &&
                whiteList[DOM_upperName(a)] &&
                (a.attributes.length == b.attributes.length)) {
                for (var i = 0; i < a.attributes.length; i++) {
                    var attrName = a.attributes[i].nodeName; // check-ok
                    if (a.getAttribute(attrName) != b.getAttribute(attrName))
                        return false;
                }
                return true;
            }

            return false;
        }
    }

    function getDataForNode(node,create)
    {
        if (node._nodeId == null)
            throw new Error("getDataForNode: node "+DOM_upperName(node)+" has no _nodeId property");
        if ((nodeData[node._nodeId] == null) && create)
            nodeData[node._nodeId] = new Object();
        return nodeData[node._nodeId];
    }

    function trackedPositionsForNode(node)
    {
        var data = getDataForNode(node,false);
        if ((data != null) && (data.trackedPositions != null)) {
            // Sanity check
            for (var i = 0; i < data.trackedPositions.length; i++) {
                if (data.trackedPositions[i].node != node)
                    throw new Error("Position "+data.trackedPositions[i]+" has wrong node");
            }
            return arrayCopy(data.trackedPositions);
        }
        else {
            return [];
        }
    }

    function listenersForNode(node)
    {
        var data = getDataForNode(node,false);
        if ((data != null) && (data.listeners != null))
            return data.listeners;
        else
            return [];
    }

    // public
    function addTrackedPosition(position)
    {
        var data = getDataForNode(position.node,true);
        if (data.trackedPositions == null)
            data.trackedPositions = new Array();
        data.trackedPositions.push(position);
    }

    // public
    function removeTrackedPosition(position)
    {
        var data = getDataForNode(position.node,false);
        if ((data == null) || (data.trackedPositions == null))
            throw new Error("DOM_removeTrackedPosition: no registered positions for this node "+
                            "("+DOM_upperName(position.node)+")");
        for (var i = 0; i < data.trackedPositions.length; i++) {
            if (data.trackedPositions[i] == position) {
                data.trackedPositions.splice(i,1);
                return;
            }
        }
        throw new Error("DOM_removeTrackedPosition: position is not registered ("+
                        data.trackedPositions.length+" others)");
    }

    // public
    function removeAdjacentWhitespace(node)
    {
        while ((node.previousSibling != null) && (isWhitespaceTextNode(node.previousSibling)))
            DOM_deleteNode(node.previousSibling);
        while ((node.nextSibling != null) && (isWhitespaceTextNode(node.nextSibling)))
            DOM_deleteNode(node.nextSibling);
    }

    // public
    function lowerName(node)
    {
        return node.nodeName.toLowerCase(); // check-ok
    }

    // public
    function upperName(node)
    {
        if (node.nodeType == Node.ELEMENT_NODE)
            return node.nodeName.toUpperCase(); // check-ok
        else
            return node.nodeName; // check-ok
    }

    // public
    function documentHead(document)
    {
        var html = document.documentElement;
        for (var child = html.firstChild; child != null; child = child.nextSibling) {
            if (DOM_upperName(child) == "HEAD")
                return child;
        }
        throw new Error("Document contains no HEAD element");
    }

    // public
    function ensureUniqueIds(root)
    {
        var ids = new Object();
        var duplicates = new Array();

        discoverDuplicates(root);
        renameDuplicates();

        return;

        function discoverDuplicates(node)
        {
            if (node.nodeType != Node.ELEMENT_NODE)
                return;

            var id = node.getAttribute("id");
            if ((id != null) && (id != "")) {
                if (ids[id])
                    duplicates.push(node);
                else
                    ids[id] = true;
            }
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                discoverDuplicates(child);
        }

        function renameDuplicates()
        {
            var nextNumberForPrefix = new Object();
            for (var i = 0; i < duplicates.length; i++) {
                var id = duplicates[i].getAttribute("id");
                var prefix = id.replace(/[0-9]+$/,"");
                var num = nextNumberForPrefix[prefix] ? nextNumberForPrefix[prefix] : 1;

                var candidate;
                do {
                    candidate = prefix + num;
                    num++;
                } while (ids[candidate]);

                DOM_setAttribute(duplicates[i],"id",candidate);
                ids[candidate] = true;
                nextNumberForPrefix[prefix] = num;
            }
        }
    }

    // public
    function nodeOffset(node)
    {
        var offset = 0;
        for (var n = node.parentNode.firstChild; n != node; n = n.nextSibling)
            offset++;
        return offset;
    }

    // public
    function maxChildOffset(node)
    {
        if (node.nodeType == Node.TEXT_NODE)
            return node.nodeValue.length;
        else if (node.nodeType == Node.ELEMENT_NODE)
            return node.childNodes.length;
        else
            throw new Error("maxOffset: invalid node type ("+node.nodeType+")");
    }

    // public
    function ignoreMutationsWhileExecuting(fun)
    {
        ignoreMutations++;
        try {
            return fun();
        }
        finally {
            ignoreMutations--;
        }
    }

    // public
    function getIgnoreMutations()
    {
        return ignoreMutations;
    }

    // public
    function addListener(node,listener)
    {
        var data = getDataForNode(node,true);
        if (data.listeners == null)
            data.listeners = [listener];
        else
            data.listeners.push(listener);
    }

    // public
    function removeListener(node,listener)
    {
        var list = listenersForNode(node);
        var index = list.indexOf(listener);
        if (index >= 0)
            list.splice(index,1);
    }

    // public
    function Listener()
    {
    }

    Listener.prototype.afterReplaceElement = function(oldElement,newElement) {}

    // Helper functions
    DOM_assignNodeIds = trace(assignNodeIds);

    // Primitive node creation operations
    DOM_createElement = trace(createElement);
    DOM_createElementNS = trace(createElementNS);
    DOM_createTextNode = trace(createTextNode);
    DOM_createComment = trace(createComment);
    DOM_cloneNode = trace(cloneNode);

    // Primitive and high-level node mutation operations
    DOM_appendChild = trace(appendChild);
    DOM_insertBefore = trace(insertBefore);
    DOM_deleteNode = trace(deleteNode);
    DOM_setAttribute = trace(setAttribute);
    DOM_setAttributeNS = trace(setAttributeNS);
    DOM_removeAttribute = trace(removeAttribute);
    DOM_removeAttributeNS = trace(removeAttributeNS);
    DOM_setStyleProperties = trace(setStyleProperties);
    DOM_insertCharacters = trace(insertCharacters);
    DOM_deleteCharacters = trace(deleteCharacters);
    DOM_setNodeValue = trace(setNodeValue);

    // High-level DOM operations
    DOM_deleteAllChildren = trace(deleteAllChildren);
    DOM_shallowCopyElement = trace(shallowCopyElement);
    DOM_removeNodeButKeepChildren = trace(removeNodeButKeepChildren);
    DOM_replaceElement = trace(replaceElement);
    DOM_wrapNode = trace(wrapNode);
    DOM_wrapSiblings = trace(wrapSiblings);
    DOM_mergeWithNextSibling = trace(mergeWithNextSibling);
    DOM_nodesMergeable = trace(nodesMergeable);
    DOM_addTrackedPosition = trace(addTrackedPosition);
    DOM_removeTrackedPosition = trace(removeTrackedPosition);
    DOM_removeAdjacentWhitespace = trace(removeAdjacentWhitespace);
    DOM_lowerName = trace(lowerName);
    DOM_upperName = trace(upperName);
    DOM_documentHead = trace(documentHead);
    DOM_ensureUniqueIds = trace(ensureUniqueIds);
    DOM_nodeOffset = trace(nodeOffset);
    DOM_maxChildOffset = trace(maxChildOffset);
    DOM_ignoreMutationsWhileExecuting = trace(ignoreMutationsWhileExecuting);
    DOM_getIgnoreMutations = trace(getIgnoreMutations);
    DOM_addListener = trace(addListener);
    DOM_removeListener = trace(removeListener);
    DOM_Listener = Listener;

})();
