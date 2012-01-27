// Copyright (c) 2011-2012 UX Productivity. All rights reserved.

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

function nextNode(node)
{
    if (node.firstChild) {
        return node.firstChild;
    }
    else if (node.nextSibling) {
        return node.nextSibling;
    }
    else {
        while ((node.parentNode != null) && (node.parentNode.nextSibling == null))
            node = node.parentNode;
        if (node.parentNode == null)
            return null;
        else
            return node.parentNode.nextSibling;
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

function getNodeDepth(node)
{
    var depth = 0;
    for (; node != null; node = node.parentNode)
        depth++;
    return depth;
}

function getNodeText(node)
{
    var stringBuilder = new StringBuilder();
    getNodeTextRecursive(stringBuilder,node);
    stringBuilder.str = stringBuilder.str.replace(/\s+/g," ");
    return stringBuilder.str;

    function getNodeTextRecursive(stringBuilder,node)
    {
        if (node.nodeName == "#text") {
            stringBuilder.str += node.nodeValue;
        }
        else {
            for (var c = node.firstChild; c != null; c = c.nextSibling)
                getNodeTextRecursive(stringBuilder,c);
        }
    }
}

function shallowCopyElement(element)
{
    var copy = document.createElement(element.nodeName);
    for (var i = 0; i < element.attributes.length; i++) {
        if (element.attributes[i].nodeName != "id")
            copy.setAttribute(element.attributes[i].nodeName,element.attributes[i].nodeValue);
    }
    return copy;
}

function isWhitespaceTextNode(node)
{
    if (node.nodeType != Node.TEXT_NODE)
        return false;
    var value = node.nodeValue;
    for (var i = 0; i < value.length; i++) {
        var c = value.charAt(i);
        if ((c != " ") && (c != "\t") && (c != "\r") && (c != "\n"))
            return false;
    }
    return true;
}
