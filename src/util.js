// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

function arrayContains(array,value)
{
    for (var i = 0; i < array.length; i++) {
        if (array[i] == value)
            return true;
    }
    return false;
}

// Note: you can use slice() to copy a real javascript array, but this function can be used to copy
// DOM NodeLists (e.g. as returned by document.getElementsByTagName) as well, since they don't
// support the slice method
function arrayCopy(array)
{
    if (array == null)
        return null;
    var copy = new Array();
    for (var i = 0; i < array.length; i++)
        copy.push(array[i]);
    return copy;
}

function quoteString(str)
{
    if (str == null)
        return null;

    if (str.indexOf('"') < 0)
        return str;

    var quoted = "";
    for (var i = 0; i < str.length; i++) {
        if (str.charAt(i) == '"')
            quoted += "\\\"";
        else
            quoted += str.charAt(i);
    }
    return quoted;
}

function nodeString(node)
{
    if (node == null)
        return "null";
    var id = "";
    if (window.debugIds)
        id = node._nodeId.replace(/^.*:/,"")+":";
    if (node.nodeType == Node.TEXT_NODE)
        return id+JSON.stringify(node.nodeValue);
    else if ((node.nodeType == Node.ELEMENT_NODE) && (node.hasAttribute("id")))
        return id+DOM_upperName(node)+"#"+node.getAttribute("id");
    else if (node.nodeType == Node.ELEMENT_NODE)
        return id+DOM_upperName(node);
    else
        return id+node.toString();
}

function rectString(rect)
{
    if (rect == null)
        return null;
    else
        return "("+rect.left+","+rect.top+") - ("+rect.right+","+rect.bottom+")";
}

function rectIsEmpty(rect)
{
    return ((rect == null) ||
            ((rect.width == 0) && (rect.height == 0)));
}

function clone(object)
{
    var result = new Object();
    for (var name in object)
        result[name] = object[name];
    return result;
}

// This function works around a bug in WebKit where caretRangeFromPoint sometimes returns an
// incorrect node (the last text node in the document). In a previous attempt to fix this bug,
// we first checked if the point was in the elements bounding rect, but this meant that it wasn't
// possible to place the cursor at the nearest node, if the click location was not exactly on a
// node.

// Now we instead check to see if the result of elementFromPoint is the same as the parent node
// of the text node returned by caretRangeFromPoint. If it isn't, then we assume that the latter
// result is incorrect, and return null.

// In the circumstances where this bug was observed, the last text node in the document was being
// returned from caretRangeFromPoint in some cases. In the typical case, this is going to be inside
// a paragraph node, but elementNodeFromPoint was returning the body element. The check we do now
// comparing the results of the two functions fixes this case, but won't work as intended if the
// document's last text node is a direct child of the body (as it may be in some HTML documents
// that users open).

function positionAtPoint(x,y)
{
    // In general, we can use document.caretRangeFromPoint(x,y) to determine the location of the
    // cursor based on screen coordinates. However, this doesn't work if the screen coordinates
    // are outside the bounding box of the document's body. So when this is true, we find either
    // the first or last non-whitespace text node, calculate a y value that is half-way between
    // the top and bottom of its first or last rect (respectively), and then make a call to
    // caretRangeFromPoint with the same x value but this new y value. This results in the cursor
    // being placed on the first or last line when the user taps outside the document bounds.

    var bodyRect = document.body.getBoundingClientRect();
    var boundaryRect = null;
    if (y <= bodyRect.top)
        boundaryRect = findFirstTextRect();
    else if (y >= bodyRect.bottom) 
        boundaryRect = findLastTextRect();

    if (boundaryRect != null) {
        var boundaryY = boundaryRect.top + boundaryRect.height/2;
        var range = document.caretRangeFromPoint(x,boundaryY);
        if (range != null)
            return new Position(range.startContainer,range.startOffset);
    }

    // We get here if the coordinates are inside the document's bounding rect, or if getting the
    // position from the first or last rect failed for some reason.

    var range = document.caretRangeFromPoint(x,y);
    if (range == null)
        return null;

    var pos = new Position(range.startContainer,range.startOffset);

    if (pos.node.nodeType == Node.ELEMENT_NODE) {
        var prev = pos.node.childNodes[pos.offset-1];
        var next = pos.node.childNodes[pos.offset];

        if ((prev != null) && isImageNode(prev) && elementContainsPoint(prev,x,y))
            return new Position(prev,0);

        if ((next != null) && isImageNode(next) && elementContainsPoint(next,x,y))
            return new Position(next,0);
    }

    pos = adjustPositionForFigure(pos);

    return pos;

    function elementContainsPoint(element,x,y)
    {
        var rect = element.getBoundingClientRect();
        return ((x >= rect.left) && (x <= rect.right) &&
                (y >= rect.top) && (y <= rect.bottom));
    }

    function findLastTextRect()
    {
        var node = lastDescendant(document.body);

        while ((node != null) && ((node.nodeType != Node.TEXT_NODE) || isWhitespaceTextNode(node)))
            node = prevNode(node);
        
        if (node != null) {
            var domRange = document.createRange();
            domRange.setStart(node,0);
            domRange.setEnd(node,node.nodeValue.length);
            var rects = domRange.getClientRects();
            if ((rects != null) && (rects.length > 0))
                return rects[rects.length-1];
        }
        return null;
    }

    function findFirstTextRect()
    {
        var node = firstDescendant(document.body);

        while ((node != null) && ((node.nodeType != Node.TEXT_NODE) || isWhitespaceTextNode(node)))
            node = nextNode(node);
        
        if (node != null) {
            var domRange = document.createRange();
            domRange.setStart(node,0);
            domRange.setEnd(node,node.nodeValue.length);
            var rects = domRange.getClientRects();
            if ((rects != null) && (rects.length > 0))
                return rects[0];
        }
        return null;
    }

    function adjustPositionForFigure(position)
    {
        if (position == null)
            return null;
        if (DOM_upperName(position.node) == "FIGURE") {
            var prev = position.node.childNodes[position.offset-1];
            var next = position.node.childNodes[position.offset];
            if ((prev != null) && isImageNode(prev)) {
                position = new Position(position.node.parentNode,
                                        DOM_nodeOffset(position.node)+1);
            }
            else if ((next != null) && isImageNode(next)) {
                position = new Position(position.node.parentNode,
                                        DOM_nodeOffset(position.node));
            }
        }
        return position;
    };
}

function nodeHasContent(node)
{
    if (node.nodeType == Node.TEXT_NODE) {
        return !isWhitespaceString(node.nodeValue);
    }
    else if ((DOM_upperName(node) == "IMG") || (DOM_upperName(node) == "TABLE")) {
        return true;
    }
    else if (isOpaqueNode(node)) {
        return true;
    }
    else {
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            if (nodeHasContent(child))
                return true;
        }
        return false;
    }
}

function isWhitespaceString(str)
{
    return (str.match(isWhitespaceString.regexp) != null);
}

isWhitespaceString.regexp = /^\s*$/;

function normalizeWhitespace(str)
{
    str = str.replace(/^\s+/,"");
    str = str.replace(/\s+$/,"");
    str = str.replace(/\s+/g," ");
    return str;
}

function DoublyLinkedList()
{
    this.first = null;
    this.last = null;
}

DoublyLinkedList.prototype.insertAfter = function(item,after)
{
    item.prev = null;
    item.next = null;

    if (this.first == null) { // empty list
        this.first = item;
        this.last = item;
    }
    else if (after == null) { // insert at start
        item.next = this.first;
        this.first = item;
    }
    else {
        item.next = after.next;
        item.prev = after;
        if (this.last == after)
            this.last = item;
    }

    if (item.next != null)
        item.next.prev = item;
    if (item.prev != null)
        item.prev.next = item;
};

DoublyLinkedList.prototype.remove = function(item)
{
    if (this.first == item)
        this.first = this.first.next;
    if (this.last == item)
        this.last = this.last.prev;
    if (item.prev != null)
        item.prev.next = item.next;
    if (item.next != null)
        item.next.prev = item.prev;
    item.prev = null;
    item.next = null;
};

function diff(src,dest)
{
    var traces = new Array();

    traces[1] = new DiffEntry(0,0,0,0,null);

    for (var distance = 0; true; distance++) {
        for (var k = -distance; k <= distance; k += 2) {
            var srcEnd;
            var prev;
            
            var del = traces[k-1];
            var ins = traces[k+1];

            if (((k == -distance) && ins) ||
                ((k != distance) && ins && del && (del.srcEnd < ins.srcEnd))) {
                // Down - insertion
                prev = ins;
                srcEnd = prev.srcEnd;
            }
            else if (del) {
                // Right - deletion
                prev = del;
                srcEnd = prev.srcEnd+1;
            }
            else {
                traces[k] = null;
                continue;
            }

            destEnd = srcEnd - k;
            var srcStart = srcEnd;
            var destStart = destEnd;
            while ((srcEnd < src.length) && (destEnd < dest.length) &&
                   (src[srcEnd] == dest[destEnd])) {
                srcEnd++;
                destEnd++;
            }
            if ((srcEnd > src.length) || (destEnd > dest.length))
                traces[k] = null;
            else
                traces[k] = new DiffEntry(srcStart,destStart,srcEnd,destEnd,prev);
            if ((srcEnd >= src.length) && (destEnd >= dest.length)) {
                return entryToArray(src,dest,traces[k]);
            }
        }
    }

    function DiffEntry(srcStart,destStart,srcEnd,destEnd,prev)
    {
        this.srcStart = srcStart;
        this.destStart = destStart;
        this.srcEnd = srcEnd;
        this.destEnd = destEnd;
        this.prev = prev;
    }

    function entryToArray(src,dest,entry)
    {
        var results = new Array();
        for (; entry != null; entry = entry.prev)
            results.push(entry);
        return results.reverse();
    }
}
