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
            throw new Error(nodeString(node)+" already has id");
        node._nodeId = prefix+nextNodeId++;
        return node;
    }

    function nodeInserted(event)
    {
        var node = event.target;
        var parent = event.relatedNode;
        UndoManager.addAction(function() {
            parent.removeChild(node);
        },"Remove "+node.nodeName+" from parent "+parent.nodeName);
    }

    function nodeRemoved(event)
    {
        var node = event.target;
        var parent = event.relatedNode;
        var nextSibling = node.nextSibling;
        var nextName = (nextSibling == null) ? null : nextSibling.nodeName;
        UndoManager.addAction(function() {
            parent.insertBefore(node,nextSibling);
        },"Insert "+node.nodeName+" into parent "+parent.nodeName+" before "+nextName);
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

    var DOM = new Object();

    // public methods
    DOM.assignNodeIds = function(node)
    {
        if (node._nodeId != null)
            throw new Error(nodeString(node)+" already has id");
        node._nodeId = prefix+nextNodeId++;
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            DOM.assignNodeIds(child);
    }

    DOM.addUndoListeners = function(node)
    {
        node.addEventListener("DOMNodeInserted",nodeInserted);
        node.addEventListener("DOMNodeRemoved",nodeRemoved);
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
        return node.appendChild(child);
    }

    DOM.insertBefore = function(node,child,before)
    {
        return node.insertBefore(child,before);
    }

    DOM.removeChild = function(node,child)
    {
        return node.removeChild(child);
    }

    DOM.deleteNode = function(node)
    {
        if (node._nodeId == null)
            throw new Error("NodeSet.contains: node "+node.nodeName+" has no _nodeId property");
        DOM.removeChild(node.parentNode,node);
        delete nodeData[node._nodeId];
    }

    // High-level methods

    DOM.deleteAllChildren = function(parent)
    {
        while (parent.firstChild != null)
            DOM.deleteNode(parent.firstChild);
    }

    DOM.shallowCopyElement = function(element)
    {
        var copy = DOM.createElement(document,element.nodeName);
        for (var i = 0; i < element.attributes.length; i++) {
            if (element.attributes[i].nodeName != "id")
                copy.setAttribute(element.attributes[i].nodeName,element.attributes[i].nodeValue);
        }
        return copy;
    }

    DOM.moveNode = function(node,parentNode,nextSibling)
    {
        Position.nodeBeingMoved = node;
        DOM.insertBefore(parentNode,node,nextSibling);
        Position.nodeBeingMoved = null;
    }

    DOM.removeNodeButKeepChildren = function(node)
    {
        while (node.firstChild != null)
            DOM.moveNode(node.firstChild,node.parentNode,node);
        DOM.removeChild(node.parentNode,node);
    }

    DOM.replaceElement = function(oldElement,newName)
    {
        var newElement = DOM.createElement(document,newName);
        for (var i = 0; i < oldElement.attributes.length; i++) {
            var name = oldElement.attributes[i].nodeName;
            var value = oldElement.getAttribute(name);
            newElement.setAttribute(name,value);
        }

        DOM.insertBefore(oldElement.parentNode,newElement,oldElement);
        while (oldElement.firstChild != null)
            DOM.moveNode(oldElement.firstChild,newElement,null);
        DOM.moveNode(oldElement,newElement,null);
        DOM.removeChild(oldElement.parentNode,oldElement);

        return newElement;
    }

    DOM.wrapNode = function(node,elementName)
    {
        var wrapper = DOM.createElement(document,elementName);
        DOM.insertBefore(node.parentNode,wrapper,node);
        DOM.moveNode(node,wrapper,null);
        return wrapper;
    }

    window.DOM = DOM;

})();
