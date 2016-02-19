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

import Clipboard = require("./clipboard");
import DOM = require("./dom");
import ElementTypes = require("./elementTypes");
import Formatting = require("./formatting");
import Hierarchy = require("./hierarchy");
import Outline = require("./outline");
import Position = require("./position");
import Range = require("./range");
import Selection = require("./selection");
import Styles = require("./styles");
import Traversal = require("./traversal");
import Types = require("./types");
import UndoManager = require("./undo");
import Util = require("./util");

// FIXME: this variable is unused
let cursorX: number = null;

export function ensurePositionVisible(pos: Position.Position, center?: boolean): void {
    // If we can't find the cursor rect for some reason, just don't do anything.
    // This is better than using an incorrect position or throwing an exception.
    let rect = Position.displayRectAtPos(pos)
    if (rect != null) {
        let extraSpace = 4;

        let cursorTop = rect.top + window.scrollY - extraSpace;
        let cursorBottom = rect.top + rect.height + window.scrollY + extraSpace;

        let windowTop = window.scrollY;
        let windowBottom = window.scrollY + window.innerHeight;

        if (center) {
            let newY = Math.floor(cursorTop + rect.height/2 - window.innerHeight/2);
            window.scrollTo(window.scrollX,newY);
        }
        else if (cursorTop < windowTop) {
            window.scrollTo(window.scrollX,cursorTop);
        }
        else if (cursorBottom > windowBottom) {
            window.scrollTo(window.scrollX,cursorBottom - window.innerHeight);
        }
    }
}

// public
export function ensureCursorVisible(center?: boolean): void {
    let selRange = Selection.get();
    if (selRange != null)
        ensurePositionVisible(selRange.end,center);
}

export function scrollDocumentForY(y: number): number {
    let absY = window.scrollY + y;
    if (absY-44 < window.scrollY) {
        window.scrollTo(window.scrollX,absY-44);
        y = absY - window.scrollY;
    }
    else if (absY+44 >= window.scrollY + window.innerHeight) {
        window.scrollTo(window.scrollX,absY+44 - window.innerHeight);
        y = absY - window.scrollY;
    }
    return y;
}

// public
export function positionCursor(x: number, y: number, wordBoundary: boolean): string {
    if (UndoManager.groupType() != "Cursor movement")
        UndoManager.newGroup("Cursor movement");

    y = scrollDocumentForY(y);

    let result: string = null;
    let position = Position.atPoint(x,y);
    if (position == null)
        return null;

    let node = Position.closestActualNode(position);
    for (; node != null; node = node.parentNode) {
        let type = node._type;
        if ((node instanceof Element) &&
            (type == ElementTypes.HTML_A) &&
            (node.hasAttribute("href")) &&
            (result == null)) {

            let arange = new Range.Range(node,0,node,node.childNodes.length);
            let rects = Range.getClientRects(arange);
            let insideLink = false;
            for (let i = 0; i < rects.length; i++) {
                if (Util.rectContainsPoint(rects[i],x,y))
                    insideLink = true;
            }

            if (insideLink) {
                let href = node.getAttribute("href");
                if ((href != null) && (href.charAt(0) == "#")) {
                    if (Types.isInTOC(node))
                        result = "intocreference-"+href.substring(1);
                    else
                        result = "inreference";
                }
                else {
                    result = "inlink";
                }
            }
        }
        else if ((type == ElementTypes.HTML_IMG) && (result == null)) {
            for (let anc = node; anc != null; anc = anc.parentNode) {
                if (anc._type == ElementTypes.HTML_FIGURE) {
                    result = "infigure";
                    break;
                }
            }
        }
        else if (Types.isAutoCorrectNode(node) && (result == null)) {
            result = "incorrection";
        }
        else if ((node instanceof Element) && Types.isTOCNode(node)) {
            let rect = node.getBoundingClientRect();
            if (x >= rect.left + rect.width/2)
                position = new Position.Position(node.parentNode,DOM.nodeOffset(node)+1);
            else
                position = new Position.Position(node.parentNode,DOM.nodeOffset(node));
            break;
        }
    }

    position = Position.closestMatchForwards(position,Position.okForMovement);
    if ((position != null) && Types.isOpaqueNode(position.node))
        position = Position.nextMatch(position,Position.okForMovement);
    if (position == null)
        return null;

    let selectionRange = Selection.get();
    let samePosition = ((selectionRange != null) && Range.isEmpty(selectionRange) &&
                        (position.node == selectionRange.start.node) &&
                        (position.offset == selectionRange.start.offset));
    if (samePosition && (result == null))
        result = "same";

    if (wordBoundary) {
        let startOfWord = Selection.posAtStartOfWord(position);
        let endOfWord = Selection.posAtEndOfWord(position);
        if ((startOfWord.node != position.node) || (startOfWord.node != position.node))
            throw new Error("Word boundary in different node");
        let distanceBefore = position.offset - startOfWord.offset;
        let distanceAfter = endOfWord.offset - position.offset;
        if (distanceBefore <= distanceAfter)
            position = startOfWord;
        else
            position = endOfWord;
    }

    set(position.node,position.offset);
    return result;
}

// public
export function getCursorPosition(): ClientRect {
    let selRange = Selection.get();
    if (selRange == null)
        return null;

    // FIXME: in the cases where this is called from Objective C, test what happens if we
    // return a null rect
    let rect = Position.displayRectAtPos(selRange.end);
    if (rect == null)
        return null;

    let left = rect.left + window.scrollX;
    let top = rect.top + window.scrollY;
    let height = rect.height;
    let width = 0;
    return {
        left: left,
        top: top,
        right: left + width,
        bottom: top + height,
        width: 0,
        height: height
    };
}

// public
export function moveLeft(): void {
    let range = Selection.get();
    if (range == null)
        return;

    let pos = Position.prevMatch(range.start,Position.okForMovement);
    if (pos != null)
        set(pos.node,pos.offset);
    ensureCursorVisible();
}

// public
export function moveRight(): void {
    let range = Selection.get();
    if (range == null)
        return;

    let pos = Position.nextMatch(range.start,Position.okForMovement);
    if (pos != null)
        set(pos.node,pos.offset);
    ensureCursorVisible();
}

// public
export function moveToStartOfDocument(): void {
    let pos = new Position.Position(document.body,0);
    pos = Position.closestMatchBackwards(pos,Position.okForMovement);
    set(pos.node,pos.offset);
    ensureCursorVisible();
}

// public
export function moveToEndOfDocument(): void {
    let pos = new Position.Position(document.body,document.body.childNodes.length);
    pos = Position.closestMatchForwards(pos,Position.okForMovement);
    set(pos.node,pos.offset);
    ensureCursorVisible();
}

// An empty paragraph does not get shown and cannot be edited. We can fix this by adding
// a BR element as a child
// public
export function updateBRAtEndOfParagraph(node: Node): void {
    let paragraph = node;
    while ((paragraph != null) && !Types.isParagraphNode(paragraph))
        paragraph = paragraph.parentNode;
    if (paragraph != null) {

        let br: Node = null;
        let last = paragraph;
        do {

            let child = last;
            while ((child != null) && Traversal.isWhitespaceTextNode(child))
                child = child.previousSibling;

            if ((child != null) && (child._type == ElementTypes.HTML_BR))
                br = child;

            last = last.lastChild;

        } while ((last != null) && Types.isInlineNode(last));

        if (Util.nodeHasContent(paragraph)) {
            // Paragraph has content: don't want BR at end
            if (br != null) {
                DOM.deleteNode(br);
            }
        }
        else {
            // Paragraph consists only of whitespace: must have BR at end
            if (br == null) {
                br = DOM.createElement(document,"BR");
                DOM.appendChild(paragraph,br);
            }
        }
    }
}

// public
export function insertReference(itemId: string): void {
    let a = DOM.createElement(document,"A");
    DOM.setAttribute(a,"href","#"+itemId);
    Clipboard.pasteNodes([a]);
}

// public
export function insertLink(text: string, url: string): void {
    let a = DOM.createElement(document,"A");
    DOM.setAttribute(a,"href",url);
    DOM.appendChild(a,DOM.createTextNode(document,text));
    Clipboard.pasteNodes([a]);
}

let nbsp = String.fromCharCode(160);

function spaceToNbsp(pos: Position.Position): void {
    let node = pos.node;
    let offset = pos.offset;

    if ((node instanceof Text) && (offset > 0) &&
        (Util.isWhitespaceString(node.nodeValue.charAt(offset-1)))) {
        // Insert first, to preserve any tracked positions
        DOM.insertCharacters(node,offset-1,nbsp);
        DOM.deleteCharacters(node,offset,offset+1);
    }
}

function nbspToSpace(pos: Position.Position): void {
    let node = pos.node;
    let offset = pos.offset;

    if ((node instanceof Text) && (offset > 0) &&
        (node.nodeValue.charAt(offset-1) == nbsp)) {
        // Insert first, to preserve any tracked positions
        DOM.insertCharacters(node,offset-1," ");
        DOM.deleteCharacters(node,offset,offset+1);
    }
}

function checkNbsp(): void {
    Selection.preserveWhileExecuting(function() {
        let selRange = Selection.get();
        if (selRange != null)
            nbspToSpace(selRange.end);
    });
}

function isPosAtStartOfParagraph(pos: Position.Position): boolean {
    if ((pos.node instanceof Element) && (pos.offset == 0) &&
        !Types.isInlineNode(pos.node)) {
        return true;
    }

    while (pos != null) {
        if (pos.node instanceof Element) {
            if ((pos.offset == 0) && !Types.isInlineNode(pos.node))
                return true;
            else
                pos = Position.prev(pos);
        }
        else if (pos.node instanceof Text) {
            if (pos.offset > 0)
                return false;
            else
                pos = Position.prev(pos);
        }
        else {
            return false;
        }
    }

    return false;
}

// public
export function insertCharacter(str: string, allowInvalidPos: boolean, allowNoParagraph: boolean): void {
    let firstInsertion = (UndoManager.groupType() != "Insert text");

    if (firstInsertion)
        UndoManager.newGroup("Insert text",checkNbsp);

    if (str == "-") {
        let preceding = getPrecedingWord();
        if (preceding.match(/[0-9]\s*$/))
            str = String.fromCharCode(0x2013); // en dash
        else if (preceding.match(/\s+$/))
            str = String.fromCharCode(0x2014); // em dash
    }

    let selRange = Selection.get();
    if (selRange == null)
        return;

    if (!Range.isEmpty(selRange)) {
        Selection.deleteContents(true);
        selRange = Selection.get();
    }
    let pos = selRange.start;
    pos = Position.preferTextPosition(pos);
    if ((str == " ") && isPosAtStartOfParagraph(pos))
        return;
    if (!allowInvalidPos && !Position.okForInsertion(pos)) {
        let elemPos = Position.preferElementPosition(pos);
        if (Position.okForInsertion(elemPos)) {
            pos = elemPos;
        }
        else {
            let oldPos = pos;
            pos = Position.closestMatchForwards(selRange.start,Position.okForInsertion);
            let difference = new Range.Range(oldPos.node,oldPos.offset,pos.node,pos.offset);
            difference = Range.forwards(difference);
            Position.trackWhileExecuting([pos],function() {
                if (!Range.hasContent(difference)) {
                    Selection.deleteRangeContents(difference,true);
                }
            });
        }
    }
    let node = pos.node;
    let offset = pos.offset;

    if ((str == " ") &&
        !firstInsertion &&
        (node instanceof Text) &&
        (offset > 0) &&
        (node.nodeValue.charAt(offset-1) == nbsp)) {

        if (!node.nodeValue.substring(0,offset).match(/\.\s+$/)) {
            DOM.deleteCharacters(node,offset-1,offset);
            DOM.insertCharacters(node,offset-1,".");
        }
    }

    if (Util.isWhitespaceString(str) && (node instanceof Text) && (offset > 0)) {
        let prevChar = node.nodeValue.charAt(offset-1);
        if (Util.isWhitespaceString(prevChar) || (prevChar == nbsp)) {
            Selection.update();
            ensureCursorVisible();
            return;
        }
    }

    nbspToSpace(pos);

    // If the user enters two double quotes in succession (open and close), replace them with
    // just one plain double quote character
    if ((str == "”") && (node instanceof Text) &&
        (offset > 0) && (node.nodeValue.charAt(offset-1) == "“")) {
        DOM.deleteCharacters(node,offset-1,offset);
        offset--;
        str = "\"";
    }

    let textNode: Text = null;

    if (node instanceof Text) {
        textNode = <Text>node; // FIXME: TS: Compiler should allow this due to type guard
    }
    else {
        textNode = DOM.createTextNode(document,"");
        if (offset >= node.childNodes.length)
            DOM.appendChild(node,textNode);
        else
            DOM.insertBefore(node,textNode,node.childNodes[offset]);
        node = textNode;
        offset = 0;
    }

    if (str == " ")
        DOM.insertCharacters(textNode,offset,nbsp);
    else
        DOM.insertCharacters(textNode,offset,str);

            // must be done *after* inserting the text
    if (!allowNoParagraph) {
        switch (node.parentNode._type) {
        case ElementTypes.HTML_CAPTION:
        case ElementTypes.HTML_FIGCAPTION:
            // Do nothing
            break;
        default:
            Hierarchy.ensureInlineNodesInParagraph(node,true);
            break;
        }
    }

    offset += str.length;

    pos = new Position.Position(node,offset);
    Position.trackWhileExecuting([pos],function() {
        Formatting.mergeWithNeighbours(pos.node,Formatting.MERGEABLE_INLINE);
    });

    set(pos.node,pos.offset);
    Range.trackWhileExecuting(Selection.get(),function() {
        updateBRAtEndOfParagraph(pos.node);
    });

    Selection.update();
    ensureCursorVisible();
}

function tryDeleteEmptyCaption(pos: Position.Position): boolean {
    let caption = Position.captionAncestor(pos);
    if ((caption == null) || Util.nodeHasContent(caption))
        return false;

    let container = Position.figureOrTableAncestor(pos);
    if (container == null)
        return false;

    set(container.parentNode,DOM.nodeOffset(container)+1);
    Selection.preserveWhileExecuting(function() {
        DOM.deleteNode(caption);
    });

    return true;
}

function tryDeleteEmptyNote(pos: Position.Position): boolean {
    let note = Position.noteAncestor(pos);
    if ((note == null) || Util.nodeHasContent(note))
        return false;

    let parent = note.parentNode;
    set(note.parentNode,DOM.nodeOffset(note)+1);
    Selection.preserveWhileExecuting(function() {
        DOM.deleteNode(note);
    });

    return true;
}

// public
export function deleteCharacter(): void {
    if (UndoManager.groupType() != "Delete text")
        UndoManager.newGroup("Delete text",checkNbsp);

    Selection.preferElementPositions();
    let selRange = Selection.get();
    if (selRange == null)
        return;

    if (!Range.isEmpty(selRange)) {
        Selection.deleteContents(true);
    }
    else {
        let currentPos = selRange.start;

        // Special cases of pressing backspace after a table, figure, TOC, hyperlink,
        // footnote, or endnote. For each of these we delete the whole thing.
        let back = Position.closestMatchBackwards(currentPos,Position.okForMovement);
        if ((back != null) && (back.node instanceof Element) && (back.offset > 0)) {
            let prevNode = back.node.childNodes[back.offset-1];
            if (Types.isSpecialBlockNode(prevNode)) {
                let p = DOM.createElement(document,"P");
                DOM.insertBefore(prevNode.parentNode,p,prevNode);
                DOM.deleteNode(prevNode);
                updateBRAtEndOfParagraph(p);
                set(p,0);
                ensureCursorVisible();
                return;
            }
            if ((prevNode._type == ElementTypes.HTML_A) || Types.isNoteNode(prevNode)) {
                set(back.node,back.offset-1);
                Selection.preserveWhileExecuting(function() {
                    DOM.deleteNode(prevNode);
                });
                return;
            }
        }

        // Backspace inside an empty figure or table caption
        if (tryDeleteEmptyCaption(currentPos))
            return;

        currentPos = Position.preferTextPosition(currentPos);
        let prevPos = Position.prevMatch(currentPos,Position.okForMovement);

        // Backspace inside or just after a footnote or endnote
        if (tryDeleteEmptyNote(currentPos))
            return;
        if ((prevPos != null) && tryDeleteEmptyNote(prevPos))
            return;

        if (prevPos != null) {
            let startBlock = firstBlockAncestor(Position.closestActualNode(prevPos));
            let endBlock = firstBlockAncestor(Position.closestActualNode(selRange.end));
            if ((startBlock != endBlock) &&
                Types.isParagraphNode(startBlock) && !Util.nodeHasContent(startBlock)) {
                DOM.deleteNode(startBlock);
                set(selRange.end.node,selRange.end.offset)
            }
            else {
                let range = new Range.Range(prevPos.node,prevPos.offset,
                                      selRange.end.node,selRange.end.offset);
                Selection.deleteRangeContents(range,true);
            }
        }
    }

    selRange = Selection.get();
    if (selRange != null)
        spaceToNbsp(selRange.end);
    Selection.update();
    ensureCursorVisible();

    function firstBlockAncestor(node: Node): Node {
        while (Types.isInlineNode(node))
            node = node.parentNode;
        return node;
    }
}

// public
export function enterPressed(): void {
    UndoManager.newGroup("New paragraph");

    Selection.preferElementPositions();
    let selRange = Selection.get();
    if (selRange == null)
        return;

    Range.trackWhileExecuting(selRange,function() {
        if (!Range.isEmpty(selRange))
            Selection.deleteContents(true);
    });

    // Are we inside a figure or table caption? If so, put an empty paragraph directly after it
    let inCaption = false;
    let inFigCaption = false;
    let closestNode = Position.closestActualNode(selRange.start);
    for (let ancestor = closestNode; ancestor != null; ancestor = ancestor.parentNode) {
        switch (ancestor._type) {
        case ElementTypes.HTML_CAPTION:
            inCaption = true;
            break;
        case ElementTypes.HTML_FIGCAPTION:
            inFigCaption = true;
            break;
        case ElementTypes.HTML_TABLE:
        case ElementTypes.HTML_FIGURE:
            if ((inCaption && (ancestor._type == ElementTypes.HTML_TABLE)) ||
                (inFigCaption && (ancestor._type == ElementTypes.HTML_FIGURE))) {
                let p = DOM.createElement(document,"P");
                DOM.insertBefore(ancestor.parentNode,p,ancestor.nextSibling);
                updateBRAtEndOfParagraph(p);
                Selection.set(p,0,p,0);
                return;
            }
            break;
        }
    }

    // Are we inside a footnote or endnote? If so, move the cursor immediately after it
    let note: HTMLElement = null;
    if (selRange.start.node instanceof Text) {
        note = Position.noteAncestor(selRange.start);
    }
    else {
        // We can't use Position.noteAncestor in this case, because we want to to break
        // the paragraph *before* the note, not after
        let checkNode = selRange.start.node;
        for (let anc = checkNode; anc != null; anc = anc.parentNode) {
            if ((anc instanceof HTMLElement) && Types.isNoteNode(anc)) {
                note = anc;
                break;
            }
        }
    }
    if (note != null) {
        let noteOffset = DOM.nodeOffset(note);
        selRange = new Range.Range(note.parentNode,noteOffset+1,note.parentNode,noteOffset+1);
    }

    let check = Position.preferElementPosition(selRange.start);
    if (check.node instanceof Element) {
        let before = check.node.childNodes[check.offset-1];
        let after = check.node.childNodes[check.offset];
        if (((before != null) && Types.isSpecialBlockNode(before)) ||
            ((after != null) && Types.isSpecialBlockNode(after))) {
            let p = DOM.createElement(document,"P");
            DOM.insertBefore(check.node,p,check.node.childNodes[check.offset]);
            updateBRAtEndOfParagraph(p);
            set(p,0);
            ensureCursorVisible();
            return;
        }
    }

    Range.trackWhileExecuting(selRange,function() {
        Range.ensureInlineNodesInParagraph(selRange);
        Range.ensureValidHierarchy(selRange);
    });

    let pos = selRange.start;

    let detail = Range.detail(selRange);
    switch (detail.startParent._type) {
    case ElementTypes.HTML_OL:
    case ElementTypes.HTML_UL: {
        let li = DOM.createElement(document,"LI");
        DOM.insertBefore(detail.startParent,li,detail.startChild);

        set(li,0);
        ensureCursorVisible();
        return;
    }
    }

    if (Types.isAutoCorrectNode(pos.node)) {
        pos = Position.preferTextPosition(pos);
        selRange.start = selRange.end = pos;
    }

    Range.trackWhileExecuting(selRange,function() {

        // If we're directly in a container node, add a paragraph, so we have something to
        // split.
        if (Types.isContainerNode(pos.node) && (pos.node._type != ElementTypes.HTML_LI)) {
            let p = DOM.createElement(document,"P");
            DOM.insertBefore(pos.node,p,pos.node.childNodes[pos.offset]);
            pos = new Position.Position(p,0);
        }

        let blockToSplit = getBlockToSplit(pos);
        let stopAt = blockToSplit.parentNode;

        if (positionAtStartOfHeading(pos)) {
            let container = getContainerOrParagraph(pos.node);
            pos = new Position.Position(container,0);
            pos = Formatting.movePreceding(pos,function(n) { return (n == stopAt); },true);
        }
        else if (pos.node instanceof Text) {
            pos = Formatting.splitTextAfter(pos,function(n) { return (n == stopAt); },true);
        }
        else {
            pos = Formatting.moveFollowing(pos,function(n) { return (n == stopAt); },true);
        }
    });

    set(pos.node,pos.offset);
    selRange = Selection.get();

    Range.trackWhileExecuting(selRange,function() {
        if ((pos.node instanceof Text) && (pos.node.nodeValue.length == 0)) {
            DOM.deleteNode(pos.node);
        }

        let detail = Range.detail(selRange);
        let prev: Node = null;

        // If a preceding paragraph has become empty as a result of enter being pressed
        // while the cursor was in it, then update the BR at the end of the paragraph
        let start = detail.startChild ? detail.startChild : detail.startParent;
        for (let ancestor = start; ancestor != null; ancestor = ancestor.parentNode) {
            prev = ancestor.previousSibling;
            if ((prev != null) && Types.isParagraphNode(prev) && !Util.nodeHasContent(prev)) {
                DOM.deleteAllChildren(prev);
                updateBRAtEndOfParagraph(prev);
                break;
            }
            else if ((prev != null) && (prev._type == ElementTypes.HTML_LI) && !Util.nodeHasContent(prev)) {
                let next: Node;
                for (let child = prev.firstChild; child != null; child = next) {
                    next = child.nextSibling;
                    if (Traversal.isWhitespaceTextNode(child))
                        DOM.deleteNode(child);
                    else
                        updateBRAtEndOfParagraph(child);
                }
                break;
            }
        }

        for (let ancestor = start; ancestor != null; ancestor = ancestor.parentNode) {

            let newAncestor: Element = null;

            if ((ancestor instanceof HTMLElement) && Types.isParagraphNode(ancestor)) {
                let nextSelector = Styles.nextSelectorAfter(ancestor);
                if (nextSelector != null) {
                    let nextElementName: string = null;
                    let nextClassName: string = null;


                    let dotIndex = nextSelector.indexOf(".");
                    if (dotIndex >= 0) {
                        nextElementName = nextSelector.substring(0,dotIndex);
                        nextClassName = nextSelector.substring(dotIndex+1);
                    }
                    else {
                        nextElementName = nextSelector;
                    }

                    // FIXME: TS: There is a bug in the compiler that causes the typeguard
                    // above (ancestor instanceof Element) to fail if we assign to ancestor
                    // below (even if it's at the end of this block). To get around this, we
                    // use newAncestor as a temporary variable, and then assign it after the
                    // outer block containing the type guard.
                    newAncestor = DOM.replaceElement(ancestor,nextElementName);
                    DOM.removeAttribute(newAncestor,"id");
                    DOM.setAttribute(newAncestor,"class",nextClassName);
                }
            }

            if (newAncestor != null)
                ancestor = newAncestor;

            if (Types.isParagraphNode(ancestor) && !Util.nodeHasContent(ancestor)) {
                updateBRAtEndOfParagraph(prev);
                break;
            }
            else if ((ancestor._type == ElementTypes.HTML_LI) && !Util.nodeHasContent(ancestor)) {
                DOM.deleteAllChildren(ancestor);
                break;
            }
        }

        updateBRAtEndOfParagraph(Range.singleNode(selRange));
    });

    Selection.set(selRange.start.node,selRange.start.offset,
                  selRange.end.node,selRange.end.offset);
    cursorX = null;
    ensureCursorVisible();

    function getBlockToSplit(pos: Position.Position): Node {
        let blockToSplit: Node = null;
        for (let n = pos.node; n != null; n = n.parentNode) {
            if (n._type == ElementTypes.HTML_LI) {
                blockToSplit = n;
                break;
            }
        }
        if (blockToSplit == null) {
            blockToSplit = pos.node;
            while (Types.isInlineNode(blockToSplit))
                blockToSplit = blockToSplit.parentNode;
        }
        return blockToSplit;
    }

    function getContainerOrParagraph(node: Node): Node {
        while ((node != null) && Types.isInlineNode(node))
            node = node.parentNode;
        return node;
    }

    function positionAtStartOfHeading(pos: Position.Position): boolean {
        let container = getContainerOrParagraph(pos.node);
        if (Types.isHeadingNode(container)) {
            let startOffset = 0;
            if (Types.isOpaqueNode(container.firstChild))
                startOffset = 1;
            let range = new Range.Range(container,startOffset,pos.node,pos.offset);
            return !Range.hasContent(range);
        }
        else
            return false;
    }
}

export function getPrecedingWord(): string {
    let selRange = Selection.get();
    if ((selRange == null) && !Range.isEmpty(selRange))
        return "";

    let node = selRange.start.node;
    let offset = selRange.start.offset;
    if (!(node instanceof Text))
        return "";

    return node.nodeValue.substring(0,offset);
}

export function getAdjacentNodeWithType(type: number): Node {
    let selRange = Selection.get();
    let pos = Position.preferElementPosition(selRange.start);
    let node = pos.node;
    let offset = pos.offset;

    while (true) {

        if (node._type == type)
            return node;

        if (node instanceof Element) {
            let before = node.childNodes[offset-1];
            if ((before != null) && (before._type == type))
                return before;

            let after = node.childNodes[offset];
            if ((after != null) && (after._type == type))
                return after;
        }

        if (node.parentNode == null)
            return null;

        offset = DOM.nodeOffset(node);
        node = node.parentNode;
    }
}

export function getAdjacentElementWithType(type: number): Element {
    var node = getAdjacentNodeWithType(type);
    if ((node != null) && (node instanceof Element))
        return node;
    else
        return null;
}

export interface LinkProperties {
    href: string;
    text: string;
}

export function getLinkProperties(): LinkProperties {
    let a = getAdjacentElementWithType(ElementTypes.HTML_A);
    if (a == null)
        return null;

    return { href: a.getAttribute("href"),
             text: Traversal.getNodeText(a) };
}

export function setLinkProperties(properties: LinkProperties): void {
    let a = getAdjacentNodeWithType(ElementTypes.HTML_A);
    if ((a != null) && (a instanceof Element)) {
        Selection.preserveWhileExecuting(function() {
            DOM.setAttribute(a,"href",properties.href);
            DOM.deleteAllChildren(a);
            DOM.appendChild(a,DOM.createTextNode(document,properties.text));
        });
    }
}

export function setReferenceTarget(itemId: string): void {
    let a = getAdjacentNodeWithType(ElementTypes.HTML_A);
    if ((a != null) && (a instanceof HTMLElement))
        Outline.setReferenceTarget(a,itemId);
}

// Deletes the current selection contents and ensures that the cursor is located directly
// inside the nearest container element, i.e. not inside a paragraph or inline node. This
// is intended for preventing things like inserting a table of contants inside a heading
export function makeContainerInsertionPoint(): void {
    let selRange = Selection.get();
    if (selRange == null)
        return;

    if (!Range.isEmpty(selRange)) {
        Selection.deleteContents();
        selRange = Selection.get();
    }

    let parent: Node;
    let previousSibling: Node;
    let nextSibling: Node;

    if (selRange.start.node instanceof Element) {
        parent = selRange.start.node;
        nextSibling = selRange.start.node.childNodes[selRange.start.offset];
    }
    else {
        if (selRange.start.offset > 0)
            Formatting.splitTextBefore(selRange.start);
        parent = selRange.start.node.parentNode;
        nextSibling = selRange.start.node;
    }

    let offset = DOM.nodeOffset(nextSibling,parent);

    if (Types.isContainerNode(parent)) {
        set(parent,offset);
        return;
    }

    if ((offset > 0) && Types.isItemNumber(parent.childNodes[offset-1]))
        offset--;

    Formatting.moveFollowing(new Position.Position(parent,offset),Types.isContainerNode);
    Formatting.movePreceding(new Position.Position(parent,offset),Types.isContainerNode);

    offset = 0;
    while (!Types.isContainerNode(parent)) {
        let old = parent;
        offset = DOM.nodeOffset(parent);
        parent = parent.parentNode;
        DOM.deleteNode(old);
    }

    set(parent,offset);
    cursorX = null;
}

export function set(node: Node, offset: number, keepCursorX?: boolean): void {
    Selection.set(node,offset,node,offset);
    if (!keepCursorX)
        cursorX = null;
}

function moveRangeOutsideOfNote(range: Range.Range): Range.Range {
    let node = range.start.node;
    let offset = range.start.offset;

    for (let anc = node; anc != null; anc = anc.parentNode) {
        if (Types.isNoteNode(anc) && (anc.parentNode != null)) {
            node = anc.parentNode;
            offset = DOM.nodeOffset(anc)+1;
            return new Range.Range(node,offset,node,offset);
        }
    }

    return range;
}

function insertNote(className: string, content: string): void {
    let footnote = DOM.createElement(document,"span");
    DOM.setAttribute(footnote,"class",className);
    DOM.appendChild(footnote,DOM.createTextNode(document,content));

    let range = Selection.get();
    range = moveRangeOutsideOfNote(range);
    Formatting.splitAroundSelection(range,false);

    // If we're part-way through a text node, splitAroundSelection will give us an
    // empty text node between the before and after text. For formatting purposes that's
    // fine (not sure if necessary), but when inserting a footnote or endnote we want
    // to avoid this as it causes problems with cursor movement - specifically, the cursor
    // is allowed to go inside the empty text node, and this doesn't show up in the correct
    // position on screen.
    let pos = range.start;
    if ((pos.node._type == ElementTypes.HTML_TEXT) &&
        (pos.node.nodeValue.length == 0)) {
        let empty = pos.node;
        pos = new Position.Position(empty.parentNode,DOM.nodeOffset(empty));
        DOM.deleteNode(empty);
    }
    else {
        pos = Position.preferElementPosition(pos);
    }

    DOM.insertBefore(pos.node,footnote,pos.node.childNodes[pos.offset]);
    Selection.set(footnote,0,footnote,footnote.childNodes.length);
    updateBRAtEndOfParagraph(footnote);
}

export function insertFootnote(content: string): void {
    insertNote("footnote",content);
}

export function insertEndnote(content: string): void {
    insertNote("endnote",content);
}
