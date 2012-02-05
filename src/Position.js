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
Position.ignoreEvents = 0;
Position.trackedPositions = new Array();

Position.addTrackedPosition = function(pos)
{
    Position.trackedPositions.push(pos);
}

Position.removeTrackedPosition = function(pos)
{
    for (var i = 0; i < Position.trackedPositions.length; i++) {
        if (Position.trackedPositions[i] == pos) {
            Position.trackedPositions.splice(i,1);
            return;
        }
    }
    throw new Error("removeTrackedPosition: position not found");
}

Position.trackWhileExecuting = function(positions,fun)
{
    for (var i = 0; i < positions.length; i++)
        positions[i].startTracking();
    try {
        return fun();
    }
    finally {
        for (var i = 0; i < positions.length; i++)
            positions[i].stopTracking();
    }
}

Position.ignoreEventsWhileExecuting = function(fun)
{
    Position.ignoreEvents++;
    try {
        return fun();
    }
    finally {
        Position.ignoreEvents--;
    }
}

Position.prototype.nodeInserted = function(event)
{
    if (Position.ignoreEvents > 0)
        return;

    if ((event.target == this.node) && this.moving)
        this.setNodeAndOffset(event.relatedNode,getOffsetOfNodeInParent(event.target));
        this.moving = false;
    }
    else if (event.relatedNode == this.node) {
        var offset = getOffsetOfNodeInParent(event.target);
        if (offset < this.offset)
            this.offset++;
    }
}

Position.prototype.nodeWillBeRemoved = function(event)
{
    if (Position.ignoreEvents > 0)
        return;

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

Position.prototype.characterDataModified = function(event)
{
    if (Position.ignoreEvents > 0)
        return;

    if (event.target == this.node) {
        var oldOffset = this.offset;
        var prevValue = event.prevValue;
        var newValue = event.newValue;

        var commonStart = 0;
        var commonEnd = 0;

        while ((commonStart < prevValue.length) && (commonStart < newValue.length) &&
               (prevValue.charCodeAt(commonStart) == newValue.charCodeAt(commonStart)))
            commonStart++;

        while ((commonEnd < prevValue.length) &&
               (commonEnd < newValue.length) &&
               (prevValue.charCodeAt(prevValue.length - commonEnd - 1) ==
                newValue.charCodeAt(newValue.length - commonEnd - 1)))
            commonEnd++;

        var realCommonStart = commonStart;
        var realCommonEnd = commonEnd;

        if (realCommonStart > newValue.length - commonEnd)
            realCommonStart = newValue.length - commonEnd;
        if (realCommonStart > prevValue.length - commonEnd)
            realCommonStart = prevValue.length - commonEnd;

        if (realCommonEnd > newValue.length - commonStart)
            realCommonEnd = newValue.length - commonStart;
        if (realCommonEnd > prevValue.length - commonStart)
            realCommonEnd = prevValue.length - commonStart;

        commonStart = realCommonStart;
        commendEnd = realCommonEnd;

        var prevDifferent = prevValue.length - commonStart - commonEnd;
        var newDifferent = newValue.length - commonStart - commonEnd;

        if (newValue.length < prevValue.length) {
            if ((this.offset > commonStart + newDifferent) &&
                (this.offset < commonStart + prevDifferent)) {
                this.offset = commonStart + newDifferent;
            }
            else if (this.offset >= commonStart + prevDifferent) {
                this.offset -= (prevDifferent - newDifferent);
            }
        }
        else if (newValue.length > prevValue.length) {
            if ((newDifferent > 0) && (prevDifferent > 0) &&
                (this.offset >= prevValue.length - commonEnd))
                this.offset = newValue.length - (prevValue.length - this.offset);
            else if (this.offset > commonStart + prevDifferent)
                this.offset += (newDifferent - prevDifferent);
        }
    }
}

Position.prototype.actuallyStartTracking = function()
{
    var position = this;
    this.insertionListener = function (event) { position.nodeInserted(event); };
    this.removalListener = function (event) { position.nodeWillBeRemoved(event); };
    this.characterDataListener = function(event) { position.characterDataModified(event); }
    this.node.addEventListener("DOMNodeInserted",this.insertionListener,false);
    this.node.addEventListener("DOMNodeRemoved",this.removalListener,false);
    if (this.node.nodeType == Node.TEXT_NODE)
        this.node.addEventListener("DOMCharacterDataModified",this.characterDataListener,false);
    Position.totalPositionsTracking++;
}

Position.prototype.actuallyStopTracking = function()
{
    this.node.removeEventListener("DOMNodeInserted",this.insertionListener,false);
    this.node.removeEventListener("DOMNodeRemoved",this.removalListener,false);
    if (this.node.nodeType == Node.TEXT_NODE)
        this.node.removeEventListener("DOMCharacterDataModified",this.characterDataListener,false);
    this.insertionListener = null;
    this.removalListener = null;
    this.characterDataListener = null;
    Position.totalPositionsTracking--;
}

Position.prototype.startTracking = function()
{
    if (this.tracking == 0) {
        Position.addTrackedPosition(this);
        this.actuallyStartTracking();
    }
    this.tracking++;
}

Position.prototype.stopTracking = function()
{
    this.tracking--;
    if (this.tracking == 0) {
        this.actuallyStopTracking();
        Position.removeTrackedPosition(this);
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
    if (this.node.nodeType == Node.TEXT_NODE) {
        var extra = "";
        if (this.offset > this.node.nodeValue.length) {
            for (var i = this.node.nodeValue.length; i < this.offset; i++)
                extra += "!";
        }
        return JSON.stringify(this.node.nodeValue.slice(0,this.offset)+extra+"|"+
                              this.node.nodeValue.slice(this.offset));
    }
    else {
        return "("+nodeString(this.node)+","+this.offset+")";
    }
}
