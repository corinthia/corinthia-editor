// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var DOM_assignNodeIds;
var DOM_addUndoListeners;
var DOM_createElement;
var DOM_createElementNS;
var DOM_createTextNode;
var DOM_createComment;
var DOM_cloneNode;
var DOM_appendChild;
var DOM_insertBefore;
var DOM_deleteNode;
var DOM_deleteAllChildren;
var DOM_shallowCopyElement;
var DOM_removeNodeButKeepChildren;
var DOM_replaceElement;
var DOM_wrapNode;
var DOM_mergeWithNextSibling;
var DOM_nodesMergeable;
var DOM_addTrackedPosition;
var DOM_removeTrackedPosition;
var DOM_removeAdjacentWhitespace;
var DOM_insertCharacters;
var DOM_deleteCharacters;
var DOM_setNodeValue;
var DOM_lowerName;
var DOM_upperName;
var DOM_documentHead;
var DOM_ensureUniqueIds;
var DOM_nodeOffset;
var DOM_maxChildOffset;
var DOM_addListener;
var DOM_removeListener;
var DOM_Listener;

(function() {

    // Assign a unique prefix to the ids, to ensure namespaces don't clash when multiple instances
    // of this are used in different browser windows
    var prefix = Math.random()+":";
    var nextNodeId = 0;
    var nodeData = new Object();

    function assignNodeId(node)
    {
        if (node._nodeId != null)
            throw new Error(node+" already has id");
        node._nodeId = prefix+nextNodeId++;
        return node;
    }

    function insertBeforeInternal(parent,newChild,refChild)
    {
        if (window.UndoManager_addAction != null) {
            UndoManager_addAction(function() {
                deleteNodeInternal(newChild);
            },"Remove "+DOM_upperName(newChild)+" from parent "+DOM_upperName(parent));
        }

        parent.insertBefore(newChild,refChild);
    }

    function appendChildInternal(parent,newChild)
    {
        insertBeforeInternal(parent,newChild,null);
    }

    function deleteNodeInternal(node,deleteDescendantData)
    {
        if (node._nodeId == null)
            throw new Error("deleteNodeInternal: node "+DOM_upperName(node)+
                            " has no _nodeId property");

        var parent = node.parentNode;
        var nextSibling = node.nextSibling;
        var nextName = (nextSibling == null) ? null : DOM_upperName(nextSibling);
        var data = nodeData[node._nodeId];
        if (window.UndoManager_addAction != null) {
            UndoManager_addAction(function() {
                insertBeforeInternal(parent,node,nextSibling);
            },"Insert "+DOM_upperName(node)+" into parent "+
              DOM_upperName(parent)+" before "+nextName);
        }

        node.parentNode.removeChild(node);

        if (deleteDescendantData)
            deleteNodeDataRecursive(node);
        else
            deleteNodeData(node);

        return;

        function deleteNodeData(current)
        {
            if (window.UndoManager_addAction != null) {
                var data = nodeData[current._nodeId];
                UndoManager_addAction(function() {
                    nodeData[current._nodeId] = data;
                },"Set node data for "+DOM_upperName(current));
            }
            delete nodeData[current._nodeId];
        }

        function deleteNodeDataRecursive(current)
        {
            deleteNodeData(current);
            for (var child = current.firstChild; child != null; child = child.nextSibling)
                deleteNodeDataRecursive(child);
        }
    }

    function attrModified(event)
    {
        var element = event.target;
        var attrName = event.attrName;
        var prevValue = event.prevValue;
        var newValue = event.newValue;
        if (event.attrChange == MutationEvent.ADDITION) {
            UndoManager_addAction(function() {
                element.removeAttribute(attrName);
            },"Remove "+attrName+" attribute from "+DOM_upperName(element));
        }
        else if (event.attrChange == MutationEvent.REMOVAL) {
            UndoManager_addAction(function() {
                element.setAttribute(attrName,prevValue);
            },"Add "+attrName+" attribute to "+
              DOM_upperName(element)+" with value \""+prevValue+"\"");
        }
        else if (event.attrChange == MutationEvent.MODIFICATION) {
            UndoManager_addAction(function() {
                element.setAttribute(attrName,prevValue);
            },"Change "+attrName+" attribute of "+
              DOM_upperName(element)+" to value \""+prevValue+"\"");
        }
    }

    function characterDataModified(node,prevValue)
    {
        UndoManager_addAction(function() {
            node.nodeValue = prevValue;
        },"Set text node to \""+prevValue+"\"");
    }

    // public methods
    DOM_assignNodeIds = function(node)
    {
        if (node._nodeId != null)
            throw new Error(node+" already has id");
        node._nodeId = prefix+nextNodeId++;
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            DOM_assignNodeIds(child);
    }

    DOM_addUndoListeners = function(node)
    {
//        node.addEventListener("DOMNodeInserted",nodeInserted);
//        node.addEventListener("DOMNodeRemoved",nodeRemoved);
        node.addEventListener("DOMAttrModified",attrModified);
    }

    // Low-level methods

    DOM_createElement = function(document,elementName)
    {
        return assignNodeId(document.createElement(elementName));
    }

    DOM_createElementNS = function(document,namespaceURI,qualifiedName)
    {
        return assignNodeId(document.createElementNS(namespaceURI,qualifiedName));
    }

    DOM_createTextNode = function(document,data)
    {
        return assignNodeId(document.createTextNode(data));
    }

    DOM_createComment = function(document,data)
    {
        return assignNodeId(document.createComment(data));
    }

    DOM_cloneNode = function(original,deep)
    {
        var clone = original.cloneNode(deep);
        DOM_assignNodeIds(clone);
        return clone;
    }

    DOM_appendChild = function(node,child)
    {
        return DOM_insertBefore(node,child,null);
    }

    DOM_insertBefore = function(parent,child,nextSibling)
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

    DOM_deleteNode = function(node)
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

    // High-level methods

    DOM_deleteAllChildren = function(parent)
    {
        while (parent.firstChild != null)
            DOM_deleteNode(parent.firstChild);
    }

    DOM_shallowCopyElement = function(element)
    {
        var copy = DOM_cloneNode(element,false);
        copy.removeAttribute("id");
        return copy;
    }

    DOM_removeNodeButKeepChildren = function(node)
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

    DOM_replaceElement = function(oldElement,newName)
    {
        var listeners = listenersForNode(oldElement);
        var newElement = DOM_createElement(document,newName);
        for (var i = 0; i < oldElement.attributes.length; i++) {
            var name = oldElement.attributes[i].nodeName;
            var value = oldElement.getAttribute(name);
            newElement.setAttribute(name,value);
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

    DOM_wrapNode = function(node,elementName)
    {
        var wrapper = DOM_createElement(document,elementName);

        insertBeforeInternal(node.parentNode,wrapper,node);
        appendChildInternal(wrapper,node);

        return wrapper;
    }

    DOM_mergeWithNextSibling = function(current,whiteList)
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

    DOM_nodesMergeable = function(a,b,whiteList)
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
                    var attrName = a.attributes[i].nodeName;
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

    DOM_addTrackedPosition = function(position)
    {
        var data = getDataForNode(position.node,true);
        if (data.trackedPositions == null)
            data.trackedPositions = new Array();
        data.trackedPositions.push(position);
    }

    DOM_removeTrackedPosition = function(position)
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

    DOM_removeAdjacentWhitespace = function(node)
    {
        while ((node.previousSibling != null) && (isWhitespaceTextNode(node.previousSibling)))
            DOM_deleteNode(node.previousSibling);
        while ((node.nextSibling != null) && (isWhitespaceTextNode(node.nextSibling)))
            DOM_deleteNode(node.nextSibling);
    }

    DOM_insertCharacters = function(textNode,offset,characters)
    {
        if (textNode.nodeType != Node.TEXT_NODE)
            throw new Error("DOM_insertCharacters called on non-text node");
        trackedPositionsForNode(textNode).forEach(function (position) {
            if (position.offset > offset)
                position.offset += characters.length;
        });
        characterDataModified(textNode,textNode.nodeValue);
        textNode.nodeValue = textNode.nodeValue.slice(0,offset) +
                             characters +
                             textNode.nodeValue.slice(offset);
    }

    DOM_deleteCharacters = function(textNode,startOffset,endOffset)
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
        characterDataModified(textNode,textNode.nodeValue);
        textNode.nodeValue = textNode.nodeValue.slice(0,startOffset) +
                             textNode.nodeValue.slice(endOffset);
    }

    DOM_setNodeValue = function(textNode,value)
    {
        if (textNode.nodeType != Node.TEXT_NODE)
            throw new Error("DOM_setNodeValue called on non-text node");
        trackedPositionsForNode(textNode).forEach(function (position) {
            position.offset = 0;
        });
        characterDataModified(textNode,textNode.nodeValue);
        textNode.nodeValue = value;
    }

    DOM_lowerName = function(node)
    {
        return node.nodeName.toLowerCase();
    }

    DOM_upperName = function(node)
    {
        if (node.nodeType == Node.ELEMENT_NODE)
            return node.nodeName.toUpperCase();
        else
            return node.nodeName;
    }

    DOM_documentHead = function(document)
    {
        var html = document.documentElement;
        for (var child = html.firstChild; child != null; child = child.nextSibling) {
            if (DOM_upperName(child) == "HEAD")
                return child;
        }
        throw new Error("Document contains no HEAD element");
    }

    DOM_ensureUniqueIds = function(root)
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

                duplicates[i].setAttribute("id",candidate);
                ids[candidate] = true;
                nextNumberForPrefix[prefix] = num;
            }
        }
    }

    DOM_nodeOffset = function(node)
    {
        var offset = 0;
        for (var n = node.parentNode.firstChild; n != node; n = n.nextSibling)
            offset++;
        return offset;
    }

    DOM_maxChildOffset = function(node)
    {
        if (node.nodeType == Node.TEXT_NODE)
            return node.nodeValue.length;
        else if (node.nodeType == Node.ELEMENT_NODE)
            return node.childNodes.length;
        else
            throw new Error("maxOffset: invalid node type ("+node.nodeType+")");
    }

    DOM_addListener = function(node,listener)
    {
        var data = getDataForNode(node,true);
        if (data.listeners == null)
            data.listeners = [listener];
        else
            data.listeners.push(listener);
    }

    DOM_removeListener = function(node,listener)
    {
        var list = listenersForNode(node);
        var index = list.indexOf(listener);
        if (index >= 0)
            list.splice(index,1);
    }

    function Listener()
    {
    }

    Listener.prototype.afterReplaceElement = function(oldElement,newElement) {}

    DOM_Listener = Listener;

})();
