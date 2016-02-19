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

export function prevNode(node: Node): Node {
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

export function nextNodeAfter(node: Node, entering?: (n: Node) => void, exiting?: (n: Node) => void): Node {
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

export function nextNode(node: Node, entering?: (n: Node) => void, exiting?: (n: Node) => void): Node {
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

export function firstChildElement(node: Node): HTMLElement {
    let first = node.firstChild;
    while (first != null) {
        if (first instanceof HTMLElement)
            return first;
        first = first.nextSibling;
    }
    return null;
}

export function lastChildElement(node: Node): HTMLElement {
    let last = node.lastChild;
    while (last != null) {
        if (last instanceof HTMLElement)
            return last;
        last = last.previousSibling;
    }
    return null;
}

export function firstDescendant(node: Node): Node {
    while (node.firstChild != null)
        node = node.firstChild;
    return node;
}

export function lastDescendant(node: Node): Node {
    while (node.lastChild != null)
        node = node.lastChild;
    return node;
}

export function firstDescendantOfType(node: Node, type: number): HTMLElement {
    if ((node instanceof HTMLElement) && (node._type == type))
        return node;

    for (let child = node.firstChild; child != null; child = child.nextSibling) {
        let result = firstDescendantOfType(child,type);
        if (result != null)
            return result;
    }
    return null;
}

export function firstChildOfType(node: Node, type: number): HTMLElement {
    for (let child = node.firstChild; child != null; child = child.nextSibling) {
        if ((child instanceof HTMLElement) && (child._type == type))
            return child;
    }
    return null;
}

export function getNodeText(node: Node): string {
    let strings = new Array();
    recurse(node);
    return strings.join("").replace(/\s+/g," ");

    function recurse(node: Node): void {
        if (node instanceof Text)
            strings.push(node.nodeValue);

        for (let child = node.firstChild; child != null; child = child.nextSibling)
            recurse(child);
    }
}

export function isWhitespaceTextNode(node: Node): boolean {
    if (!(node instanceof Text))
        return false;
    return Util.isWhitespaceString(node.nodeValue);
}

export function isNonWhitespaceTextNode(node: Node): boolean {
    if (!(node instanceof Text))
        return false;
    return !Util.isWhitespaceString(node.nodeValue);
}

function treeToStringRecursive(node: Node, indent: string, offset: string, lines: string[]): void {
    if (indent == null)
        indent = "";
    if (offset == null)
        offset = "";
    if ((node instanceof Element) && node.hasAttribute("class"))
        lines.push(indent+offset+Util.nodeString(node)+"."+node.getAttribute("class"));
    else
        lines.push(indent+offset+Util.nodeString(node));
    let childOffset = 0;
    for (let child = node.firstChild; child != null; child = child.nextSibling) {
        treeToStringRecursive(child,indent+"    ",childOffset+" ",lines);
        childOffset++;
    }
}

export function treeToString(node: Node, indent: string, offset: string): string {
    let lines: string[] = [];
    treeToStringRecursive(node,indent,offset,lines);
    return lines.join("\n");
}
