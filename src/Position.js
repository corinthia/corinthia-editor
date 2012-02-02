// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

function Location(parent,child)
{
    this.parent = parent;
    this.child = child;
}

Location.prototype.toString = function()
{
    return "("+nodeString(this.parent)+","+nodeString(this.child)+")";

    function nodeString(node) {
        if (node == null)
            return "null";
        else if (node.nodeType == Node.TEXT_NODE)
            return "\""+node.nodeValue+"\"";
        else if ((node.nodeType == Node.ELEMENT_NODE) && (node.hasAttribute("id")))
            return "#"+node.getAttribute("id");
        else
            return node.nodeName;
    }
}

function Position(node,offset)
{
    this.node = node;
    this.offset = offset;
    this.origOffset = offset;
    this.tracking = 0;
    this.insertionListener = null;
    this.removalListener = null;
    this.moving = false;
}

Position.totalPositionsTracking = 0; // for debugging leaks
Position.nodeBeingMoved = null;

Position.trackWhileExecuting = function(positions,fun)
{
    for (var i = 0; i < positions.length; i++)
        positions[i].startTracking();
    fun();
    for (var i = 0; i < positions.length; i++)
        positions[i].stopTracking();
}

Position.prototype.nodeInserted = function(event)
{
    if ((event.target == this.node) && this.moving) {
        this.setNodeAndOffset(event.relatedNode,getOffsetOfNodeInParent(event.target));
    }
    else if (event.relatedNode == this.node) {
        var offset = getOffsetOfNodeInParent(event.target);
        if (offset < this.offset)
            this.offset++;
    }
}

Position.prototype.nodeWillBeRemoved = function(event)
{
    if (event.relatedNode == this.node) {
        var offset = getOffsetOfNodeInParent(event.target);
        if ((Position.nodeBeingMoved == event.target) && (offset == this.offset)) {
            this.setNodeAndOffset(event.target,0);
            this.moving = true;
        }
        else {
            if (offset < this.offset)
                this.offset--;
        }
    }
    else if ((event.target == this.node) && (Position.nodeBeingMoved != event.target)) {
        var offset = getOffsetOfNodeInParent(event.target);
        this.setNodeAndOffset(this.node.parentNode,offset);
    }
}

Position.prototype.actuallyStartTracking = function()
{
    var position = this;
    this.insertionListener = function (event) { position.nodeInserted(event); };
    this.removalListener = function (event) { position.nodeWillBeRemoved(event); };
    this.node.addEventListener("DOMNodeInserted",this.insertionListener,false);
    this.node.addEventListener("DOMNodeRemoved",this.removalListener,false);
    Position.totalPositionsTracking++;
}

Position.prototype.actuallyStopTracking = function()
{
    this.node.removeEventListener("DOMNodeInserted",this.insertionListener,false);
    this.node.removeEventListener("DOMNodeRemoved",this.removalListener,false);
    this.insertionListener = null;
    this.removalListener = null;
    Position.totalPositionsTracking--;
}

Position.prototype.startTracking = function()
{
    if (this.tracking == 0) {
        // FIXME: allow text nodes to be tracked (for responding to when they are removed)
        if (this.node.nodeType == Node.ELEMENT_NODE) {
            this.actuallyStartTracking();
        }
    }
    this.tracking++;
}

Position.prototype.stopTracking = function()
{
    this.tracking--;
    if (this.tracking == 0) {
        // FIXME: allow text nodes to be tracked (for responding to when they are removed)
        if (this.node.nodeType == Node.ELEMENT_NODE) {
            this.actuallyStopTracking();
        }
    }
}

Position.prototype.setNodeAndOffset = function(node,offset)
{
    if (this.tracking > 0)
        this.actuallyStopTracking();

    this.node = node;
    this.offset = offset;

    if (this.tracking > 0)
        this.actuallyStartTracking();
}

Position.prototype.moveToStartOfWord = function()
{
    var text = this.node.nodeValue;
    this.offset = this.origOffset;
    while ((this.offset > 0) && isWordChar(text.charAt(this.offset-1)))
        this.offset--;
}

Position.prototype.moveToEndOfWord = function()
{
    var text = this.node.nodeValue;
    var length = text.length;
    this.offset = this.origOffset;
    while ((this.offset < length) && isWordChar(text.charAt(this.offset)))
        this.offset++;
}

Position.prototype.moveForwardIfAtEnd = function()
{
    var node = this.node;
    var offset = this.offset;
    var changed = false;
    while (node != document.body) {
        if (((node.nodeType == Node.TEXT_NODE) && (offset == node.nodeValue.length)) ||
            ((node.nodeType == Node.ELEMENT_NODE) && (offset == node.childNodes.length))) {
            offset = getOffsetOfNodeInParent(node)+1;
            node = node.parentNode;
            changed = true;
        }
        else {
            break;
        }
    }
    if (changed)
        this.setNodeAndOffset(node,offset);
    return changed;
}

Position.prototype.moveBackwardIfAtStart = function()
{
    var node = this.node;
    var offset = this.offset;
    var changed = false;
    while ((node != document.body) && (offset == 0)) {
        offset = getOffsetOfNodeInParent(node);
        node = node.parentNode;
        changed = true;
    }
    if (changed)
        this.setNodeAndOffset(node,offset);
    return changed;
}

Position.prototype.toLocation = function()
{
    if ((this.node.nodeType == Node.ELEMENT_NODE) && (this.node.firstChild != null)) {
        if (this.offset >= this.node.childNodes.length)
            return new Location(this.node,null);
        else
            return new Location(this.node,this.node.childNodes[this.offset]);
    }
    else {
        return new Location(this.node.parentNode,this.node);
    }
}

Position.prototype.toDefinitePosition = function()
{
    if (this.node.nodeType == Node.ELEMENT_NODE) {
        if (this.offset < this.node.childNodes.length)
            return new Position(this.node.childNodes[this.offset],0);
        var nextNode = nextNodeAfter(this.node);
        if (nextNode != null)
            return new Position(nextNode,0);
        else
            return null;
    }
    else {
        return new Position(this.node,this.offset);
    }
}

Position.prototype.toString = function()
{
    return "("+nodeString(this.node)+","+this.offset+")";
}
