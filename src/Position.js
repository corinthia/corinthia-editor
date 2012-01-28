// Copyright (c) 2011-2012 UX Productivity. All rights reserved.

function Location(parent,child)
{
    this.parent = parent;
    this.child = child;
}

Location.prototype.parentLocation = function()
{
    if (this.parent.parentNode == null)
        return null;
    else
        return new Location(this.parent.parentNode,this.parent);
}

Location.prototype.nextSiblingLocation = function()
{
    if (this.child.nextSibling == null)
        return null;
    else
        return new Location(this.parent,this.child.nextSibling);
}

Location.prototype.previousSiblingLocation = function()
{
    if (this.child == null) { // point is at end
        if (this.parent.lastChild != null)
            return new Location(this.parent,this.parent.lastChild);
        else // FIXME: would this ever be the case?
            return null;
    }
    if (this.child.previousSibling == null)
        return null;
    else
        return new Location(this.parent,this.child.previousSibling);
}

Location.prototype.equals = function(other)
{
    return ((this.parent == other.parent) && (this.child == other.child));
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

Location.locationsEqual = function (a,b)
{
    if ((a == null) && (b == null))
        return true;
    else if ((a != null) && (b != null) && a.equals(b))
        return true;
    else
        return false;
}

function Position(node,offset)
{
    this.node = node;
    this.offset = offset;
    this.origOffset = offset;
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

Position.prototype.toString = function()
{
    if (this.node.nodeType == Node.TEXT_NODE) {
        return "(\""+this.node.nodeValue+"\","+this.offset+")";
    }
    else if ((this.node.nodeType == Node.ELEMENT_NODE) && (this.node.hasAttribute("id"))) {
        return "(#"+this.node.getAttribute("id")+","+this.offset+")";
    }
    else {
        return "("+this.node.nodeName+","+this.offset+")";
    }
}
