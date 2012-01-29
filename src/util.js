// Copyright (c) 2011-2012 UX Productivity. All rights reserved.

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
    else if (node.nodeType == Node.TEXT_NODE)
        return JSON.stringify(node.nodeValue);
    else if ((node.nodeType == Node.ELEMENT_NODE) && (node.hasAttribute("id")))
        return node.nodeName+"#"+node.getAttribute("id");
    else
        return node.nodeName;
}

// This function works around a bug in WebKit where caretRangeFromPoint sometimes returns an
// incorrect node (the last text node in the document). Before trusting the answer, we check to see
// if the point in question actually exists within the node's bounds.
function positionAtPoint(x,y)
{
    var caretRange = document.caretRangeFromPoint(x,y);
    if (caretRange == null)
        return null;

    var element = caretRange.startContainer;
    while ((element != null) && (element.nodeType != Node.ELEMENT_NODE))
        element = element.parentNode;
    if (element == null)
        return null;

    var boundingRect = element.getBoundingClientRect();
    if (!rectContainsPoint(boundingRect,x,y))
        return null;

    return new Position(caretRange.startContainer,caretRange.startOffset);

    function rectContainsPoint(rect,x,y)
    {
        return ((x >= rect.left) && (x <= rect.right) &&
                (y >= rect.top) && (y <= rect.bottom));
    }
}
