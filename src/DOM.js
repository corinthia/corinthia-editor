// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var DOM_assignNodeIds;
var DOM_createElement;
var DOM_createElementNS;
var DOM_createTextNode;
var DOM_createComment;
var DOM_cloneNode;
var DOM_setAttribute;
var DOM_setAttributeNS;
var DOM_removeAttribute;
var DOM_removeAttributeNS;
var DOM_setStyleProperty;
var DOM_removeStyleProperty;
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

    function addUndoAction(fun,name)
    {
        if (window.undoSupported)
            UndoManager_addAction(fun,name);
    }

    function assignNodeId(node)
    {
        if (node._nodeId != null)
            throw new Error(node+" already has id");
        node._nodeId = prefix+nextNodeId++;
        return node;
    }

    function insertBeforeInternal(parent,newChild,refChild)
    {
        if (newChild.parentNode == null) {
            addUndoAction(function() {
                deleteNodeInternal(newChild);
            },"Remove "+newChild+" from parent "+parent);
        }
        else {
            var oldParent = newChild.parentNode;
            var oldNext = newChild.nextSibling;
            addUndoAction(function() { insertBeforeInternal(oldParent,newChild,oldNext); },
                          "Insert "+newChild+" into parent "+oldParent+" before "+oldNext);
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
        addUndoAction(function() {
            insertBeforeInternal(parent,node,nextSibling);
        },"Insert "+node+" into parent "+parent+" before "+nextName);

        node.parentNode.removeChild(node);

        if (deleteDescendantData)
            deleteNodeDataRecursive(node);
        else
            deleteNodeData(node);

        return;

        function deleteNodeData(current)
        {
            if (window.undoSupported) {
                var data = nodeData[current._nodeId];
                UndoManager_addAction(function() {
                    // FIXME: this won't redo properly
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

    // public methods
    function assignNodeIds(node)
    {
        if (node._nodeId != null)
            throw new Error(node+" already has id");
        node._nodeId = prefix+nextNodeId++;
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            assignNodeIds(child);
    }

    // Low-level methods

    function createElement(document,elementName)
    {
        return assignNodeId(document.createElement(elementName));
    }

    function createElementNS(document,namespaceURI,qualifiedName)
    {
        return assignNodeId(document.createElementNS(namespaceURI,qualifiedName));
    }

    function createTextNode(document,data)
    {
        return assignNodeId(document.createTextNode(data));
    }

    function createComment(document,data)
    {
        return assignNodeId(document.createComment(data));
    }

    function cloneNode(original,deep)
    {
        var clone = original.cloneNode(deep);
        DOM_assignNodeIds(clone);
        return clone;
    }

    function setAttribute(element,name,value)
    {
        if (element.hasAttribute(name)) {
            var oldValue = element.getAttribute(name);
            addUndoAction(function() { DOM_setAttribute(element,name,oldValue); },
                          "Set attribute "+JSON.stringify(name)+" of element "+element.nodeName+
                          " to "+JSON.stringify(oldValue));
        }
        else {
            addUndoAction(function() {
                DOM_removeAttribute(element,name);
            },"Remove attribute "+JSON.stringify(name)+" from element "+element.nodeName);
        }

        if (value == null)
            element.removeAttribute(name);
        else
            element.setAttribute(name,value);
    }

    function setAttributeNS(element,namespaceURI,qualifiedName,value)
    {
        var localName = qualifiedName.replace(/^.*:/,"");
        if (element.hasAttributeNS(namespaceURI,localName)) {
            var oldValue = element.getAttributeNS(namespaceURI,localName);
            var oldQName = element.getAttributeNodeNS(namespaceURI,localName).nodeName;
            addUndoAction(function() {
                DOM_setAttributeNS(element,namespaceURI,oldQName,oldValue);
            },
                          "Set attribute {"+namespaceURI+"}"+oldQName+" of element "+
                          element.nodeName+" to "+JSON.stringify(oldValue));
        }
        else {
            addUndoAction(function() {
                DOM_removeAttributeNS(element,namespaceURI,localName);
            },"Remove attribute "+JSON.stringify(name)+" from element "+element.nodeName);
        }

        if (value == null)
            element.removeAttributeNS(namespaceURI,localName);
        else
            element.setAttributeNS(namespaceURI,qualifiedName,value);
    }

    function removeAttribute(element,name,value)
    {
        DOM_setAttribute(element,name,null);
    }

    function removeAttributeNS(element,namespaceURI,localName)
    {
        DOM_setAttributeNS(element,namespaceURI,localName)
    }

    function setStyleProperty(element,name,value)
    {
        var oldValue = element.style[name];
        addUndoAction(function() { DOM_setStyleProperty(element,name,oldValue); },
                      element.nodeName+".style["+JSON.stringify(name)+"] = "+
                      JSON.stringify(value));

        element.style[name] = value;
        if (element.getAttribute("style") == "")
            element.removeAttribute("style");
    }

    function removeStyleProperty(element,name)
    {
        DOM_setStyleProperty(element,name,null);
    }

    function appendChild(node,child)
    {
        return DOM_insertBefore(node,child,null);
    }

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

    // High-level methods

    function deleteAllChildren(parent)
    {
        while (parent.firstChild != null)
            DOM_deleteNode(parent.firstChild);
    }

    function shallowCopyElement(element)
    {
        var copy = DOM_cloneNode(element,false);
        copy.removeAttribute("id");
        return copy;
    }

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

    function replaceElement(oldElement,newName)
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

    function wrapNode(node,elementName)
    {
        var wrapper = DOM_createElement(document,elementName);

        insertBeforeInternal(node.parentNode,wrapper,node);
        appendChildInternal(wrapper,node);

        return wrapper;
    }

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

    function addTrackedPosition(position)
    {
        var data = getDataForNode(position.node,true);
        if (data.trackedPositions == null)
            data.trackedPositions = new Array();
        data.trackedPositions.push(position);
    }

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

    function removeAdjacentWhitespace(node)
    {
        while ((node.previousSibling != null) && (isWhitespaceTextNode(node.previousSibling)))
            DOM_deleteNode(node.previousSibling);
        while ((node.nextSibling != null) && (isWhitespaceTextNode(node.nextSibling)))
            DOM_deleteNode(node.nextSibling);
    }

    function insertCharacters(textNode,offset,characters)
    {
        if (textNode.nodeType != Node.TEXT_NODE)
            throw new Error("DOM_insertCharacters called on non-text node");
        trackedPositionsForNode(textNode).forEach(function (position) {
            if (position.offset > offset)
                position.offset += characters.length;
        });
        textNode.nodeValue = textNode.nodeValue.slice(0,offset) +
                             characters +
                             textNode.nodeValue.slice(offset);
        if (window.undoSupported) {
            var length = characters.length;
            UndoManager_addAction(function() {
                deleteCharacters(textNode,offset,length);
            },"Delete "+JSON.stringify(characters)+" at position "+offset);
        }
    }

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

        if (window.undoSupported) {
            var removed = textNode.nodeValue.slice(startOffset,endOffset);
            UndoManager_addAction(function() {
                insertCharacters(textNode,startOffset,removed);
            },"Insert "+JSON.stringify(removed)+" at position "+startOffset);
        }

        textNode.nodeValue = textNode.nodeValue.slice(0,startOffset) +
                             textNode.nodeValue.slice(endOffset);
    }

    function setNodeValue(textNode,value)
    {
        if (textNode.nodeType != Node.TEXT_NODE)
            throw new Error("DOM_setNodeValue called on non-text node");
        trackedPositionsForNode(textNode).forEach(function (position) {
            position.offset = 0;
        });
        var oldValue = textNode.nodeValue;
        if (window.undoSupported) {
            UndoManager_addAction(function() {
                setNodeValue(textNode,oldValue);
            },"Set text node to "+JSON.stringify(oldValue));
        }
        textNode.nodeValue = value;
    }

    function lowerName(node)
    {
        return node.nodeName.toLowerCase();
    }

    function upperName(node)
    {
        if (node.nodeType == Node.ELEMENT_NODE)
            return node.nodeName.toUpperCase();
        else
            return node.nodeName;
    }

    function documentHead(document)
    {
        var html = document.documentElement;
        for (var child = html.firstChild; child != null; child = child.nextSibling) {
            if (DOM_upperName(child) == "HEAD")
                return child;
        }
        throw new Error("Document contains no HEAD element");
    }

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

                duplicates[i].setAttribute("id",candidate);
                ids[candidate] = true;
                nextNumberForPrefix[prefix] = num;
            }
        }
    }

    function nodeOffset(node)
    {
        var offset = 0;
        for (var n = node.parentNode.firstChild; n != node; n = n.nextSibling)
            offset++;
        return offset;
    }

    function maxChildOffset(node)
    {
        if (node.nodeType == Node.TEXT_NODE)
            return node.nodeValue.length;
        else if (node.nodeType == Node.ELEMENT_NODE)
            return node.childNodes.length;
        else
            throw new Error("maxOffset: invalid node type ("+node.nodeType+")");
    }

    function addListener(node,listener)
    {
        var data = getDataForNode(node,true);
        if (data.listeners == null)
            data.listeners = [listener];
        else
            data.listeners.push(listener);
    }

    function removeListener(node,listener)
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

    DOM_assignNodeIds = trace(assignNodeIds);
    DOM_createElement = trace(createElement);
    DOM_createElementNS = trace(createElementNS);
    DOM_createTextNode = trace(createTextNode);
    DOM_createComment = trace(createComment);
    DOM_cloneNode = trace(cloneNode);
    DOM_setAttribute = trace(setAttribute);
    DOM_setAttributeNS = trace(setAttributeNS);
    DOM_removeAttribute = trace(removeAttribute);
    DOM_removeAttributeNS = trace(removeAttributeNS);
    DOM_setStyleProperty = trace(setStyleProperty);
    DOM_removeStyleProperty = trace(removeStyleProperty);
    DOM_appendChild = trace(appendChild);
    DOM_insertBefore = trace(insertBefore);
    DOM_deleteNode = trace(deleteNode);
    DOM_deleteAllChildren = trace(deleteAllChildren);
    DOM_shallowCopyElement = trace(shallowCopyElement);
    DOM_removeNodeButKeepChildren = trace(removeNodeButKeepChildren);
    DOM_replaceElement = trace(replaceElement);
    DOM_wrapNode = trace(wrapNode);
    DOM_mergeWithNextSibling = trace(mergeWithNextSibling);
    DOM_nodesMergeable = trace(nodesMergeable);
    DOM_addTrackedPosition = trace(addTrackedPosition);
    DOM_removeTrackedPosition = trace(removeTrackedPosition);
    DOM_removeAdjacentWhitespace = trace(removeAdjacentWhitespace);
    DOM_insertCharacters = trace(insertCharacters);
    DOM_deleteCharacters = trace(deleteCharacters);
    DOM_setNodeValue = trace(setNodeValue);
    DOM_lowerName = trace(lowerName);
    DOM_upperName = trace(upperName);
    DOM_documentHead = trace(documentHead);
    DOM_ensureUniqueIds = trace(ensureUniqueIds);
    DOM_nodeOffset = trace(nodeOffset);
    DOM_maxChildOffset = trace(maxChildOffset);
    DOM_addListener = trace(addListener);
    DOM_removeListener = trace(removeListener);

})();
