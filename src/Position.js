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
}

Position.totalPositionsTracking = 0; // for debugging leaks

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
    if ((event.target == this.node) && event.target.hasAttribute("moving")) {
        this.actuallyStopTracking();
        this.node = event.relatedNode;
        this.offset = getOffsetOfNodeInParent(event.target);
        this.actuallyStartTracking();
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
        if (event.target.hasAttribute("moving") && (offset == this.offset)) {
            this.actuallyStopTracking();
            this.node = event.target;
            this.offset = 0;
            this.actuallyStartTracking();
        }
        else {
            if (offset < this.offset)
                this.offset--;
        }
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
        if (this.node.nodeType == Node.ELEMENT_NODE) {
            this.actuallyStopTracking();
        }
    }
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
    if ((this.node.nodeType == Node.TEXT_NODE) &&
        (this.offset == this.node.nodeValue.length)) {
        var next = nextTextNode(this.node);
        if (next != null) {
            this.node = next;
            this.offset = 0;
            // debug("Moved start to "+this.toString()+"\n");
        }
    }
}

Position.prototype.moveBackwardIfAtStart = function()
{
    if ((this.node.nodeType == Node.TEXT_NODE) &&
        (this.offset == 0)) {
        var prev = prevTextNode(this.node);
        if (prev != null) {
            this.node = prev;
            this.offset = this.node.nodeValue.length;
            // debug("Moved end to "+this.toString()+"\n");
        }
    }
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
    if ((this.node.nodeType == Node.ELEMENT_NODE) && (this.node.firstChild != null)) {
        if (this.offset < this.node.childNodes.count)
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
