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
import Range = require("./range");
import Txt = require("./text");
import Traversal = require("./traversal");
import Types = require("./types");
import Util = require("./util");

export class Position {

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

    private actuallyStartTracking() {
        DOM.addTrackedPosition(this);
    }

    private actuallyStopTracking() {
        DOM.removeTrackedPosition(this);
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
        let result;
        if (this.node instanceof Text) {
            let extra = "";
            if (this.offset > this.node.nodeValue.length) {
                for (let i = this.node.nodeValue.length; i < this.offset; i++)
                    extra += "!";
            }
            let id = "";
            if (Util.debugIds)
                id = this.node._nodeId+":";
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

}

function positionSpecial(pos: Position, forwards: boolean, backwards: boolean): Position {
    let node = pos.node;
    let offset = pos.offset;

    let prev = node.childNodes[offset-1];
    let next = node.childNodes[offset];

    // Moving left from the start of a caption - go to the end of the table
    if ((node._type == ElementTypes.HTML_CAPTION) && backwards && (prev == null))
        return new Position(node.parentNode,node.parentNode.childNodes.length);

    // Moving right from the end of a caption - go after the table
    if ((node._type == ElementTypes.HTML_CAPTION) && forwards && (next == null))
        return new Position(node.parentNode.parentNode,DOM.nodeOffset(node.parentNode)+1);

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
            return new Position(next,DOM.nodeOffset(firstChild)+1);
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

// public
export function assertValid(pos: Position, description?: string): void {
    if (description == null)
        description = "Position";

    for (let ancestor = pos.node; ancestor != document.body; ancestor = ancestor.parentNode) {
        if (ancestor == null)
            throw new Error(description+" node "+pos.node.nodeName+" is not in tree");
    }

    let max;
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

// public
export function prev(pos: Position): Position {
    if (pos.node instanceof Element) {
        let r = positionSpecial(pos,false,true);
        if (r != null)
            return r;
        if (pos.offset == 0) {
            return upAndBack(pos);
        }
        else {
            let child = pos.node.childNodes[pos.offset-1];
            return new Position(child,DOM.maxChildOffset(child));
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
            return new Position(pos.node.parentNode,DOM.nodeOffset(pos.node));
    }
}

// public
export function next(pos: Position): Position {
    if (pos.node instanceof Element) {
        let r = positionSpecial(pos,true,false);
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
            return new Position(pos.node.parentNode,DOM.nodeOffset(pos.node)+1);
    }
}

// public
export function trackWhileExecuting<T>(positions: Position[], fun: () => T): T {
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

// public
export function closestActualNode(pos: Position, preferElement?: boolean): Node {
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

// public
export function okForInsertion(pos: Position): boolean {
    return okForMovement(pos,true);
}

function nodeCausesLineBreak(node: Node): boolean {
    return ((node._type == ElementTypes.HTML_BR) || !Types.isInlineNode(node));
}

function spacesUntilNextContent(node: Node): number {
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
                if (nodeCausesLineBreak(node))
                    return null;
            }
            if (node.parentNode == null)
                node = null;
            else
                node = node.parentNode.nextSibling;
        }

        if ((node == null) || nodeCausesLineBreak(node))
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

// public
export function okForMovement(pos: Position, insertion?: boolean): boolean {
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
                     (Traversal.getNodeText(node.previousSibling).match(/\s$/)) ||
                     Types.isItemNumber(node.previousSibling) ||
                     ((precedingText.length > 0))));
        }

        let followingText = value.substring(offset);
        if (Util.isWhitespaceString(followingText)) {
            return (havePrevChar &&
                    ((node.nextSibling == null) ||
                     Types.isNoteNode(node.nextSibling) ||
                     (followingText.length > 0) ||
                     (spacesUntilNextContent(node) != 0)));
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
        if (((nextNode == null) || !Util.nodeHasContent(nextNode)) && prevIsNote)
            return true;
        if (((prevNode == null) || !Util.nodeHasContent(prevNode)) && nextIsNote)
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

export function prevMatch(pos: Position, fun: (pos: Position) => boolean): Position {
    do {
        pos = prev(pos);
    } while ((pos != null) && !fun(pos));
    return pos;
}

export function nextMatch(pos: Position, fun: (pos: Position) => boolean): Position {
    do {
        pos = next(pos);
    } while ((pos != null) && !fun(pos));
    return pos;
}

function findEquivalentValidPosition(pos: Position, fun: (pos: Position) => boolean): Position {
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

// public
export function closestMatchForwards(pos: Position, fun: (pos: Position) => boolean): Position {
    if (pos == null)
        return null;

    if (!fun(pos))
        pos = findEquivalentValidPosition(pos,fun);

    if (fun(pos))
        return pos;

    let next = nextMatch(pos,fun);
    if (next != null)
        return next;

    let prev = prevMatch(pos,fun);
    if (prev != null)
        return prev;

    return new Position(document.body,document.body.childNodes.length);
}

// public
export function closestMatchBackwards(pos: Position, fun: (pos: Position) => boolean): Position {
    if (pos == null)
        return null;

    if (!fun(pos))
        pos = findEquivalentValidPosition(pos,fun);

    if (fun(pos))
        return pos;

    let prev = prevMatch(pos,fun);
    if (prev != null)
        return prev;

    let next = nextMatch(pos,fun);
    if (next != null)
        return next;

    return new Position(document.body,0);
}

export function track(pos: Position): void {
    pos.startTracking();
}

export function untrack(pos: Position): void {
    pos.stopTracking();
}

export function rectAtPos(pos: Position): ClientRect {
    if (pos == null)
        return null;
    let range = new Range.Range(pos.node,pos.offset,pos.node,pos.offset);
    let rects = Range.getClientRects(range);

    if ((rects.length > 0) && !Util.rectIsEmpty(rects[0])) {
        return rects[0];
    }

    let node = pos.node;
    if ((node instanceof Element) && Types.isParagraphNode(node) && (pos.offset == 0)) {
        let rect = node.getBoundingClientRect();
        if (!Util.rectIsEmpty(rect))
            return rect;
    }

    return null;
}

function posAtStartOfParagraph(pos: Position, paragraph): boolean {
    return ((pos.node == paragraph.node) &&
            (pos.offset == paragraph.startOffset));
}

function posAtEndOfParagraph(pos: Position, paragraph): boolean {
    return ((pos.node == paragraph.node) &&
            (pos.offset == paragraph.endOffset));
}

function zeroWidthRightRect(rect: ClientRect): ClientRect {
    return { left: rect.right, // 0 width
             right: rect.right,
             top: rect.top,
             bottom: rect.bottom,
             width: 0,
             height: rect.height };
}

function zeroWidthLeftRect(rect: ClientRect): ClientRect {
    return { left: rect.left,
             right: rect.left, // 0 width
             top: rect.top,
             bottom: rect.bottom,
             width: 0,
             height: rect.height };
}

function zeroWidthMidRect(rect: ClientRect): ClientRect {
    let mid = rect.left + rect.width/2;
    return { left: mid,
             right: mid, // 0 width
             top: rect.top,
             bottom: rect.bottom,
             width: 0,
             height: rect.height };
}

export function noteAncestor(pos: Position): Element {
    let node = closestActualNode(pos);
    for (; node != null; node = node.parentNode) {
        if ((node instanceof Element) && Types.isNoteNode(node))
            return node;
    }
    return null;
}

export function captionAncestor(pos: Position): Element {
    let node = closestActualNode(pos);
    for (; node != null; node = node.parentNode) {
        if ((node instanceof Element) &&
            ((node._type == ElementTypes.HTML_FIGCAPTION) || (node._type == ElementTypes.HTML_CAPTION)))
            return node;
    }
    return null;
}

export function figureOrTableAncestor(pos: Position): Element {
    let node = closestActualNode(pos);
    for (; node != null; node = node.parentNode) {
        if ((node instanceof Element) &&
            ((node._type == ElementTypes.HTML_FIGURE) || (node._type == ElementTypes.HTML_TABLE)))
            return node;
    }
    return null;
}

function exactRectAtPos(pos: Position): ClientRect {
    let node = pos.node;
    let offset = pos.offset;

    if (node instanceof Element) {
        if (offset > node.childNodes.length)
            throw new Error("Invalid offset: "+offset+" of "+node.childNodes.length);

        let before = node.childNodes[offset-1];
        let after = node.childNodes[offset];

        // Cursor is immediately before table -> return table rect
        if ((before != null) && (before instanceof Element) && Types.isSpecialBlockNode(before))
            return zeroWidthRightRect(before.getBoundingClientRect());

        // Cursor is immediately after table -> return table rect
        else if ((after != null) && (after instanceof Element) && Types.isSpecialBlockNode(after))
            return zeroWidthLeftRect(after.getBoundingClientRect());

        // Start of empty paragraph
        if ((node instanceof Element) && (offset == 0) &&
            Types.isParagraphNode(node) && !Util.nodeHasContent(node)) {
            return zeroWidthLeftRect(node.getBoundingClientRect());
        }

        return null;
    }
    else if (node instanceof Text) {
        // First see if the client rects returned by the range gives us a valid value. This
        // won't be the case if the cursor is surrounded by both sides on whitespace.
        let result = rectAtRightOfRange(new Range.Range(node,offset,node,offset));
        if (result != null)
            return result;

        if (offset > 0) {
            // Try and get the rect of the previous character; the cursor goes after that
            let result = rectAtRightOfRange(new Range.Range(node,offset-1,node,offset));
            if (result != null)
                return result;
        }

        return null;
    }
    else {
        return null;
    }

    function rectAtRightOfRange(range: Range.Range): ClientRect {
        let rects = Range.getClientRects(range);
        if ((rects == null) || (rects.length == 0) || (rects[rects.length-1].height == 0))
            return null;
        return zeroWidthRightRect(rects[rects.length-1]);
    }
}

function tempSpaceRect(parentNode: Node, nextSibling: Node): ClientRect {
    let space = DOM.createTextNode(document,String.fromCharCode(160));
    DOM.insertBefore(parentNode,space,nextSibling);
    let range = new Range.Range(space,0,space,1);
    let rects = Range.getClientRects(range);
    DOM.deleteNode(space);
    if (rects.length > 0)
        return rects[0];
    else
        return null;
}

export function displayRectAtPos(pos: Position): ClientRect {
    let rect = exactRectAtPos(pos);
    if (rect != null)
        return rect;

    let noteNode = noteAncestor(pos);
    if ((noteNode != null) && !Util.nodeHasContent(noteNode)) // In empty footnote or endnote
        return zeroWidthMidRect(noteNode.getBoundingClientRect());

    // If we're immediately before or after a footnote or endnote, calculate the rect by
    // temporarily inserting a space character, and getting the rect at the start of that.
    // This avoids us instead getting a rect inside the note, which is what would otherwise
    // happen if there was no adjacent text node outside the note.
    if ((pos.node instanceof Element)) {
        let before = pos.node.childNodes[pos.offset-1];
        let after = pos.node.childNodes[pos.offset];
        if (((before != null) && Types.isNoteNode(before)) ||
            ((after != null) && Types.isNoteNode(after))) {
            let rect = tempSpaceRect(pos.node,pos.node.childNodes[pos.offset]);
            if (rect != null)
                return zeroWidthLeftRect(rect);
        }
    }

    let captionNode = captionAncestor(pos);
    if ((captionNode != null) && !Util.nodeHasContent(captionNode)) {
        // Even if an empty caption has generated content (e.g. "Figure X: ") preceding it,
        // we can't directly get the rect of that generated content. So we temporarily insert
        // a text node containing a single space character, get the position to the right of
        // that character, and then remove the text node.
        let rect = tempSpaceRect(captionNode,null);
        if (rect != null)
            return zeroWidthRightRect(rect);
    }

    let paragraph = Txt.findParagraphBoundaries(pos);

    let backRect = null;
    for (let backPos = pos; backPos != null; backPos = prev(backPos)) {
        backRect = exactRectAtPos(backPos);
        if ((backRect != null) || posAtStartOfParagraph(backPos,paragraph))
            break;
    }

    let forwardRect = null;
    for (let forwardPos = pos; forwardPos != null; forwardPos = next(forwardPos)) {
        forwardRect = exactRectAtPos(forwardPos);
        if ((forwardRect != null) || posAtEndOfParagraph(forwardPos,paragraph))
            break;
    }

    if (backRect != null) {
        return backRect;
    }
    else if (forwardRect != null) {
        return forwardRect;
    }
    else {
        // Fallback, e.g. for empty LI elements
        let node = pos.node;
        if (node instanceof Text)
            node = node.parentNode;
        if (!(node instanceof Element)) // Should never happen; just here for the type guard
            throw new Error("Expected element node; got "+node.nodeType);
        else
            return zeroWidthLeftRect(node.getBoundingClientRect());
    }
}

export function equal(a: Position, b: Position): boolean {
    if ((a == null) && (b == null))
        return true;
    if ((a != null) && (b != null) &&
        (a.node == b.node) && (a.offset == b.offset))
        return true;
    return false;
}

export function preferTextPosition(pos: Position): Position {
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

export function preferElementPosition(pos: Position): Position {
    if (pos.node instanceof Text) {
        if (pos.node.parentNode == null)
            throw new Error("Position "+pos+" has no parent node");
        if (pos.offset == 0)
            return new Position(pos.node.parentNode,DOM.nodeOffset(pos.node));
        if (pos.offset == pos.node.nodeValue.length)
            return new Position(pos.node.parentNode,DOM.nodeOffset(pos.node)+1);
    }
    return pos;
}

export function compare(first: Position, second: Position): number {
    if ((first.node == second.node) && (first.offset == second.offset))
        return 0;

    let doc = first.node.ownerDocument;
    if ((first.node.parentNode == null) && (first.node != doc.documentElement))
        throw new Error("First node has been removed from document");
    if ((second.node.parentNode == null) && (second.node != doc.documentElement))
        throw new Error("Second node has been removed from document");

    if (first.node == second.node)
        return first.offset - second.offset;

    let firstParent = null;
    let firstChild = null;
    let secondParent = null;
    let secondChild = null;

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

// This function works around a bug in WebKit where caretRangeFromPoint sometimes returns an
// incorrect node (the last text node in the document). In a previous attempt to fix this bug,
// we first checked if the point was in the elements bounding rect, but this meant that it
// wasn't possible to place the cursor at the nearest node, if the click location was not
// exactly on a node.

// Now we instead check to see if the result of elementFromPoint is the same as the parent node
// of the text node returned by caretRangeFromPoint. If it isn't, then we assume that the latter
// result is incorrect, and return null.

// In the circumstances where this bug was observed, the last text node in the document was
// being returned from caretRangeFromPoint in some cases. In the typical case, this is going to
// be inside a paragraph node, but elementNodeFromPoint was returning the body element. The
// check we do now comparing the results of the two functions fixes this case, but won't work as
// intended if the document's last text node is a direct child of the body (as it may be in some
// HTML documents that users open).

function posOutsideSelection(pos: Position): Position {
    pos = preferElementPosition(pos);

    if (!Types.isSelectionSpan(pos.node))
        return pos;

    if (pos.offset == 0)
        return new Position(pos.node.parentNode,DOM.nodeOffset(pos.node));
    else if (pos.offset == pos.node.childNodes.length)
        return new Position(pos.node.parentNode,DOM.nodeOffset(pos.node)+1);
    else
        return pos;
}

export function atPoint(x: number, y: number): Position {
    // In general, we can use document.caretRangeFromPoint(x,y) to determine the location of the
    // cursor based on screen coordinates. However, this doesn't work if the screen coordinates
    // are outside the bounding box of the document's body. So when this is true, we find either
    // the first or last non-whitespace text node, calculate a y value that is half-way between
    // the top and bottom of its first or last rect (respectively), and use that instead. This
    // results in the cursor being placed on the first or last line when the user taps outside
    // the document bounds.

    let bodyRect = document.body.getBoundingClientRect();
    let boundaryRect = null;
    if (y <= bodyRect.top)
        boundaryRect = findFirstTextRect();
    else if (y >= bodyRect.bottom)
        boundaryRect = findLastTextRect();

    if (boundaryRect != null)
        y = boundaryRect.top + boundaryRect.height/2;

    // We get here if the coordinates are inside the document's bounding rect, or if getting the
    // position from the first or last rect failed for some reason.

    let range = document.caretRangeFromPoint(x,y);
    if (range == null)
        return null;

    let pos = new Position(range.startContainer,range.startOffset);
    pos = preferElementPosition(pos);

    if (pos.node instanceof Element) {
        let outside = posOutsideSelection(pos);
        let prev = outside.node.childNodes[outside.offset-1];
        let next = outside.node.childNodes[outside.offset];

        if ((prev != null) && (prev instanceof Element) &&
            nodeMayContainPos(prev) && elementContainsPoint(prev,x,y))
            return new Position(prev,0);

        if ((next != null) && (next instanceof Element) &&
            nodeMayContainPos(next) && elementContainsPoint(next,x,y))
            return new Position(next,0);

        if (next != null) {
            let nextNode = outside.node;
            let nextOffset = outside.offset+1;

            if (Types.isSelectionSpan(next) && (next.firstChild != null)) {
                nextNode = next;
                nextOffset = 1;
                next = next.firstChild;
            }

            if ((next != null) && (next instanceof Element) && Types.isEmptyNoteNode(next)) {
                let rect = next.getBoundingClientRect();
                if (x > rect.right)
                    return new Position(nextNode,nextOffset);
            }
        }
    }

    pos = adjustPositionForFigure(pos);

    return pos;
}

// This is used for nodes that can potentially be the right match for a hit test, but for
// which caretRangeFromPoint() returns the wrong result
function nodeMayContainPos(node: Node): boolean {
    return ((node._type == ElementTypes.HTML_IMG) || Types.isEmptyNoteNode(node));
}

function elementContainsPoint(element: Element, x: number, y: number): boolean {
    let rect = element.getBoundingClientRect();
    return ((x >= rect.left) && (x <= rect.right) &&
            (y >= rect.top) && (y <= rect.bottom));
}

function isEmptyParagraphNode(node: Node): boolean {
    return ((node._type == ElementTypes.HTML_P) &&
            (node.lastChild != null) &&
            (node.lastChild._type == ElementTypes.HTML_BR) &&
            !Util.nodeHasContent(node));
}

function findLastTextRect(): ClientRect {
    let node = Traversal.lastDescendant(document.body);

    while ((node != null) &&
           (!(node instanceof Text) || Traversal.isWhitespaceTextNode(node))) {
        if (isEmptyParagraphNode(node))
            return node.getBoundingClientRect();
        node = Traversal.prevNode(node);
    }

    if (node != null) {
        let domRange = document.createRange();
        domRange.setStart(node,0);
        domRange.setEnd(node,node.nodeValue.length);
        let rects = domRange.getClientRects();
        if ((rects != null) && (rects.length > 0))
            return rects[rects.length-1];
    }
    return null;
}

function findFirstTextRect(): ClientRect {
    let node = Traversal.firstDescendant(document.body);

    while ((node != null) &&
           (!(node instanceof Text) || Traversal.isWhitespaceTextNode(node))) {
        if (isEmptyParagraphNode(node))
            return node.getBoundingClientRect();
        node = Traversal.nextNode(node);
    }

    if (node != null) {
        let domRange = document.createRange();
        domRange.setStart(node,0);
        domRange.setEnd(node,node.nodeValue.length);
        let rects = domRange.getClientRects();
        if ((rects != null) && (rects.length > 0))
            return rects[0];
    }
    return null;
}

function adjustPositionForFigure(position: Position): Position {
    if (position == null)
        return null;
    if (position.node._type == ElementTypes.HTML_FIGURE) {
        let prev = position.node.childNodes[position.offset-1];
        let next = position.node.childNodes[position.offset];
        if ((prev != null) && (prev._type == ElementTypes.HTML_IMG)) {
            position = new Position(position.node.parentNode,
                                    DOM.nodeOffset(position.node)+1);
        }
        else if ((next != null) && (next._type == ElementTypes.HTML_IMG)) {
            position = new Position(position.node.parentNode,
                                    DOM.nodeOffset(position.node));
        }
    }
    return position;
}
