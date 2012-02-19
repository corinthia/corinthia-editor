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
            },"Remove "+newChild.nodeName+" from parent "+parent.nodeName);
        }

        parent.insertBefore(newChild,refChild);
    }

    function appendChildInternal(parent,newChild)
    {
        insertBeforeInternal(parent,newChild,null);
    }

    function deleteNodeInternal(node)
    {
        if (node._nodeId == null)
            throw new Error("deleteNodeInternal: node "+node.nodeName+" has no _nodeId property");

        var parent = node.parentNode;
        var nextSibling = node.nextSibling;
        var nextName = (nextSibling == null) ? null : nextSibling.nodeName;
        var data = nodeData[node._nodeId];
        if (window.UndoManager != null) {
            UndoManager.addAction(function() {
                insertBeforeInternal(parent,node,nextSibling);
                nodeData[node._nodeId] = data;
            },"Insert "+node.nodeName+" into parent "+parent.nodeName+" before "+nextName);
        }

        node.parentNode.removeChild(node);
        delete nodeData[node._nodeId];
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
            },"Remove "+attrName+" attribute from "+element.nodeName);
        }
        else if (event.attrChange == MutationEvent.REMOVAL) {
            UndoManager.addAction(function() {
                element.setAttribute(attrName,prevValue);
            },"Add "+attrName+" attribute to "+element.nodeName+" with value \""+prevValue+"\"");
        }
        else if (event.attrChange == MutationEvent.MODIFICATION) {
            UndoManager.addAction(function() {
                element.setAttribute(attrName,prevValue);
            },"Change "+attrName+" attribute of "+element.nodeName+" to value \""+prevValue+"\"");
        }
    }

    function characterDataModified(event)
    {
        var node = event.target;
        var prevValue = event.prevValue;
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
        node.addEventListener("DOMCharacterDataModified",characterDataModified);
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
        return appendChildInternal(node,child);
    }

    DOM.insertBefore = function(node,child,before)
    {
        return insertBeforeInternal(node,child,before);
    }

    DOM.deleteNode = function(node)
    {
        deleteNodeInternal(node);
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
        Position.ignoreEventsWhileExecuting(function() {
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
        });
    }

    DOM.removeNodeButKeepChildren = function(node)
    {
        Position.ignoreEventsWhileExecuting(function() {
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
            deleteNodeInternal(node);

            while (node.firstChild != null) {
                var child = node.firstChild;
                insertBeforeInternal(parent,child,nextSibling);
                fireNodeWasInserted(child);
            }
        });
    }

    DOM.replaceElement = function(oldElement,newName)
    {
        var newElement = DOM.createElement(document,newName);
        Position.ignoreEventsWhileExecuting(function() {
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
            deleteNodeInternal(oldElement);
            while (oldElement.firstChild != null)
                appendChildInternal(newElement,oldElement.firstChild);
            insertBeforeInternal(parent,newElement,nextSibling);

            fireNodeWasInserted(newElement);

        });
        return newElement;
    }

    DOM.wrapNode = function(node,elementName)
    {
        var wrapper = DOM.createElement(document,elementName);
        Position.ignoreEventsWhileExecuting(function() {
            fireNodeWillBeRemoved(node);

            insertBeforeInternal(node.parentNode,wrapper,node);
            appendChildInternal(wrapper,node);

            fireNodeWasInserted(wrapper);
        });
        return wrapper;
    }

    function getDataForNode(node,create)
    {
        if (node._nodeId == null)
            throw new Error("getDataForNode: node "+node.nodeName+" has no _nodeId property");
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
                            "("+position.node.nodeName+")");
        for (var i = 0; i < data.trackedPositions.length; i++) {
            if (data.trackedPositions[i] == position) {
                data.trackedPositions.splice(i,1);
                return;
            }
        }
        throw new Error("DOM.removeTrackedPosition: position is not registered ("+
                        data.trackedPositions.length+" others)");
    }

    window.DOM = DOM;

})();
