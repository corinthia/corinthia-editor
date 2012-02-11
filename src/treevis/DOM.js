// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function() {

    var original = {
        createElement: Document.prototype.createElement,
        createElementNS: Document.prototype.createElementNS,
        createTextNode: Document.prototype.createTextNode,
        createComment: Document.prototype.createComment,
        cloneNode: Node.prototype.cloneNode
    };

    // Assign a unique prefix to the ids, to ensure namespaces don't clash when multiple instances
    // of this are used in different browser windows
    var prefix = Math.random()+":";
    var nextNodeId = 0;

    Document.prototype.createElement = function(elementName)
    {
        var node = original.createElement.call(this,elementName);
        node._nodeId = prefix+nextNodeId++;
        return node;
    }

    Document.prototype.createElementNS = function(namespaceURI,qualifiedName)
    {
        var node = original.createElementNS.call(this,namespaceURI,qualifiedName);
        node._nodeId = prefix+nextNodeId++;
        return node;
    }

    Document.prototype.createTextNode = function(data)
    {
        var node = original.createTextNode.call(this,data);
        node._nodeId = prefix+nextNodeId++;
        return node;
    }

    Document.prototype.createComment = function(data)
    {
        var node = original.createComment.call(this,data);
        node._nodeId = prefix+nextNodeId++;
        return node;
    }

    Node.prototype.cloneNode = function(deep)
    {
        var clone = original.cloneNode.call(this,deep);
        assignNodeIds(clone);
        return clone;
    }

    assignNodeIds = function(node)
    {
        node._nodeId = prefix+nextNodeId++;
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            assignNodeIds(child);
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

    function addUndoListeners(node)
    {
        node.addEventListener("DOMNodeInserted",nodeInserted);
        node.addEventListener("DOMNodeRemoved",nodeRemoved);
        node.addEventListener("DOMAttrModified",attrModified);
        node.addEventListener("DOMCharacterDataModified",characterDataModified);
    }

    window.DOM = new Object();
    window.DOM.assignNodeIds = assignNodeIds;
    window.DOM.addUndoListeners = addUndoListeners;
})();
