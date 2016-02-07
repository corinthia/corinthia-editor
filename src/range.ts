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

import Collections = require("./collections");
import DOM = require("./dom");
import ElementTypes = require("./elementTypes");
import Formatting = require("./formatting");
import Hierarchy = require("./hierarchy");
import Main = require("./main");
import Position = require("./position");
import Traversal = require("./traversal");
import Types = require("./types");
import Util = require("./util");

export function Range(startNode,startOffset,endNode,endOffset) {
    this.start = new Position.Position(startNode,startOffset);
    this.end = new Position.Position(endNode,endOffset);
}

export function assertValid(range,description) {
    if (description == null)
        description = "Range";
    if (range == null)
        throw new Error(description+" is null");
    Position.assertValid(range.start,description+" start");
    Position.assertValid(range.end,description+" end");
}

export function isEmpty(range) {
    return ((range.start.node == range.end.node) &&
            (range.start.offset == range.end.offset));
}

Range.prototype.toString = function() {
    return this.start.toString() + " - " + this.end.toString();
}

export function trackWhileExecuting(range,fun) {
    if (range == null)
        return fun();
    else
        return Position.trackWhileExecuting([range.start,range.end],fun);
}

export function expand(range) {
    let doc = range.start.node.ownerDocument;
    while ((range.start.offset == 0) && (range.start.node != doc.body)) {
        let offset = DOM.nodeOffset(range.start.node);
        range.start.node = range.start.node.parentNode;
        range.start.offset = offset;
    }

    while ((range.end.offset == DOM.maxChildOffset(range.end.node)) &&
           (range.end.node != doc.body)) {
        let offset = DOM.nodeOffset(range.end.node);
        range.end.node = range.end.node.parentNode;
        range.end.offset = offset+1;
    }
}

export function isForwards(range) {
    return (Position.compare(range.start,range.end) <= 0);
}

export function getAllNodes(range,atLeastOne?) {
    let result = new Array();
    let outermost = getOutermostNodes(range,atLeastOne);
    for (let i = 0; i < outermost.length; i++)
        addRecursive(outermost[i]);
    return result;

    function addRecursive(node) {
        result.push(node);
        for (let child = node.firstChild; child != null; child = child.nextSibling)
            addRecursive(child);
    }
}

export function singleNode(range) {
    return Position.closestActualNode(range.start,true);
}

export function ensureInlineNodesInParagraph(range) {
    trackWhileExecuting(range,function() {
        let nodes = getAllNodes(range,true);
        for (let i = 0; i < nodes.length; i++)
            Hierarchy.ensureInlineNodesInParagraph(nodes[i]);
    });
}

export function ensureValidHierarchy(range,allowDirectInline?) {
    trackWhileExecuting(range,function() {
        let nodes = getAllNodes(range,true);
        for (let i = nodes.length-1; i >= 0; i--)
            Hierarchy.ensureValidHierarchy(nodes[i]);
    });
}

export function forwards(range) {
    if (isForwards(range)) {
        return range;
    }
    else {
        let reverse = new Range(range.end.node,range.end.offset,
                                range.start.node,range.start.offset);
        if (!isForwards(reverse))
            throw new Error("Both range "+range+" and its reverse are not forwards");
        return reverse;
    }
}

export function detail(range) {
    if (!isForwards(range)) {
        let reverse = new Range(range.end.node,range.end.offset,
                                range.start.node,range.start.offset);
        if (!isForwards(reverse))
            throw new Error("Both range "+range+" and its reverse are not forwards");
        return detail(reverse);
    }

    let result: any = new Object();
    let start = range.start;
    let end = range.end;

    // Start location
    if (start.node.nodeType == Node.ELEMENT_NODE) {
        result.startParent = start.node;
        result.startChild = start.node.childNodes[start.offset];
    }
    else {
        result.startParent = start.node.parentNode;
        result.startChild = start.node;
    }

    // End location
    if (end.node.nodeType == Node.ELEMENT_NODE) {
        result.endParent = end.node;
        result.endChild = end.node.childNodes[end.offset];
    }
    else if (end.offset == 0) {
        result.endParent = end.node.parentNode;
        result.endChild = end.node;
    }
    else {
        result.endParent = end.node.parentNode;
        result.endChild = end.node.nextSibling;
    }

    // Common ancestor
    let startP = result.startParent;
    let startC = result.startChild;
    while (startP != null) {
        let endP = result.endParent;
        let endC = result.endChild
        while (endP != null) {
            if (startP == endP) {
                result.commonAncestor = startP;
                result.startAncestor = startC;
                result.endAncestor = endC;
                // Found it
                return result;
            }
            endC = endP;
            endP = endP.parentNode;
        }
        startC = startP;
        startP = startP.parentNode;
    }
    throw new Error("Start and end of range have no common ancestor");
}

export function getOutermostNodes(range,atLeastOne?,info?) {
    let beforeNodes = new Array();
    let middleNodes = new Array();
    let afterNodes = new Array();

    if (info != null) {
        info.beginning = beforeNodes;
        info.middle = middleNodes;
        info.end = afterNodes;
    }

    if (isEmpty(range))
        return atLeastOne ? [singleNode(range)] : [];

    // Note: start and end are *points* - they are always *in between* nodes or characters, never
    // *at* a node or character.
    // Everything after the end point is excluded from the selection
    // Everything after the start point, but before the end point, is included in the selection

    // We use (parent,child) pairs so that we have a way to represent a point that comes after all
    // the child nodes in a container - in which case the child is null. The parent, however, is
    // always non-null;

    let det = detail(range);
    if (det.commonAncestor == null)
        return atLeastOne ? [singleNode(range)] : [];
    let startParent = det.startParent;
    let startChild = det.startChild;
    let endParent = det.endParent;
    let endChild = det.endChild;
    let commonParent = det.commonAncestor;
    let startAncestor = det.startAncestor;
    let endAncestor = det.endAncestor;

    // Add start nodes
    let topParent = startParent;
    let topChild = startChild;
    while (topParent != commonParent) {
        if (topChild != null)
            beforeNodes.push(topChild);

        while (((topChild == null) || (topChild.nextSibling == null)) &&
               (topParent != commonParent)) {
            topChild = topParent;
            topParent = topParent.parentNode;
        }
        if (topParent != commonParent)
            topChild = topChild.nextSibling;
    }

    // Add middle nodes
    if (startAncestor != endAncestor) {
        let c = startAncestor;
        if ((c != null) && (c != startChild))
            c = c.nextSibling;
        for (; c != endAncestor; c = c.nextSibling)
            middleNodes.push(c);
    }

    // Add end nodes
    let bottomParent = endParent;
    let bottomChild = endChild;
    while (true) {

        while ((getPreviousSibling(bottomParent,bottomChild) == null) &&
               (bottomParent != commonParent)) {
            bottomChild = bottomParent;
            bottomParent = bottomParent.parentNode;
        }
        if (bottomParent != commonParent)
            bottomChild = getPreviousSibling(bottomParent,bottomChild);

        if (bottomParent == commonParent)
            break;

        afterNodes.push(bottomChild);
    }
    afterNodes = afterNodes.reverse();

    let result = new Array();

    Array.prototype.push.apply(result,beforeNodes);
    Array.prototype.push.apply(result,middleNodes);
    Array.prototype.push.apply(result,afterNodes);

    if (result.length == 0)
        return atLeastOne ? [singleNode(range)] : [];
    else
        return result;

    function getPreviousSibling(parent,child) {
        if (child != null)
            return child.previousSibling;
        else if (parent.lastChild != null)
            return parent.lastChild;
        else
            return null;
    }

    function isAncestorLocation(ancestorParent,ancestorChild,
                                descendantParent,descendantChild) {
        while ((descendantParent != null) &&
               ((descendantParent != ancestorParent) || (descendantChild != ancestorChild))) {
            descendantChild = descendantParent;
            descendantParent = descendantParent.parentNode;
        }

        return ((descendantParent == ancestorParent) &&
                (descendantChild == ancestorChild));
    }
}

export function getClientRects(range) {
    let nodes = getOutermostNodes(range,true);

    // WebKit in iOS 5.0 and 5.1 has a bug where if the selection spans multiple paragraphs,
    // the complete rect for paragraphs other than the first is returned, instead of just the
    // portions of it that are actually in the range. To get around this problem, we go through
    // each text node individually and collect all the rects.
    let result = new Array();
    let doc = range.start.node.ownerDocument;
    let domRange = doc.createRange();
    for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
        let node = nodes[nodeIndex];
        if (node.nodeType == Node.TEXT_NODE) {
            let startOffset = (node == range.start.node) ? range.start.offset : 0;
            let endOffset = (node == range.end.node) ? range.end.offset : node.nodeValue.length;
            domRange.setStart(node,startOffset);
            domRange.setEnd(node,endOffset);
            let rects = domRange.getClientRects();
            for (let rectIndex = 0; rectIndex < rects.length; rectIndex++) {
                let rect = rects[rectIndex];
                if (Main.clientRectsBug) {
                    // Apple Bug ID 14682166 - getClientRects() returns coordinates relative
                    // to top of document, when it should instead return coordinates relative
                    // to the current client view (that is, taking into account scroll offsets)
                    result.push({ left: rect.left - window.scrollX,
                                  right: rect.right - window.scrollX,
                                  top: rect.top - window.scrollY,
                                  bottom: rect.bottom - window.scrollY,
                                  width: rect.width,
                                  height: rect.height });
                }
                else {
                    result.push(rect);
                }
            }
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            result.push(node.getBoundingClientRect());
        }
    }
    return result;
}

export function cloneContents(range) {
    let nodeSet = new Collections.NodeSet();
    let ancestorSet = new Collections.NodeSet();
    let det = detail(range);
    let outermost = getOutermostNodes(range);

    let haveContent = false;
    for (let i = 0; i < outermost.length; i++) {
        if (!Traversal.isWhitespaceTextNode(outermost[i]))
            haveContent = true;
        nodeSet.add(outermost[i]);
        for (let node = outermost[i]; node != null; node = node.parentNode)
            ancestorSet.add(node);
    }

    if (!haveContent)
        return new Array();

    let clone = recurse(det.commonAncestor);

    let ancestor = det.commonAncestor;
    while (Types.isInlineNode(ancestor)) {
        let ancestorClone = DOM.cloneNode(ancestor.parentNode,false);
        DOM.appendChild(ancestorClone,clone);
        ancestor = ancestor.parentNode;
        clone = ancestorClone;
    }

    let childArray = new Array();
    switch (clone._type) {
    case ElementTypes.HTML_UL:
    case ElementTypes.HTML_OL:
        childArray.push(clone);
        break;
    default:
        for (let child = clone.firstChild; child != null; child = child.nextSibling)
            childArray.push(child);
        Formatting.pushDownInlineProperties(childArray);
        break;
    }

    return childArray;

    function recurse(parent) {
        let clone = DOM.cloneNode(parent,false);
        for (let child = parent.firstChild; child != null; child = child.nextSibling) {
            if (nodeSet.contains(child)) {
                if ((child.nodeType == Node.TEXT_NODE) &&
                    (child == range.start.node) &&
                    (child == range.end.node)) {
                    let substring = child.nodeValue.substring(range.start.offset,
                                                              range.end.offset);
                    DOM.appendChild(clone,DOM.createTextNode(document,substring));
                }
                else if ((child.nodeType == Node.TEXT_NODE) &&
                         (child == range.start.node)) {
                    let substring = child.nodeValue.substring(range.start.offset);
                    DOM.appendChild(clone,DOM.createTextNode(document,substring));
                }
                else if ((child.nodeType == Node.TEXT_NODE) &&
                         (child == range.end.node)) {
                    let substring = child.nodeValue.substring(0,range.end.offset);
                    DOM.appendChild(clone,DOM.createTextNode(document,substring));
                }
                else {
                    DOM.appendChild(clone,DOM.cloneNode(child,true));
                }
            }
            else if (ancestorSet.contains(child)) {
                DOM.appendChild(clone,recurse(child));
            }
        }
        return clone;
    }
}

export function hasContent(range) {
    let outermost = getOutermostNodes(range);
    for (let i = 0; i < outermost.length; i++) {
        let node = outermost[i];
        if (node.nodeType == Node.TEXT_NODE) {
            let value = node.nodeValue;
            if ((node == range.start.node) && (node == range.end.node)) {
                if (!Util.isWhitespaceString(value.substring(range.start.offset,range.end.offset)))
                    return true;
            }
            else if (node == range.start.node) {
                if (!Util.isWhitespaceString(value.substring(range.start.offset)))
                    return true;
            }
            else if (node == range.end.node) {
                if (!Util.isWhitespaceString(value.substring(0,range.end.offset)))
                    return true;
            }
            else {
                if (!Util.isWhitespaceString(value))
                    return true;
            }
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            if (Util.nodeHasContent(node))
                return true;
        }
    }
    return false;
}

export function getText(range) {
    range = forwards(range);

    let start = range.start;
    let end = range.end;

    let startNode = start.node;
    let startOffset = start.offset;

    if (start.node.nodeType == Node.ELEMENT_NODE) {
        if ((start.node.offset == start.node.childNodes.length) &&
            (start.node.offset > 0))
            startNode = Traversal.nextNodeAfter(start.node);
        else
            startNode = start.node.childNodes[start.offset];
        startOffset = 0;
    }

    let endNode = end.node;
    let endOffset = end.offset;

    if (end.node.nodeType == Node.ELEMENT_NODE) {
        if ((end.node.offset == end.node.childNodes.length) &&
            (end.node.offset > 0))
            endNode = Traversal.nextNodeAfter(end.node);
        else
            endNode = end.node.childNodes[end.offset];
        endOffset = 0;
    }

    if ((startNode == null) || (endNode == null))
        return "";

    let components = new Array();
    let node = startNode;
    let significantParagraph = true;
    while (true) {
        if (node == null)
            throw new Error("Cannot find end node");

        if (node.nodeType == Node.TEXT_NODE) {

            if (!significantParagraph && !Util.isWhitespaceString(node.nodeValue)) {
                significantParagraph = true;
                components.push("\n");
            }

            if (significantParagraph) {
                let str;
                if ((node == startNode) && (node == endNode))
                    str = node.nodeValue.substring(startOffset,endOffset);
                else if (node == startNode)
                    str = node.nodeValue.substring(startOffset);
                else if (node == endNode)
                    str = node.nodeValue.substring(0,endOffset);
                else
                    str = node.nodeValue;
                str = str.replace(/\s+/g," ");
                components.push(str);
            }
        }

        if (node == endNode)
            break;


        let next = Traversal.nextNode(node,entering,exiting);
        node = next;
    }
    return components.join("");

    function entering(n) {
        if (Types.isParagraphNode(n)) {
            significantParagraph = true;
            components.push("\n");
        }
    }

    function exiting(n) {
        if (Types.isParagraphNode(n))
            significantParagraph = false;
    }
}
