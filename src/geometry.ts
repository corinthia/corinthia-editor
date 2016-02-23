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
import Position = require("./position");
import Range = require("./range");
import Traversal = require("./traversal");
import Txt = require("./text");
import Types = require("./types");
import Util = require("./util");

export function rectAtPos(pos: Position): ClientRect {
    if (pos == null)
        return null;
    let range = new Range(pos.node,pos.offset,pos.node,pos.offset);
    let rects = range.getClientRects();

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

function posAtStartOfParagraph(pos: Position, paragraph: Txt.ParagraphBoundaries): boolean {
    return ((pos.node == paragraph.node) &&
            (pos.offset == paragraph.startOffset));
}

function posAtEndOfParagraph(pos: Position, paragraph: Txt.ParagraphBoundaries): boolean {
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
            Types.isParagraphNode(node) && !Types.nodeHasContent(node)) {
            return zeroWidthLeftRect(node.getBoundingClientRect());
        }

        return null;
    }
    else if (node instanceof Text) {
        // First see if the client rects returned by the range gives us a valid value. This
        // won't be the case if the cursor is surrounded by both sides on whitespace.
        let result = rectAtRightOfRange(new Range(node,offset,node,offset));
        if (result != null)
            return result;

        if (offset > 0) {
            // Try and get the rect of the previous character; the cursor goes after that
            let result = rectAtRightOfRange(new Range(node,offset-1,node,offset));
            if (result != null)
                return result;
        }

        return null;
    }
    else {
        return null;
    }

    function rectAtRightOfRange(range: Range): ClientRect {
        let rects = range.getClientRects();
        if ((rects == null) || (rects.length == 0) || (rects[rects.length-1].height == 0))
            return null;
        return zeroWidthRightRect(rects[rects.length-1]);
    }
}

function tempSpaceRect(parentNode: Node, nextSibling: Node): ClientRect {
    let space = DOM.createTextNode(document,String.fromCharCode(160));
    DOM.insertBefore(parentNode,space,nextSibling);
    let range = new Range(space,0,space,1);
    let rects = range.getClientRects();
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

    let noteNode = pos.noteAncestor();
    if ((noteNode != null) && !Types.nodeHasContent(noteNode)) // In empty footnote or endnote
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

    let captionNode = pos.captionAncestor();
    if ((captionNode != null) && !Types.nodeHasContent(captionNode)) {
        // Even if an empty caption has generated content (e.g. "Figure X: ") preceding it,
        // we can't directly get the rect of that generated content. So we temporarily insert
        // a text node containing a single space character, get the position to the right of
        // that character, and then remove the text node.
        let rect = tempSpaceRect(captionNode,null);
        if (rect != null)
            return zeroWidthRightRect(rect);
    }

    let paragraph = Txt.findParagraphBoundaries(pos);

    let backRect: ClientRect = null;
    for (let backPos = pos; backPos != null; backPos = backPos.prev()) {
        backRect = exactRectAtPos(backPos);
        if ((backRect != null) || posAtStartOfParagraph(backPos,paragraph))
            break;
    }

    let forwardRect: ClientRect = null;
    for (let forwardPos = pos; forwardPos != null; forwardPos = forwardPos.next()) {
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
    pos = pos.preferElementPosition();

    if (!Types.isSelectionSpan(pos.node))
        return pos;

    if (pos.offset == 0)
        return new Position(pos.node.parentNode,Traversal.nodeOffset(pos.node));
    else if (pos.offset == pos.node.childNodes.length)
        return new Position(pos.node.parentNode,Traversal.nodeOffset(pos.node)+1);
    else
        return pos;
}

export function positionAtPoint(x: number, y: number): Position {

    return atPoint(x,y);

    function atPoint(x: number, y: number): Position {
        // In general, we can use document.caretRangeFromPoint(x,y) to determine the location of the
        // cursor based on screen coordinates. However, this doesn't work if the screen coordinates
        // are outside the bounding box of the document's body. So when this is true, we find either
        // the first or last non-whitespace text node, calculate a y value that is half-way between
        // the top and bottom of its first or last rect (respectively), and use that instead. This
        // results in the cursor being placed on the first or last line when the user taps outside
        // the document bounds.

        let bodyRect = document.body.getBoundingClientRect();
        let boundaryRect: ClientRect = null;
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
        pos = pos.preferElementPosition();

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
                !Types.nodeHasContent(node));
    }

    function findLastTextRect(): ClientRect {
        let node = Traversal.lastDescendant(document.body);

        while ((node != null) &&
               (!(node instanceof Text) || Traversal.isWhitespaceTextNode(node))) {
            if ((node instanceof HTMLElement) && isEmptyParagraphNode(node))
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
            if ((node instanceof HTMLElement) && isEmptyParagraphNode(node))
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
                                                 Traversal.nodeOffset(position.node)+1);
            }
            else if ((next != null) && (next._type == ElementTypes.HTML_IMG)) {
                position = new Position(position.node.parentNode,
                                                 Traversal.nodeOffset(position.node));
            }
        }
        return position;
    }

}
