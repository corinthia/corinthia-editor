// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

function isWordChar(c)
{
    return (((c >= "a") && (c <= "z")) ||
            ((c >= "A") && (c <= "Z")) ||
            ((c >= "0") && (c <= "9")));
}

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
        return id+DOM.upperName(node)+"#"+node.getAttribute("id");
    else
        return id+DOM.upperName(node);
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
    var caretRange = document.caretRangeFromPoint(x,y);
    if (caretRange == null)
        return null;

    var element = document.elementFromPoint(x,y);

    if ((caretRange.startContainer.nodeType == Node.TEXT_NODE) &&
        (element != caretRange.startContainer.parentNode)) {
        return null;
    }

    var position = new Position(caretRange.startContainer,caretRange.startOffset);
    position = Cursor.closestPositionForwards(position);
    return position;

    function rectContainsPoint(rect,x,y)
    {
        return ((x >= rect.left) && (x <= rect.right) &&
                (y >= rect.top) && (y <= rect.bottom));
    }
}

function nodeHasContent(node)
{
    if (node.nodeType == Node.TEXT_NODE) {
        return !isWhitespaceString(node.nodeValue);
    }
    else if ((DOM.upperName(node) == "IMG") || (DOM.upperName(node) == "TABLE")) {
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
