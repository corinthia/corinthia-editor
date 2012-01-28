// Copyright (c) 2011-2012 UX Productivity. All rights reserved.

function Range(startNode,startOffset,endNode,endOffset)
{
    this.start = new Position(startNode,startOffset);
    this.end = new Position(endNode,endOffset);
}

Range.prototype.copy = function()
{
    return new Range(this.start.node,this.start.offset,
                     this.end.node,this.end.offset);
}

Range.prototype.isEmpty = function()
{
    return ((this.start.node == this.end.node) &&
            (this.start.offset == this.end.offset));
}

Range.prototype.toString = function()
{
    return this.start.toString() + " - " + this.end.toString();
}

Range.prototype.selectWholeWords = function()
{
    if ((this.start.node.nodeType == Node.TEXT_NODE) &&
        (this.end.node.nodeType == Node.TEXT_NODE)) {
        if (this.isForwards()) {
            // this.start comes before this.end
            this.start.moveToStartOfWord();
            this.end.moveToEndOfWord();
        }
        else {
            // this.end comes before this.end
            this.start.moveToEndOfWord();
            this.end.moveToStartOfWord();
        }
    }
}

Range.prototype.omitEmptyTextSelection = function()
{
    this.start.moveForwardIfAtEnd();
    this.end.moveBackwardIfAtStart();
}

Range.prototype.isForwards = function()
{
    if (this.start.node == this.end.node)
        return (this.start.offset <= this.end.offset);
    else {
        var cmp = this.start.node.compareDocumentPosition(this.end.node);
        return (cmp & (Node.DOCUMENT_POSITION_FOLLOWING | Node.DOCUMENT_POSITION_CONTAINED_BY));
    }
}

Range.prototype.getParagraphNodes = function()
{
    var result = new Array();
    var node = this.start.node;
    while (!isParagraphNode(node))
        node = node.parentNode;
    while (true) {
        if (isParagraphNode(node))
            result.push(node);
        if (node == this.end.node)
            break;
        node = nextNode(node);
    }
    return result;
}

Range.prototype.getInlineNodes = function()
{
    var result = new Array();
    var node = this.start.node;
    while (true) {
        if (isInlineNode(node))
            result.push(node);
        if (node == this.end.node)
            break;
        node = nextNode(node);
    }
    return result;
}

Range.prototype.getAllNodes = function()
{
    var result = new Array();
    var node = this.start.node;
    while (true) {
        result.push(node);
        if (node == this.end.node)
            break;
        node = nextNode(node);
    }
    return result;
}

Range.prototype.ensureRangeValidHierarchy = function()
{
    var nodes = this.getAllNodes();
    
    var depths = new Array();
    for (var i = 0; i < nodes.length; i++) {
        var depth = getNodeDepth(nodes[i]);
        if (depths[depth] == null) {
            depths[depth] = new Array();
        }
        depths[depth].push(nodes[i]);
    }
    
    for (var depth = 0; depth < depths.length; depth++) {
        var firstDepth = true;
        if (depths[depth] != null) {
            for (var i = 0; i < depths[depth].length; i++) {
                var node = depths[depth][i];
                if (!isInlineNode(node.parentNode) && isWhitespaceTextNode(node)) {
                    node.parentNode.removeChild(node);
                }
                else {
                    ensureValidHierarchy(node,firstDepth);
                }
            }
            firstDepth = false;
        }
    }
}

// FIXME: temp
function nodeString(node) {
    if (node == null) {
        return "null";
    }
    else if (node.nodeType == Node.TEXT_NODE) {
        return "\""+node.nodeValue+"\"";
    }
    else if ((node.nodeType == Node.ELEMENT_NODE) && (node.hasAttribute("id"))) {
        return "#"+node.getAttribute("id");
    }
    else {
        return node.nodeName;
    }
}



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
}

function getAncestorLocationsWithCommonParent(startLocation,endLocation)
{
    for (var start = startLocation; start != null; start = start.parentLocation()) {
        for (var end = endLocation; end != null; end = end.parentLocation()) {
            if (start.parent == end.parent) {
                return { startAncestor: start, endAncestor: end };
            }
        }
    }
    return null;
}

function containerOffsetToLocation(container,offset)
{
    if ((container.nodeType == Node.ELEMENT_NODE) && (container.firstChild != null)) {
        if (offset >= container.childNodes.length) {
            return new Location(container,null);
        }
        else {
            return new Location(container,container.childNodes[offset]);
        }
    }
    else {
        return new Location(container.parentNode,container);
    }
}


Range.prototype.getOutermostSelectedNodes = function()
{
/*
    if (!this.isForwards()) {
        debug("get: not forwards");
        return new Array();
    }
*/

    var result = new Array();
    var startContainer = this.start.node;
    var startOffset = this.start.offset;
    var endContainer = this.end.node;
    var endOffset = this.end.offset;

    debug("get: this = "+this);

    // Note: start and end are *points* - they are always *in between* nodes or characters, never
    // *at* a node or character.
    // Everything after the end point is excluded from the selection
    // Everything after the start point, but before the end point, is included in the selection

    // The reason we need the Location class, which records a (parend,child) pair, is so we have a
    // way to represent a point that comes after all child nodes - in this case, the child is null.
    // The parent, however, is always non-null.

    var startLocation = containerOffsetToLocation(startContainer,startOffset);
    var endLocation = containerOffsetToLocation(endContainer,endOffset);

    debug("startLocation = "+startLocation);
    debug("endLocation = "+endLocation);

    // If the end node is contained within the start node, change the start node to the first
    // node in document order that is not an ancestor of the end node
/* // FIXME
    while (isAncestor(startNode,endNode) &&
           (startNode != endNode) &&
           (startNode.firstChild != null)) {
        startNode = startNode.firstChild;
    }

    if (startNode == endNode) {
    }
*/

    // FIXME: code below assumes start <= end

    var ancestors = getAncestorLocationsWithCommonParent(startLocation,endLocation);
    if (ancestors == null) {
        debug("Could not find common parent");
        return result;
    }
    var startAncestor = ancestors.startAncestor;
    var endAncestor = ancestors.endAncestor;
    var commonParent = startAncestor.parent;
    debug("startAncestor = "+startAncestor);
    debug("endAncestor = "+endAncestor);


    // Add start nodes
    var top = startLocation;
    do {
        debug("Phase 1: Adding "+top);
        addNode(result,top.child);
        while ((top.nextSiblingLocation() == null) && (top.parent != commonParent))
            top = top.parentLocation();
        if (top.parent != commonParent)
            top = top.nextSiblingLocation();
    } while (top.parent != commonParent);

    // Add middle nodes
    var c = startAncestor.child;
    if (c != null)
        c = c.nextSibling;
    for (; c != endAncestor.child; c = c.nextSibling) {
        debug("Phase 2: Adding "+(new Location(startAncestor.parent,c)));
        addNode(result,c);
    }

    // Add end nodes
    var endNodes = new Array();
    var bottom = endLocation;
    var firstTime = true;
    do {
        if ((bottom.child != null) && !firstTime)
            addNodeReverse(endNodes,bottom.child);
        firstTime = false;
        while ((bottom.previousSiblingLocation() == null) && (bottom.parent != commonParent))
            bottom = bottom.parentLocation();
        if (bottom.parent != commonParent)
            bottom = bottom.previousSiblingLocation();
    } while (bottom.parent != commonParent);
    for (var i = endNodes.length-1; i >= 0; i--)
        result.push(endNodes[i]);

    return result;

    function isAncestor(ancestor,descendant)
    {
        while ((descendant != null) && (descendant != ancestor))
            descendant = descendant.parentNode;
        return (descendant == ancestor);
    }

    function addAllDescendants(result,node)
    {
        if (node.nodeType == Node.TEXT_NODE) {
            result.push(node);
        }
        else {
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                addAllDescendants(result,child);
        }
    }

    function addAllDescendantsReverse(result,node)
    {
        if (node.nodeType == Node.TEXT_NODE) {
            result.push(node);
        }
        else {
            for (var child = node.lastChild; child != null; child = child.previousSibling)
                addAllDescendants(result,child);
        }
    }

    // FIXME: add the inline children in a separate pass, so we can keep this method clean with
    // just a single "get outer nodes" operation
    function addNode(result,node)
    {
        if (isInlineNode(node))
            addAllDescendants(result,node);
        else
            result.push(node);
    }

    function addNodeReverse(result,node)
    {
        if (isInlineNode(node))
            addAllDescendantsReverse(result,node);
        else
            result.push(node);
    }
}

Range.prototype.getClientRects = function()
{
    var nodes = this.getOutermostSelectedNodes();

    // WebKit in iOS 5.0 has a bug where if the selection spans multiple paragraphs, the complete
    // rect for paragraphs other than the first is returned, instead of just the portions of it
    // that are actually in the range. To get around this problem, we go through each text node
    // individually and collect all the rects.
    var result = new Array();
    var domRange = document.createRange();
    for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
        var node = nodes[nodeIndex];
        if (node.nodeType == Node.TEXT_NODE) {
            var startOffset = (node == this.start.node) ? this.start.offset : 0;
            var endOffset = (node == this.end.node) ? this.end.offset : node.nodeValue.length;
            domRange.setStart(node,startOffset);
            domRange.setEnd(node,endOffset);
            var rects = domRange.getClientRects();
            for (var rectIndex = 0; rectIndex < rects.length; rectIndex++)
                result.push(rects[rectIndex]);
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            result.push(node.getBoundingClientRect());
        }
    }
    return result;
}
