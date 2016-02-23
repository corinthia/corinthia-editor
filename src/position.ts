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

import ElementTypes = require("./elementTypes");
import Traversal = require("./traversal");
import Types = require("./types");
import Util = require("./util");

class Position {

    private _node: Node;
    public offset: number;
    public origOffset: number;
    public posId: number;
    public tracking: number;
    public targetX: any;

    constructor(node: Node, offset: number) {
        if (node == document.documentElement)
            throw new Error("node is root element");
        this.node = node;
        this.offset = offset;
        this.origOffset = offset;
        this.tracking = 0;
        this.posId = null;
        this.targetX = null;
    }

    get node(): Node {
        return this._node;
    }

    set node(newNode: Node) {
        if (this.tracking > 0)
            this.actuallyStopTracking();

        this._node = newNode;

        if (this.tracking > 0)
            this.actuallyStartTracking();
    }

    private actuallyStartTracking(): void {
        let node = this.node;
        if (node._trackedPositions == null)
            node._trackedPositions = new Array<Position>();
        node._trackedPositions.push(this);
    }

    private actuallyStopTracking(): void {
        let trackedPositions = this.node._trackedPositions;
        if (trackedPositions == null)
            throw new Error("actuallyStopTracking: no registered positions for this node "+
                            "("+this.node.nodeName+")");
        for (let i = 0; i < trackedPositions.length; i++) {
            if (trackedPositions[i] == this) {
                trackedPositions.splice(i,1);
                return;
            }
        }
        throw new Error("removeTrackedPosition: position is not registered ("+
                        trackedPositions.length+" others)");
    }

    public startTracking() {
        if (this.tracking == 0)
            this.actuallyStartTracking();
        this.tracking++;
    }

    public stopTracking() {
        this.tracking--;
        if (this.tracking == 0)
            this.actuallyStopTracking();
    }

    public toString(): string {
        let result: string;
        if (this.node instanceof Text) {
            let extra = "";
            if (this.offset > this.node.nodeValue.length) {
                for (let i = this.node.nodeValue.length; i < this.offset; i++)
                    extra += "!";
            }
            let id = "";
            result = id+JSON.stringify(this.node.nodeValue.slice(0,this.offset)+extra+"|"+
                                       this.node.nodeValue.slice(this.offset));
        }
        else {
            result = "("+Util.nodeString(this.node)+","+this.offset+")";
        }
        if (this.posId != null)
            result = "["+this.posId+"]"+result;
        return result;
    }

    private static positionSpecial(pos: Position, forwards: boolean, backwards: boolean): Position {
        let node = pos.node;
        let offset = pos.offset;

        let prev = node.childNodes[offset-1];
        let next = node.childNodes[offset];

        // Moving left from the start of a caption - go to the end of the table
        if ((node._type == ElementTypes.HTML_CAPTION) && backwards && (prev == null))
            return new Position(node.parentNode,node.parentNode.childNodes.length);

        // Moving right from the end of a caption - go after the table
        if ((node._type == ElementTypes.HTML_CAPTION) && forwards && (next == null))
            return new Position(node.parentNode.parentNode,Traversal.nodeOffset(node.parentNode)+1);

        // Moving left from just after a table - go to the end of the caption (if there is one)
        if ((prev != null) && (prev._type == ElementTypes.HTML_TABLE) && backwards) {
            let firstChild = Traversal.firstChildElement(prev);
            if ((firstChild._type == ElementTypes.HTML_CAPTION))
                return new Position(firstChild,firstChild.childNodes.length);
        }

        // Moving right from just before a table - bypass the the caption (if there is one)
        if ((next != null) && (next._type == ElementTypes.HTML_TABLE) && forwards) {
            let firstChild = Traversal.firstChildElement(next);
            if (firstChild._type == ElementTypes.HTML_CAPTION)
                return new Position(next,Traversal.nodeOffset(firstChild)+1);
        }

        // Moving right from the end of a table - go to the start of the caption (if there is one)
        if ((node._type == ElementTypes.HTML_TABLE) && (next == null) && forwards) {
            let firstChild = Traversal.firstChildElement(node);
            if (firstChild._type == ElementTypes.HTML_CAPTION)
                return new Position(firstChild,0);
        }

        // Moving left just after a caption node - skip the caption
        if ((prev != null) && (prev._type == ElementTypes.HTML_CAPTION) && backwards)
            return new Position(node,offset-1);

        return null;
    }

    public static assertValid(pos: Position, description?: string): void {
        if (description == null)
            description = "Position";

        for (let ancestor = pos.node; ancestor != document.body; ancestor = ancestor.parentNode) {
            if (ancestor == null)
                throw new Error(description+" node "+pos.node.nodeName+" is not in tree");
        }

        let max: number;
        if (pos.node instanceof Element)
            max = pos.node.childNodes.length;
        else if (pos.node instanceof Text)
            max = pos.node.nodeValue.length;
        else
            throw new Error(description+" has invalid node type "+pos.node.nodeType);

        if ((pos.offset < 0) || (pos.offset > max)) {
            throw new Error(description+" (in "+pos.node.nodeName+") has invalid offset "+
                            pos.offset+" (max allowed is "+max+")");
        }
    }

    public static prev(pos: Position): Position {
        if (pos.node instanceof Element) {
            let r = Position.positionSpecial(pos,false,true);
            if (r != null)
                return r;
            if (pos.offset == 0) {
                return upAndBack(pos);
            }
            else {
                let child = pos.node.childNodes[pos.offset-1];
                return new Position(child,Traversal.maxChildOffset(child));
            }
        }
        else if (pos.node instanceof Text) {
            if (pos.offset > 0)
                return new Position(pos.node,pos.offset-1);
            else
                return upAndBack(pos);
        }
        else {
            return null;
        }

        function upAndBack(pos: Position): Position {
            if (pos.node == pos.node.ownerDocument.body)
                return null;
            else
                return new Position(pos.node.parentNode,Traversal.nodeOffset(pos.node));
        }
    }

    public static next(pos: Position): Position {
        if (pos.node instanceof Element) {
            let r = Position.positionSpecial(pos,true,false);
            if (r != null)
                return r;
            if (pos.offset == pos.node.childNodes.length)
                return upAndForwards(pos);
            else
                return new Position(pos.node.childNodes[pos.offset],0);
        }
        else if (pos.node instanceof Text) {
            if (pos.offset < pos.node.nodeValue.length)
                return new Position(pos.node,pos.offset+1);
            else
                return upAndForwards(pos);
        }
        else {
            return null;
        }

        function upAndForwards(pos: Position): Position {
            if (pos.node == pos.node.ownerDocument.body)
                return null;
            else
                return new Position(pos.node.parentNode,Traversal.nodeOffset(pos.node)+1);
        }
    }

    public static trackWhileExecuting<T>(positions: Position[], fun: () => T): T {
        for (let i = 0; i < positions.length; i++)
            positions[i].startTracking();
        try {
            return fun();
        }
        finally {
            for (let i = 0; i < positions.length; i++)
                positions[i].stopTracking();
        }
    }

    public static closestActualNode(pos: Position, preferElement?: boolean): Node {
        let node = pos.node;
        let offset = pos.offset;
        if (!(node instanceof Element) || (node.firstChild == null))
            return node;
        else if (offset == 0)
            return node.firstChild;
        else if (offset >= node.childNodes.length)
            return node.lastChild;

        let prev = node.childNodes[offset-1];
        let next = node.childNodes[offset];
        if (preferElement &&
            !(next instanceof Element) &&
            (prev instanceof Element)) {
            return prev;
        }
        else {
            return next;
        }
    }

    public static okForInsertion(pos: Position): boolean {
        return Position.okForMovement(pos,true);
    }

    private static nodeCausesLineBreak(node: Node): boolean {
        return ((node._type == ElementTypes.HTML_BR) || !Types.isInlineNode(node));
    }

    private static spacesUntilNextContent(node: Node): number {
        let spaces = 0;
        while (true) {
            if (node.firstChild) {
                node = node.firstChild;
            }
            else if (node.nextSibling) {
                node = node.nextSibling;
            }
            else {
                while ((node.parentNode != null) && (node.parentNode.nextSibling == null)) {
                    node = node.parentNode;
                    if (Position.nodeCausesLineBreak(node))
                        return null;
                }
                if (node.parentNode == null)
                    node = null;
                else
                    node = node.parentNode.nextSibling;
            }

            if ((node == null) || Position.nodeCausesLineBreak(node))
                return null;
            if (Types.isOpaqueNode(node))
                return spaces;
            if (node instanceof Text) {
                if (Traversal.isWhitespaceTextNode(node)) {
                    spaces += node.nodeValue.length;
                }
                else {
                    let matches = node.nodeValue.match(/^\s+/);
                    if (matches == null)
                        return spaces;
                    spaces += matches[0].length;
                    return spaces;
                }
            }
        }
    }

    public static okForMovement(pos: Position, insertion?: boolean): boolean {
        let node = pos.node;
        let offset = pos.offset;
        let type = node._type;

        if (Types.isOpaqueNode(node))
            return false;

        for (let ancestor = node; ancestor != null; ancestor = ancestor.parentNode) {
            let ancestorType = node._type;
            if (ancestorType == ElementTypes.HTML_FIGCAPTION)
                break;
            else if (ancestorType == ElementTypes.HTML_FIGURE)
                return false;
        }

        if (node instanceof Text) {
            let value = node.nodeValue;

            // If there are multiple adjacent text nodes, consider them as one (adjusting the
            // offset appropriately)

            let firstNode: Node = node;
            let lastNode: Node = node;

            while ((firstNode.previousSibling != null) &&
                   (firstNode.previousSibling instanceof Text)) {
                firstNode = firstNode.previousSibling;
                value = firstNode.nodeValue + value;
                offset += firstNode.nodeValue.length;
            }

            while ((lastNode.nextSibling != null) &&
                   (lastNode.nextSibling instanceof Text)) {
                lastNode = lastNode.nextSibling;
                value += lastNode.nodeValue;
            }

            let prevChar = value.charAt(offset-1);
            let nextChar = value.charAt(offset);
            let havePrevChar = ((prevChar != null) && !Util.isWhitespaceString(prevChar));
            let haveNextChar = ((nextChar != null) && !Util.isWhitespaceString(nextChar));
            if (havePrevChar && haveNextChar) {
                let prevCode = value.charCodeAt(offset-1);
                let nextCode = value.charCodeAt(offset);
                if ((prevCode >= 0xD800) && (prevCode <= 0xDBFF) &&
                    (nextCode >= 0xDC00) && (nextCode <= 0xDFFF)) {
                    return false; // In middle of surrogate pair
                }
                return true;
            }

            if (Util.isWhitespaceString(value)) {
                if (offset == 0) {
                    if ((node == firstNode) &&
                        (firstNode.previousSibling == null) && (lastNode.nextSibling == null))
                        return true;
                    if ((node.nextSibling != null) && (node.nextSibling._type == ElementTypes.HTML_BR))
                        return true;
                    if ((node.firstChild == null) &&
                        (node.previousSibling == null) &&
                        (node.nextSibling == null)) {
                        return true;
                    }
                    if (insertion && (node.previousSibling != null) &&
                        Types.isInlineNode(node.previousSibling) &&
                        !Types.isOpaqueNode(node.previousSibling) &&
                        (node.previousSibling._type != ElementTypes.HTML_BR))
                        return true;
                }
                return false;
            }

            if (insertion)
                return true;

            let precedingText = value.substring(0,offset);
            if (Util.isWhitespaceString(precedingText)) {
                return (haveNextChar &&
                        ((node.previousSibling == null) ||
                         (node.previousSibling._type == ElementTypes.HTML_BR) ||
                         Types.isNoteNode(node.previousSibling) ||
                         (Types.isParagraphNode(node.previousSibling)) ||
                         (Traversal.getNodeText(node.previousSibling).match(/\s$/) != null) ||
                         Types.isItemNumber(node.previousSibling) ||
                         ((precedingText.length > 0))));
            }

            let followingText = value.substring(offset);
            if (Util.isWhitespaceString(followingText)) {
                return (havePrevChar &&
                        ((node.nextSibling == null) ||
                         Types.isNoteNode(node.nextSibling) ||
                         (followingText.length > 0) ||
                         (Position.spacesUntilNextContent(node) != 0)));
            }

            return (havePrevChar || haveNextChar);
        }
        else if (node instanceof Element) {
            if (node.firstChild == null) {
                switch (type) {
                case ElementTypes.HTML_LI:
                case ElementTypes.HTML_TH:
                case ElementTypes.HTML_TD:
                    return true;
                default:
                    if (Types.PARAGRAPH_ELEMENTS[type])
                        return true;
                    else
                        break;
                }
            }

            let prevNode = node.childNodes[offset-1];
            let nextNode = node.childNodes[offset];
            let prevType = (prevNode != null) ? prevNode._type : 0;
            let nextType = (nextNode != null) ? nextNode._type : 0;

            let prevIsNote = (prevNode != null) && Types.isNoteNode(prevNode);
            let nextIsNote = (nextNode != null) && Types.isNoteNode(nextNode);
            if (((nextNode == null) || !Types.nodeHasContent(nextNode)) && prevIsNote)
                return true;
            if (((prevNode == null) || !Types.nodeHasContent(prevNode)) && nextIsNote)
                return true;
            if (prevIsNote && nextIsNote)
                return true;

            if ((prevNode == null) && (nextNode == null) &&
                (Types.CONTAINERS_ALLOWING_CHILDREN[type] ||
                (Types.isInlineNode(node) && !Types.isOpaqueNode(node) && (type != ElementTypes.HTML_BR))))
                return true;

            if ((prevNode != null) && Types.isSpecialBlockNode(prevNode))
                return true;
            if ((nextNode != null) && Types.isSpecialBlockNode(nextNode))
                return true;

            if ((nextNode != null) && Types.isItemNumber(nextNode))
                return false;
            if ((prevNode != null) && Types.isItemNumber(prevNode))
                return ((nextNode == null) || Traversal.isWhitespaceTextNode(nextNode));

            if ((nextNode != null) && (nextType == ElementTypes.HTML_BR))
                return ((prevType == 0) || (prevType != ElementTypes.HTML_TEXT));

            if ((prevNode != null) && (Types.isOpaqueNode(prevNode) || (prevType == ElementTypes.HTML_TABLE))) {

                switch (nextType) {
                case 0:
                case ElementTypes.HTML_TEXT:
                case ElementTypes.HTML_TABLE:
                    return true;
                default:
                    return Types.isOpaqueNode(nextNode);
                }
            }
            if ((nextNode != null) && (Types.isOpaqueNode(nextNode) || (nextType == ElementTypes.HTML_TABLE))) {
                switch (prevType) {
                case 0:
                case ElementTypes.HTML_TEXT:
                case ElementTypes.HTML_TABLE:
                    return true;
                default:
                    return Types.isOpaqueNode(prevNode);
                }
            }
        }

        return false;
    }

    public static prevMatch(pos: Position, fun: (pos: Position) => boolean): Position {
        do {
            pos = Position.prev(pos);
        } while ((pos != null) && !fun(pos));
        return pos;
    }

    public static nextMatch(pos: Position, fun: (pos: Position) => boolean): Position {
        do {
            pos = Position.next(pos);
        } while ((pos != null) && !fun(pos));
        return pos;
    }

    private static findEquivalentValidPosition(pos: Position, fun: (pos: Position) => boolean): Position {
        let node = pos.node;
        let offset = pos.offset;
        if (node instanceof Element) {
            let before = node.childNodes[offset-1];
            let after = node.childNodes[offset];
            if ((before != null) && (before instanceof Text)) {
                let candidate = new Position(before,before.nodeValue.length);
                if (fun(candidate))
                    return candidate;
            }
            if ((after != null) && (after instanceof Text)) {
                let candidate = new Position(after,0);
                if (fun(candidate))
                    return candidate;
            }
        }

        if ((pos.node instanceof Text) &&
            Util.isWhitespaceString(pos.node.nodeValue.slice(pos.offset))) {
            let str = pos.node.nodeValue;
            let whitespace = str.match(/\s+$/);
            if (whitespace) {
                let adjusted = new Position(pos.node,
                                            str.length - whitespace[0].length + 1);
                return adjusted;
            }
        }
        return pos;
    }

    public static closestMatchForwards(pos: Position, fun: (pos: Position) => boolean): Position {
        if (pos == null)
            return null;

        if (!fun(pos))
            pos = Position.findEquivalentValidPosition(pos,fun);

        if (fun(pos))
            return pos;

        let next = Position.nextMatch(pos,fun);
        if (next != null)
            return next;

        let prev = Position.prevMatch(pos,fun);
        if (prev != null)
            return prev;

        return new Position(document.body,document.body.childNodes.length);
    }

    public static closestMatchBackwards(pos: Position, fun: (pos: Position) => boolean): Position {
        if (pos == null)
            return null;

        if (!fun(pos))
            pos = Position.findEquivalentValidPosition(pos,fun);

        if (fun(pos))
            return pos;

        let prev = Position.prevMatch(pos,fun);
        if (prev != null)
            return prev;

        let next = Position.nextMatch(pos,fun);
        if (next != null)
            return next;

        return new Position(document.body,0);
    }

    public static track(pos: Position): void {
        pos.startTracking();
    }

    public static untrack(pos: Position): void {
        pos.stopTracking();
    }

    public static noteAncestor(pos: Position): HTMLElement {
        let node = Position.closestActualNode(pos);
        for (; node != null; node = node.parentNode) {
            if ((node instanceof HTMLElement) && Types.isNoteNode(node))
                return node;
        }
        return null;
    }

    public static captionAncestor(pos: Position): Element {
        let node = Position.closestActualNode(pos);
        for (; node != null; node = node.parentNode) {
            if ((node instanceof Element) &&
                ((node._type == ElementTypes.HTML_FIGCAPTION) || (node._type == ElementTypes.HTML_CAPTION)))
                return node;
        }
        return null;
    }

    public static figureOrTableAncestor(pos: Position): Element {
        let node = Position.closestActualNode(pos);
        for (; node != null; node = node.parentNode) {
            if ((node instanceof Element) &&
                ((node._type == ElementTypes.HTML_FIGURE) || (node._type == ElementTypes.HTML_TABLE)))
                return node;
        }
        return null;
    }

    public static equal(a: Position, b: Position): boolean {
        if ((a == null) && (b == null))
            return true;
        if ((a != null) && (b != null) &&
            (a.node == b.node) && (a.offset == b.offset))
            return true;
        return false;
    }

    public static preferTextPosition(pos: Position): Position {
        let node = pos.node;
        let offset = pos.offset;
        if (node instanceof Element) {
            let before = node.childNodes[offset-1];
            let after = node.childNodes[offset];
            if ((before != null) && (before instanceof Text))
                return new Position(before,before.nodeValue.length);
            if ((after != null) && (after instanceof Text))
                return new Position(after,0);
        }
        return pos;
    }

    public static preferElementPosition(pos: Position): Position {
        if (pos.node instanceof Text) {
            if (pos.node.parentNode == null)
                throw new Error("Position "+pos+" has no parent node");
            if (pos.offset == 0)
                return new Position(pos.node.parentNode,Traversal.nodeOffset(pos.node));
            if (pos.offset == pos.node.nodeValue.length)
                return new Position(pos.node.parentNode,Traversal.nodeOffset(pos.node)+1);
        }
        return pos;
    }

    public static compare(first: Position, second: Position): number {
        if ((first.node == second.node) && (first.offset == second.offset))
            return 0;

        let doc = first.node.ownerDocument;
        if ((first.node.parentNode == null) && (first.node != doc.documentElement))
            throw new Error("First node has been removed from document");
        if ((second.node.parentNode == null) && (second.node != doc.documentElement))
            throw new Error("Second node has been removed from document");

        if (first.node == second.node)
            return first.offset - second.offset;

        let firstParent: Node = null;
        let firstChild: Node = null;
        let secondParent: Node = null;
        let secondChild: Node = null;

        if (second.node instanceof Element) {
            secondParent = second.node;
            secondChild = second.node.childNodes[second.offset];
        }
        else {
            secondParent = second.node.parentNode;
            secondChild = second.node;
        }

        if (first.node instanceof Element) {
            firstParent = first.node;
            firstChild = first.node.childNodes[first.offset];
        }
        else {
            firstParent = first.node.parentNode;
            firstChild = first.node;
            if (firstChild == secondChild)
                return 1;
        }

        let firstC = firstChild;
        let firstP = firstParent;
        while (firstP != null) {

            let secondC = secondChild;
            let secondP = secondParent;
            while (secondP != null) {

                if (firstP == secondC)
                    return 1;

                if (firstP == secondP) {
                    // if secondC is last child, firstC must be secondC or come before it
                    if (secondC == null)
                        return -1;
                    for (let n = firstC; n != null; n = n.nextSibling) {
                        if (n == secondC)
                            return -1;
                    }
                    return 1;
                }

                secondC = secondP;
                secondP = secondP.parentNode;
            }

            firstC = firstP;
            firstP = firstP.parentNode;
        }
        throw new Error("Could not find common ancestor");
    }

}

export = Position;
