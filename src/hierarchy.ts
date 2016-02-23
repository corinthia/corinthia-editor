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

import DOM = require("./dom");
import ElementTypes = require("./elementTypes");
import Formatting = require("./formatting");
import Position = require("./position");
import Range = require("./range");
import Traversal = require("./traversal");
import Types = require("./types");
import Util = require("./util");

// private
function wrapInlineChildren(first: Node, last: Node, ancestors: Node[]): void {
    let haveNonWhitespace = false;
    for (let node = first; node != last.nextSibling; node = node.nextSibling) {
        if (!Traversal.isWhitespaceTextNode(node))
            haveNonWhitespace = true;
    }
    if (!haveNonWhitespace)
        return;

    let parentNode = first.parentNode;
    let nextSibling = first;
    for (let i = ancestors.length-1; i >= 0; i--) {
        let ancestorCopy = DOM.shallowCopyElement(ancestors[i]);
        DOM.insertBefore(parentNode,ancestorCopy,nextSibling);
        parentNode = ancestorCopy;
        nextSibling = null;

        let node = first;
        while (true) {
            let next = node.nextSibling;
            DOM.insertBefore(parentNode,node,null);
            if (node == last)
                break;
            node = next;
        }
    }
}

// private
function wrapInlineChildrenInAncestors(node: Node, ancestors: Node[]): void {
    let firstInline: Node = null;
    let lastInline: Node = null;

    let child = node.firstChild;
    while (true) {
        let next = (child != null) ? child.nextSibling : null;
        if ((child == null) || !Types.isInlineNode(child)) {

            if ((firstInline != null) && (lastInline != null)) {
                wrapInlineChildren(firstInline,lastInline,ancestors);
            }
            firstInline = null;
            lastInline = null;
            if (child != null)
                wrapInlineChildrenInAncestors(child,ancestors);
        }
        else {
            if (firstInline == null)
                firstInline = child;
            lastInline = child;
        }
        if (child == null)
            break;
        child = next;
    }
}

function checkInvalidNesting(node: Node): boolean {
    let parent = node.parentNode;
    if ((parent instanceof HTMLDivElement) &&
        (DOM.getAttribute(parent,"class") == Types.Keys.SELECTION_CLASS)) {
        parent = parent.parentNode;
    }

    let invalidNesting = !Types.isContainerNode(parent);
    switch (parent._type) {
    case ElementTypes.HTML_DIV:
        if (Types.isParagraphNode(node) || Types.isListNode(node))
            invalidNesting = false; // this case is ok
        break;
    case ElementTypes.HTML_CAPTION:
    case ElementTypes.HTML_FIGCAPTION:
    case ElementTypes.HTML_TABLE:
    case ElementTypes.HTML_FIGURE:
        switch (node._type) {
        case ElementTypes.HTML_FIGURE:
        case ElementTypes.HTML_TABLE:
        case ElementTypes.HTML_H1:
        case ElementTypes.HTML_H2:
        case ElementTypes.HTML_H3:
        case ElementTypes.HTML_H4:
        case ElementTypes.HTML_H5:
        case ElementTypes.HTML_H6:
            return true;
        }
        break;
    }

    return invalidNesting;
}

function checkInvalidHeadingNesting(node: Node): boolean {
    switch (node._type) {
    case ElementTypes.HTML_H1:
    case ElementTypes.HTML_H2:
    case ElementTypes.HTML_H3:
    case ElementTypes.HTML_H4:
    case ElementTypes.HTML_H5:
    case ElementTypes.HTML_H6:
        switch (node.parentNode._type) {
        case ElementTypes.HTML_BODY:
        case ElementTypes.HTML_NAV:
        case ElementTypes.HTML_DIV:
            return false;
        default:
            return true;
        }
    default:
        return false;
    }
}

function nodeHasSignificantChildren(node: Node): boolean {
    for (let child = node.firstChild; child != null; child = child.nextSibling) {
        if (!Traversal.isWhitespaceTextNode(child))
            return true;
    }
    return false;
}

// Enforce the restriction that any path from the root to a given node must be of the form
//    container+ paragraph inline
// or container+ paragraph
// or container+
// public
export function ensureValidHierarchy(node: Node): void {
    let count = 0;
    while ((node != null) && (node.parentNode != null) && (node != document.body)) {
        count++;
        if (count > 200)
            throw new Error("too many iterations");

        if (checkInvalidHeadingNesting(node)) {
            let offset = Traversal.nodeOffset(node);
            let parent = node.parentNode;
            Formatting.moveFollowing(new Position(node.parentNode,offset+1),
                                     function() { return false; });
            DOM.insertBefore(node.parentNode.parentNode,
                             node,
                             node.parentNode.nextSibling);

            while ((parent != document.body) && !nodeHasSignificantChildren(parent)) {
                let grandParent = parent.parentNode;
                DOM.deleteNode(parent);
                parent = grandParent;
            }

            continue;
        }
        else if (Types.isContainerNode(node) || Types.isParagraphNode(node)) {
            let invalidNesting = checkInvalidNesting(node);
            if (invalidNesting) {
                let ancestors = new Array();
                let child = node;
                while (!Types.isContainerNode(child.parentNode)) {
                    if (Types.isInlineNode(child.parentNode)) {
                        let keep = false;
                        if (child.parentNode._type == ElementTypes.HTML_SPAN) {
                            for (let i = 0; i < child.attributes.length; i++) {
                                let attr = child.attributes[i];
                                if (attr.nodeName.toUpperCase() != "ID")
                                    keep = true;
                            }
                            if (keep)
                                ancestors.push(child.parentNode);
                        }
                        else {
                            ancestors.push(child.parentNode);
                        }
                    }
                    child = child.parentNode;
                }

                while (checkInvalidNesting(node)) {
                    let offset = Traversal.nodeOffset(node);
                    let parent = node.parentNode;
                    Formatting.moveFollowing(new Position(node.parentNode,offset+1),
                                             Types.isContainerNode);
                    DOM.insertBefore(node.parentNode.parentNode,
                                     node,
                                     node.parentNode.nextSibling);
                    if (!nodeHasSignificantChildren(parent))
                        DOM.deleteNode(parent);

                }
                wrapInlineChildrenInAncestors(node,ancestors);
            }
        }

        node = node.parentNode;
    }
}

export function ensureRangeInlineNodesInParagraph(range: Range): void {
    Range.trackWhileExecuting(range,function() {
        let nodes = range.getAllNodes(true);
        for (let i = 0; i < nodes.length; i++)
            ensureInlineNodesInParagraph(nodes[i]);
    });
}

export function ensureInlineNodesInParagraph(node: Node, weak?: boolean): void {
    let count = 0;
    while ((node != null) && (node.parentNode != null) && (node != document.body)) {
        count++;
        if (count > 200)
            throw new Error("too many iterations");
        if (Types.isInlineNode(node) &&
            Types.isContainerNode(node.parentNode) && (node.parentNode._type != ElementTypes.HTML_LI) &&
            (!weak || !Types.isTableCell(node.parentNode)) &&
            !Traversal.isWhitespaceTextNode(node)) {
            wrapInlineNodesInParagraph(node);
            return;
        }
        node = node.parentNode;
    }
}

export function ensureRangeValidHierarchy(range: Range, allowDirectInline?: boolean): void {
    Range.trackWhileExecuting(range,function() {
        let nodes = range.getAllNodes(true);
        for (let i = nodes.length-1; i >= 0; i--)
            ensureValidHierarchy(nodes[i]);
    });
}

// public
export function wrapInlineNodesInParagraph(node: Node): HTMLElement {
    let start = node;
    let end = node;

    while ((start.previousSibling != null) && Types.isInlineNode(start.previousSibling))
        start = start.previousSibling;
    while ((end.nextSibling != null) && Types.isInlineNode(end.nextSibling))
        end = end.nextSibling;

    return DOM.wrapSiblings(start,end,"P");
}

export function avoidInlineChildren(parent: Node): void {
    let child = parent.firstChild;

    while (child != null) {
        if (Types.isInlineNode(child)) {
            let start = child;
            let end = child;
            let haveContent = Types.nodeHasContent(end);
            while ((end.nextSibling != null) && Types.isInlineNode(end.nextSibling)) {
                end = end.nextSibling;
                if (Types.nodeHasContent(end))
                    haveContent = true;
            }
            child = DOM.wrapSiblings(start,end,"P");
            let next = child.nextSibling;
            if (!Types.nodeHasContent(child))
                DOM.deleteNode(child);
            child = next;
        }
        else {
            child = child.nextSibling;
        }
    }
}
