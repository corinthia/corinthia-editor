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
import ElementTypes = require("./elementTypes");
import Position = require("./position");
import Traversal = require("./traversal");
import Types = require("./types");
import Util = require("./util");

class Range {

    public start: Position;
    public end: Position;

    constructor(startNode: Node, startOffset: number, endNode: Node, endOffset: number) {
        this.start = new Position(startNode,startOffset);
        this.end = new Position(endNode,endOffset);
    }

    public toString(): string {
        return this.start.toString() + " - " + this.end.toString();
    }

    public static assertValid(range: Range, description: string): void {
        if (description == null)
            description = "Range";
        if (range == null)
            throw new Error(description+" is null");
        Position.assertValid(range.start,description+" start");
        Position.assertValid(range.end,description+" end");
    }

    public static isEmpty(range: Range): boolean {
        return ((range.start.node == range.end.node) &&
                (range.start.offset == range.end.offset));
    }

    public static trackWhileExecuting<T>(range: Range, fun: () => T): T {
        if (range == null)
            return fun();
        else
            return Position.trackWhileExecuting([range.start,range.end],fun);
    }

    public static expand(range: Range): void {
        let doc = range.start.node.ownerDocument;
        while ((range.start.offset == 0) && (range.start.node != doc.body)) {
            let offset = Traversal.nodeOffset(range.start.node);
            range.start.node = range.start.node.parentNode;
            range.start.offset = offset;
        }

        while ((range.end.offset == Traversal.maxChildOffset(range.end.node)) &&
               (range.end.node != doc.body)) {
            let offset = Traversal.nodeOffset(range.end.node);
            range.end.node = range.end.node.parentNode;
            range.end.offset = offset+1;
        }
    }

    public static isForwards(range: Range): boolean {
        return (Position.compare(range.start,range.end) <= 0);
    }

    public static getAllNodes(range: Range, atLeastOne?: boolean): Node[] {
        let result = new Array();
        let outermost = Range.getOutermostNodes(range,atLeastOne);
        for (let i = 0; i < outermost.length; i++)
            addRecursive(outermost[i]);
        return result;

        function addRecursive(node: Node): void {
            result.push(node);
            for (let child = node.firstChild; child != null; child = child.nextSibling)
                addRecursive(child);
        }
    }

    public static singleNode(range: Range): Node {
        return Position.closestActualNode(range.start,true);
    }

    public static forwards(range: Range): Range {
        if (Range.isForwards(range)) {
            return range;
        }
        else {
            let reverse = new Range(range.end.node,range.end.offset,
                                    range.start.node,range.start.offset);
            if (!Range.isForwards(reverse))
                throw new Error("Both range "+range+" and its reverse are not forwards");
            return reverse;
        }
    }

    public static detail(range: Range): Range.RangeDetail {
        if (!Range.isForwards(range)) {
            let reverse = new Range(range.end.node,range.end.offset,
                                    range.start.node,range.start.offset);
            if (!Range.isForwards(reverse))
                throw new Error("Both range "+range+" and its reverse are not forwards");
            return Range.detail(reverse);
        }

        let result: any = new Range.RangeDetail();
        let start = range.start;
        let end = range.end;

        // Start location
        if (start.node instanceof Element) {
            result.startParent = start.node;
            result.startChild = start.node.childNodes[start.offset];
        }
        else {
            result.startParent = start.node.parentNode;
            result.startChild = start.node;
        }

        // End location
        if (end.node instanceof Element) {
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

    public static getOutermostNodes(range: Range, atLeastOne?: boolean): Node[] {
        let beforeNodes = new Array();
        let middleNodes = new Array();
        let afterNodes = new Array();

        if (Range.isEmpty(range))
            return atLeastOne ? [Range.singleNode(range)] : [];

        // Note: start and end are *points* - they are always *in between* nodes or characters, never
        // *at* a node or character.
        // Everything after the end point is excluded from the selection
        // Everything after the start point, but before the end point, is included in the selection

        // We use (parent,child) pairs so that we have a way to represent a point that comes after all
        // the child nodes in a container - in which case the child is null. The parent, however, is
        // always non-null;

        let det = Range.detail(range);
        if (det.commonAncestor == null)
            return atLeastOne ? [Range.singleNode(range)] : [];
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
            return atLeastOne ? [Range.singleNode(range)] : [];
        else
            return result;

        function getPreviousSibling(parent: Node, child: Node): Node {
            if (child != null)
                return child.previousSibling;
            else if (parent.lastChild != null)
                return parent.lastChild;
            else
                return null;
        }

        function isAncestorLocation(ancestorParent: Node, ancestorChild: Node,
                                    descendantParent: Node, descendantChild: Node) {
            while ((descendantParent != null) &&
                   ((descendantParent != ancestorParent) || (descendantChild != ancestorChild))) {
                descendantChild = descendantParent;
                descendantParent = descendantParent.parentNode;
            }

            return ((descendantParent == ancestorParent) &&
                    (descendantChild == ancestorChild));
        }
    }

    public static getClientRects(range: Range): ClientRect[] {
        let nodes = Range.getOutermostNodes(range,true);

        // WebKit in iOS 5.0 and 5.1 has a bug where if the selection spans multiple paragraphs,
        // the complete rect for paragraphs other than the first is returned, instead of just the
        // portions of it that are actually in the range. To get around this problem, we go through
        // each text node individually and collect all the rects.
        let result = new Array<ClientRect>();
        let doc = range.start.node.ownerDocument;
        let domRange = doc.createRange();
        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            let node = nodes[nodeIndex];
            if (node instanceof Text) {
                let startOffset = (node == range.start.node) ? range.start.offset : 0;
                let endOffset = (node == range.end.node) ? range.end.offset : node.nodeValue.length;
                domRange.setStart(node,startOffset);
                domRange.setEnd(node,endOffset);
                let rects = domRange.getClientRects();
                for (let rectIndex = 0; rectIndex < rects.length; rectIndex++)
                    result.push(rects[rectIndex]);
            }
            else if (node instanceof Element) {
                result.push(node.getBoundingClientRect());
            }
        }
        return result;
    }

    public static hasContent(range: Range): boolean {
        let outermost = Range.getOutermostNodes(range);
        for (let i = 0; i < outermost.length; i++) {
            let node = outermost[i];
            if (node instanceof Text) {
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
            else if (node instanceof Element) {
                if (Types.nodeHasContent(node))
                    return true;
            }
        }
        return false;
    }

    public static getText(range: Range): string {
        range = Range.forwards(range);

        let start = range.start;
        let end = range.end;

        let startNode = start.node;
        let startOffset = start.offset;

        if (start.node instanceof Element) {
            if ((start.offset == start.node.childNodes.length) && (start.offset > 0))
                startNode = Traversal.nextNodeAfter(start.node);
            else
                startNode = start.node.childNodes[start.offset];
            startOffset = 0;
        }

        let endNode = end.node;
        let endOffset = end.offset;

        if (end.node instanceof Element) {
            if ((end.offset == end.node.childNodes.length) && (end.offset > 0))
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

            if (node instanceof Text) {

                if (!significantParagraph && !Util.isWhitespaceString(node.nodeValue)) {
                    significantParagraph = true;
                    components.push("\n");
                }

                if (significantParagraph) {
                    let str: string;
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

        function entering(n: Node): void {
            if (Types.isParagraphNode(n)) {
                significantParagraph = true;
                components.push("\n");
            }
        }

        function exiting(n: Node): void {
            if (Types.isParagraphNode(n))
                significantParagraph = false;
        }
    }

}

module Range {

    export class RangeDetail {
        public startParent: Node;
        public startChild: Node;
        public endParent: Node;
        public endChild: Node;
        public commonAncestor: Node;
        public startAncestor: Node;
        public endAncestor: Node;
    }
}

export = Range;
