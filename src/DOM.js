// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

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
        if (window.UndoManager != null) {
            UndoManager.addAction(function() {
                deleteNodeInternal(newChild);
            },"Remove "+DOM.upperName(newChild)+" from parent "+DOM.upperName(parent));
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
            throw new Error("deleteNodeInternal: node "+DOM.upperName(node)+" has no _nodeId property");

        var parent = node.parentNode;
        var nextSibling = node.nextSibling;
        var nextName = (nextSibling == null) ? null : DOM.upperName(nextSibling);
        var data = nodeData[node._nodeId];
        if (window.UndoManager != null) {
            UndoManager.addAction(function() {
                insertBeforeInternal(parent,node,nextSibling);
            },"Insert "+DOM.upperName(node)+" into parent "+DOM.upperName(parent)+" before "+nextName);
        }

        node.parentNode.removeChild(node);

        if (deleteDescendantData)
            deleteNodeDataRecursive(node);
        else
            deleteNodeData(node);

        return;

        function deleteNodeData(current)
        {
            if (window.UndoManager != null) {
                var data = nodeData[current._nodeId];
                UndoManager.addAction(function() {
                    nodeData[current._nodeId] = data;
                },"Set node data for "+DOM.upperName(current));
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
            UndoManager.addAction(function() {
                element.removeAttribute(attrName);
            },"Remove "+attrName+" attribute from "+DOM.upperName(element));
        }
        else if (event.attrChange == MutationEvent.REMOVAL) {
            UndoManager.addAction(function() {
                element.setAttribute(attrName,prevValue);
            },"Add "+attrName+" attribute to "+DOM.upperName(element)+" with value \""+prevValue+"\"");
        }
        else if (event.attrChange == MutationEvent.MODIFICATION) {
            UndoManager.addAction(function() {
                element.setAttribute(attrName,prevValue);
            },"Change "+attrName+" attribute of "+DOM.upperName(element)+" to value \""+prevValue+"\"");
        }
    }

    function characterDataModified(node,prevValue)
    {
        UndoManager.addAction(function() {
            node.nodeValue = prevValue;
        },"Set text node to \""+prevValue+"\"");
    }

    function fireNodeWillBeRemoved(node)
    {
    }

    function fireNodeWasInserted(node)
    {
    }

    function fireNodeWillBeMoved(node,destParent,destNextSibling)
    {
    }

    function fireNodeWasMoved(node,srcParent,srcNextSibling)
    {
    }


    var DOM = new Object();

    // public methods
    DOM.assignNodeIds = function(node)
    {
        if (node._nodeId != null)
            throw new Error(node+" already has id");
        node._nodeId = prefix+nextNodeId++;
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            DOM.assignNodeIds(child);
    }

    DOM.addUndoListeners = function(node)
    {
//        node.addEventListener("DOMNodeInserted",nodeInserted);
//        node.addEventListener("DOMNodeRemoved",nodeRemoved);
        node.addEventListener("DOMAttrModified",attrModified);
    }

    // Low-level methods

    DOM.createElement = function(document,elementName)
    {
        return assignNodeId(document.createElement(elementName));
    }

    DOM.createElementNS = function(document,namespaceURI,qualifiedName)
    {
        return assignNodeId(document.createElementNS(namespaceURI,qualifiedName));
    }

    DOM.createTextNode = function(document,data)
    {
        return assignNodeId(document.createTextNode(data));
    }

    DOM.createComment = function(document,data)
    {
        return assignNodeId(document.createComment(data));
    }

    DOM.cloneNode = function(original,deep)
    {
        var clone = original.cloneNode(deep);
        DOM.assignNodeIds(clone);
        return clone;
    }

    DOM.appendChild = function(node,child)
    {
        return DOM.insertBefore(node,child,null);
    }

    DOM.insertBefore = function(node,child,before)
    {
        var result = insertBeforeInternal(node,child,before);
        trackedPositionsForNode(child.parentNode).forEach(function (position) {
            var offset = getOffsetOfNodeInParent(child);
            if (offset < position.offset) {
                position.offset++;
            }
        });
        return result;
    }

    DOM.deleteNode = function(node)
    {
        adjustPositionsRecursive(node);
        deleteNodeInternal(node,true);

        function adjustPositionsRecursive(current)
        {
            for (var child = current.firstChild; child != null; child = child.nextSibling)
                adjustPositionsRecursive(child);

            trackedPositionsForNode(current.parentNode).forEach(function (position) {
                var offset = getOffsetOfNodeInParent(current);
                if (offset < position.offset) {
                    position.offset--;
                }
            });
            trackedPositionsForNode(current).forEach(function (position) {
                var offset = getOffsetOfNodeInParent(current);
                position.node = current.parentNode;
                position.offset = offset;
            });
        }
    }

    // High-level methods

    DOM.deleteAllChildren = function(parent)
    {
        while (parent.firstChild != null)
            DOM.deleteNode(parent.firstChild);
    }

    DOM.shallowCopyElement = function(element)
    {
        var copy = DOM.cloneNode(element,false);
        copy.removeAttribute("id");
        return copy;
    }

    DOM.moveNode = function(node,parentNode,nextSibling)
    {
        fireNodeWillBeRemoved(node);

        var offset = getOffsetOfNodeInParent(node);
        var newOffset;
        if (nextSibling != null)
            newOffset = getOffsetOfNodeInParent(nextSibling);
        else
            newOffset = parentNode.childNodes.length;

        if ((node.parentNode == parentNode) && (newOffset > offset))
            newOffset--;

        trackedPositionsForNode(node.parentNode).forEach(function (position) {
            var old = position.toString();
            if (position.offset > offset) {
                position.offset--;
            }
            else if (position.offset == offset) {
                position.node = parentNode;
                position.offset = newOffset;
            }
        });

        insertBeforeInternal(parentNode,node,nextSibling);

        trackedPositionsForNode(node.parentNode).forEach(function (position) {
            var old = position.toString();
            if (position.offset > newOffset) {
                position.offset++;
            }
        });


        fireNodeWasInserted(node);
    }

    DOM.removeNodeButKeepChildren = function(node)
    {
        fireNodeWillBeRemoved(node);

        var offset = getOffsetOfNodeInParent(node);
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
            fireNodeWasInserted(child);
        }
    }

    DOM.replaceElement = function(oldElement,newName)
    {
        var newElement = DOM.createElement(document,newName);
        for (var i = 0; i < oldElement.attributes.length; i++) {
            var name = oldElement.attributes[i].nodeName;
            var value = oldElement.getAttribute(name);
            newElement.setAttribute(name,value);
        }

        fireNodeWillBeRemoved(oldElement);

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
        insertBeforeInternal(parent,newElement,nextSibling);
        deleteNodeInternal(oldElement,false);

        fireNodeWasInserted(newElement);

        return newElement;
    }

    DOM.wrapNode = function(node,elementName)
    {
        var wrapper = DOM.createElement(document,elementName);
        fireNodeWillBeRemoved(node);

        insertBeforeInternal(node.parentNode,wrapper,node);
        appendChildInternal(wrapper,node);

        fireNodeWasInserted(wrapper);
        return wrapper;
    }

    DOM.mergeWithNextSibling = function(current,whiteList)
    {
        var parent = current.parentNode;
        var next = current.nextSibling;

        if ((next == null) || !DOM.nodesMergeable(current,next,whiteList))
            return;

        var currentLength = maxNodeOffset(current);
        var nextOffset = getOffsetOfNodeInParent(next);

        var lastChild = null;

        if (current.nodeType == Node.ELEMENT_NODE) {
            lastChild = current.lastChild;
            DOM.moveNode(next,current,null);
            DOM.removeNodeButKeepChildren(next);
        }
        else {
            DOM.insertCharacters(current,current.nodeValue.length,next.nodeValue);

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

            DOM.deleteNode(next);
        }

        if (lastChild != null)
            DOM.mergeWithNextSibling(lastChild,whiteList);
    }

    DOM.nodesMergeable = function(a,b,whiteList)
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
            if ((DOM.upperName(a) == DOM.upperName(b)) &&
                whiteList[DOM.upperName(a)] &&
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
            throw new Error("getDataForNode: node "+DOM.upperName(node)+" has no _nodeId property");
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

    DOM.addTrackedPosition = function(position)
    {
        var data = getDataForNode(position.node,true);
        if (data.trackedPositions == null)
            data.trackedPositions = new Array();
        data.trackedPositions.push(position);
    }

    DOM.removeTrackedPosition = function(position)
    {
        var data = getDataForNode(position.node,false);
        if ((data == null) || (data.trackedPositions == null))
            throw new Error("DOM.removeTrackedPosition: no registered positions for this node "+
                            "("+DOM.upperName(position.node)+")");
        for (var i = 0; i < data.trackedPositions.length; i++) {
            if (data.trackedPositions[i] == position) {
                data.trackedPositions.splice(i,1);
                return;
            }
        }
        throw new Error("DOM.removeTrackedPosition: position is not registered ("+
                        data.trackedPositions.length+" others)");
    }

    DOM.removeAdjacentWhitespace = function(node)
    {
        while ((node.previousSibling != null) && (isWhitespaceTextNode(node.previousSibling)))
            DOM.deleteNode(node.previousSibling);
        while ((node.nextSibling != null) && (isWhitespaceTextNode(node.nextSibling)))
            DOM.deleteNode(node.nextSibling);
    }

    DOM.insertCharacters = function(textNode,offset,characters)
    {
        if (textNode.nodeType != Node.TEXT_NODE)
            throw new Error("DOM.insertCharacters called on non-text node");
        trackedPositionsForNode(textNode).forEach(function (position) {
            if (position.offset > offset)
                position.offset += characters.length;
        });
        characterDataModified(textNode,textNode.nodeValue);
        textNode.nodeValue = textNode.nodeValue.slice(0,offset) +
                             characters +
                             textNode.nodeValue.slice(offset);
    }

    DOM.deleteCharacters = function(textNode,startOffset,endOffset)
    {
        if (textNode.nodeType != Node.TEXT_NODE)
            throw new Error("DOM.deleteCharacters called on non-text node "+nodeString(textNode));
        if (endOffset == null)
            endOffset = textNode.nodeValue.length;
        if (endOffset < startOffset)
            throw new Error("DOM.deleteCharacters called with invalid start/end offset");
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

    DOM.setNodeValue = function(textNode,value)
    {
        if (textNode.nodeType != Node.TEXT_NODE)
            throw new Error("DOM.setNodeValue called on non-text node");
        trackedPositionsForNode(textNode).forEach(function (position) {
            position.offset = 0;
        });
        characterDataModified(textNode,textNode.nodeValue);
        textNode.nodeValue = value;
    }

    DOM.lowerName = function(node)
    {
        return node.nodeName.toLowerCase();
    }

    DOM.upperName = function(node)
    {
        if (node.nodeType == Node.ELEMENT_NODE)
            return node.nodeName.toUpperCase();
        else
            return node.nodeName;
    }

    DOM.documentHead = function(document)
    {
        var html = document.documentElement;
        for (var child = html.firstChild; child != null; child = child.nextSibling) {
            if (DOM.upperName(child) == "HEAD")
                return child;
        }
        throw new Error("Document contains no HEAD element");
    }

    DOM.ensureUniqueIds = function(root)
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

    window.DOM = DOM;

})();
