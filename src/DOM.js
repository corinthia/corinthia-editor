// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function() {

    // Assign a unique prefix to the ids, to ensure namespaces don't clash when multiple instances
    // of this are used in different browser windows
    var prefix = Math.random()+":";
    var nextNodeId = 0;

    function assignNodeId(node)
    {
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

    // public
    DOM.assignNodeIds = function(node)
    {
        node._nodeId = prefix+nextNodeId++;
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            DOM.assignNodeIds(child);
    }

    // public
    DOM.addUndoListeners = function(node)
    {
        node.addEventListener("DOMNodeInserted",nodeInserted);
        node.addEventListener("DOMNodeRemoved",nodeRemoved);
        node.addEventListener("DOMAttrModified",attrModified);
        node.addEventListener("DOMCharacterDataModified",characterDataModified);
    }

    // public
    DOM.createElement = function(document,elementName)
    {
        return assignNodeId(document.createElement(elementName));
    }

    // public
    DOM.createElementNS = function(document,namespaceURI,qualifiedName)
    {
        return assignNodeId(document.createElementNS(namespaceURI,qualifiedName));
    }

    // public
    DOM.createTextNode = function(document,data)
    {
        return assignNodeId(document.createTextNode(data));
    }

    // public
    DOM.createComment = function(document,data)
    {
        return assignNodeId(document.createComment(data));
    }

    // public
    DOM.cloneNode = function(original,deep)
    {
        var clone = original.cloneNode(deep);
        DOM.assignNodeIds(clone);
        return clone;
    }

    // public
    DOM.appendChild = function(node,child)
    {
        return node.appendChild(child);
    }

    // public
    DOM.insertBefore = function(node,child,before)
    {
        return node.insertBefore(child,before);
    }

    // public
    DOM.removeChild = function(node,child)
    {
        return node.removeChild(child);
    }

    // public
    DOM.deleteNode = function(node)
    {
        DOM.removeChild(node.parentNode,node);
    }

    // public
    DOM.deleteAllChildren = function(parent)
    {
        while (parent.firstChild != null)
            DOM.deleteNode(parent.firstChild);
    }

    window.DOM = DOM;

})();
