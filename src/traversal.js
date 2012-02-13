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

function nextNodeAfter(node)
{
    if (node.nextSibling) {
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

function nextNode(node)
{
    if (node.firstChild)
        return node.firstChild;
    else
        return nextNodeAfter(node);
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
    var strings = new Array();
    recurse(node);
    return strings.join("").replace(/\s+/g," ");

    function recurse(node)
    {
        if (node.nodeName == "#text")
            strings.push(node.nodeValue);

        for (var child = node.firstChild; child != null; child = child.nextSibling)
            recurse(child);
    }
}

function getOffsetOfNodeInParent(node)
{
    var offset = 0;
    for (var n = node.parentNode.firstChild; n != node; n = n.nextSibling)
        offset++;
    return offset;
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

function moveNode(node,parentNode,nextSibling)
{
    Position.nodeBeingMoved = node;
    parentNode.insertBefore(node,nextSibling);
    Position.nodeBeingMoved = null;
}

function removeNodeButKeepChildren(node)
{
    while (node.firstChild != null)
        moveNode(node.firstChild,node.parentNode,node);
    node.parentNode.removeChild(node);
}

function replaceElement(oldElement,newName)
{
    var newElement = document.createElement(newName);
    for (var i = 0; i < oldElement.attributes.length; i++) {
        var name = oldElement.attributes[i].nodeName;
        var value = oldElement.getAttribute(name);
        newElement.setAttribute(name,value);
    }

    oldElement.parentNode.insertBefore(newElement,oldElement);
    while (oldElement.firstChild != null)
        moveNode(oldElement.firstChild,newElement,null);
    moveNode(oldElement,newElement,null);
    oldElement.parentNode.removeChild(oldElement);

    return newElement;
}

function wrapNode(node,elementName)
{
    var wrapper = document.createElement(elementName);
    node.parentNode.insertBefore(wrapper,node);
    moveNode(node,wrapper,null);
    return wrapper;
}

function isWhitespaceCharacter(c)
{
    return ((c == " ") || (c == "\t") || (c == "\r") || (c == "\n"));
}

function isWhitespaceString(str)
{
    for (var i = 0; i < str.length; i++) {
        var c = str.charAt(i);
        if ((c != " ") && (c != "\t") && (c != "\r") && (c != "\n"))
            return false;
    }
    return true;
}

function isWhitespaceTextNode(node)
{
    if (node.nodeType != Node.TEXT_NODE)
        return false;
    return isWhitespaceString(node.nodeValue);
}

function printTree(node,indent)
{
    if (indent == null)
        indent = "";
    debug(indent+nodeString(node));
    for (var child = node.firstChild; child != null; child = child.nextSibling)
        printTree(child,indent+"    ");
}

function maxNodeOffset(node)
{
    if (node.nodeType == Node.TEXT_NODE)
        return node.nodeValue.length;
    else if (node.nodeType == Node.ELEMENT_NODE)
        return node.childNodes.length;
    else
        throw new Error("maxOffset: invalid node type ("+node.nodeType+")");
}
