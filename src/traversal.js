// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

function prevNode(node)
{
    if (node.previousSibling != null) {
        node = node.previousSibling;
        while (node.lastChild != null)
            node = node.lastChild;
        return node;
    }
    else {
        return node.parentNode;
    }
}

function nextNodeAfter(node,entering,exiting)
{
    while (node != null) {
        if (node.nextSibling != null) {
            if (exiting != null)
                exiting(node);
            node = node.nextSibling;
            if (entering != null)
                entering(node);
            break;
        }

        if (exiting != null)
            exiting(node);
        node = node.parentNode;
    }
    return node;
}

function nextNode(node,entering,exiting)
{
    if (node.firstChild) {
        node = node.firstChild;
        if (entering != null)
            entering(node);
        return node;
    }
    else {
        return nextNodeAfter(node,entering,exiting);
    }
}

function prevTextNode(node)
{
    do {
        node = prevNode(node);
    } while ((node != null) && (node.nodeType != Node.TEXT_NODE));
    return node;
}

function nextTextNode(node)
{
    do {
        node = nextNode(node);
    } while ((node != null) && (node.nodeType != Node.TEXT_NODE));
    return node;
}

function firstChildElement(node)
{
    var first = node.firstChild;
    while ((first != null) && (first.nodeType != Node.ELEMENT_NODE))
        first = first.nextSibling;
    return first;
}

function lastChildElement(node)
{
    var last = node.lastChild;
    while ((last != null) && (last.nodeType != Node.ELEMENT_NODE))
        last = last.previousSibling;
    return last;
}

function firstDescendant(node)
{
    while (node.firstChild != null)
        node = node.firstChild;
    return node;
}

function lastDescendant(node)
{
    while (node.lastChild != null)
        node = node.lastChild;
    return node;
}

function getNodeDepth(node)
{
    var depth = 0;
    for (; node != null; node = node.parentNode)
        depth++;
    return depth;
}

function getNodeText(node)
{
    var strings = new Array();
    recurse(node);
    return strings.join("").replace(/\s+/g," ");

    function recurse(node)
    {
        if (node.nodeType == Node.TEXT_NODE)
            strings.push(node.nodeValue);

        for (var child = node.firstChild; child != null; child = child.nextSibling)
            recurse(child);
    }
}

function isWhitespaceTextNode(node)
{
    if (node.nodeType != Node.TEXT_NODE)
        return false;
    return isWhitespaceString(node.nodeValue);
}

function isNonWhitespaceTextNode(node)
{
    if (node.nodeType != Node.TEXT_NODE)
        return false;
    return !isWhitespaceString(node.nodeValue);
}

function printTree(node,indent,offset)
{
    if (indent == null)
        indent = "";
    if (offset == null)
        offset = "";
    if ((node.nodeType == Node.ELEMENT_NODE) && node.hasAttribute("class"))
        debug(indent+offset+nodeString(node)+"."+node.getAttribute("class"));
    else
        debug(indent+offset+nodeString(node));
    var childOffset = 0;
    for (var child = node.firstChild; child != null; child = child.nextSibling) {
        printTree(child,indent+"    ",childOffset+" ");
        childOffset++;
    }
}
