// This file is part of the Corinthia project (http://corinthia.io).
//
// See the COPYRIGHT.txt file distributed with this work for
// information regarding copyright ownership.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import Util = require("./util");

export function prevNode(node) {
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

export function nextNodeAfter(node,entering?,exiting?) {
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

export function nextNode(node,entering?,exiting?) {
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

export function prevTextNode(node) {
    do {
        node = prevNode(node);
    } while ((node != null) && !(node instanceof Text));
    return node;
}

export function nextTextNode(node) {
    do {
        node = nextNode(node);
    } while ((node != null) && !(node instanceof Text));
    return node;
}

export function firstChildElement(node) {
    let first = node.firstChild;
    while ((first != null) && !(first instanceof Element))
        first = first.nextSibling;
    return first;
}

export function lastChildElement(node) {
    let last = node.lastChild;
    while ((last != null) && !(last instanceof Element))
        last = last.previousSibling;
    return last;
}

export function firstDescendant(node) {
    while (node.firstChild != null)
        node = node.firstChild;
    return node;
}

export function lastDescendant(node) {
    while (node.lastChild != null)
        node = node.lastChild;
    return node;
}

export function firstDescendantOfType(node,type) {
    if (node._type == type)
        return node;

    for (let child = node.firstChild; child != null; child = child.nextSibling) {
        let result = firstDescendantOfType(child,type);
        if (result != null)
            return result;
    }
    return null;
}

export function firstChildOfType(node,type) {
    for (let child = node.firstChild; child != null; child = child.nextSibling) {
        if (child._type == type)
            return child;
    }
    return null;
}

export function getNodeDepth(node) {
    let depth = 0;
    for (; node != null; node = node.parentNode)
        depth++;
    return depth;
}

export function getNodeText(node) {
    let strings = new Array();
    recurse(node);
    return strings.join("").replace(/\s+/g," ");

    function recurse(node) {
        if (node instanceof Text)
            strings.push(node.nodeValue);

        for (let child = node.firstChild; child != null; child = child.nextSibling)
            recurse(child);
    }
}

export function isWhitespaceTextNode(node) {
    if (!(node instanceof Text))
        return false;
    return Util.isWhitespaceString(node.nodeValue);
}

export function isNonWhitespaceTextNode(node) {
    if (!(node instanceof Text))
        return false;
    return !Util.isWhitespaceString(node.nodeValue);
}

export function printTree(node,indent,offset) {
    if (indent == null)
        indent = "";
    if (offset == null)
        offset = "";
    if ((node instanceof Element) && node.hasAttribute("class"))
        Util.debug(indent+offset+Util.nodeString(node)+"."+node.getAttribute("class"));
    else
        Util.debug(indent+offset+Util.nodeString(node));
    let childOffset = 0;
    for (let child = node.firstChild; child != null; child = child.nextSibling) {
        printTree(child,indent+"    ",childOffset+" ");
        childOffset++;
    }
}
