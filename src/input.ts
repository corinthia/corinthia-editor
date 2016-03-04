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

// FIXME: ensure updateFormatting() is called after any cursor/selection changes
// FIXME: test capitalisation of on-screen keyboard at start of sentence

import Cursor = require("./cursor");
import DOM = require("./dom");
import Geometry = require("./geometry");
import Paragraph = require("./paragraph");
import Position = require("./position");
import Range = require("./range");
import Selection = require("./selection");
import Txt = require("./text");
import Util = require("./util");

// We only import the externalapi module to get access to the type definitions it contains.
// The external API functions are *not* intended for use by internal modules.
import ExternallyVisibleTypes = require("./externalapi");
export type Granularity = ExternallyVisibleTypes.Granularity;
export type Direction = ExternallyVisibleTypes.Direction;
export type RangeIds = ExternallyVisibleTypes.RangeIds;

let forwardSelection = true;

export function documentStartPosition(): Position {
    let pos = new Position(document.body,0);
    pos = Position.closestMatchForwards(pos,Position.okForMovement);
    return pos;
}

export function documentEndPosition(): Position {
    let pos = new Position(document.body,document.body.childNodes.length);
    pos = Position.closestMatchBackwards(pos,Position.okForMovement);
    return pos;
}

export function textInRange(start: Position, end: Position): string {
    if ((start == null) || (end == null))
        return "";

    let range = new Range(start.node,start.offset,end.node,end.offset);
    let result = range.getText();
    return result;
}

export function replaceRange(start: Position, end: Position, text: string): void {
    if (start == null)
        throw new Error("start is null");
    if (end == null)
        throw new Error("end is null");

    let range = new Range(start.node,start.offset,end.node,end.offset);
    Range.trackWhileExecuting(range,function() {
        Selection.deleteRangeContents(range,true);
    });
    range.start = range.start.preferTextPosition();
    let node = range.start.node;
    let offset = range.start.offset;

    if (node instanceof Text) {
        DOM.insertCharacters(node,offset,text);
        Cursor.set(node,offset+text.length);
    }
    else if (node instanceof Element) {
        let textNode = DOM.createTextNode(document,text);
        DOM.insertBefore(node,textNode,node.childNodes[offset]);
        Cursor.set(node,offset+1);
    }
}

export function selectedTextRange(): Range {
    return Selection.get();
}

export function setSelectedTextRange(start: Position, end: Position): void {
    let oldSelection = Selection.get();
    let oldStart = (oldSelection != null) ? oldSelection.start : null;
    let oldEnd = (oldSelection != null) ? oldSelection.end : null;

    Selection.set(start.node,start.offset,end.node,end.offset);

    // The positions may have changed as a result of spans being added/removed
    let newRange = Selection.get();
    start = newRange.start;
    end = newRange.end;

    if (Position.equal(start,end))
        Cursor.ensurePositionVisible(end);
    else if (Position.equal(oldStart,start) && !Position.equal(oldEnd,end))
        Cursor.ensurePositionVisible(end);
    else if (Position.equal(oldEnd,end) && !Position.equal(oldStart,start))
        Cursor.ensurePositionVisible(start);
}

export function markedTextRange(): Range {
    return null;
}

export function setMarkedText(text: string, startOffset: number, endOffset: number): void {
    Selection.deleteContents(true);
    let oldSel = Selection.get();
    Range.trackWhileExecuting(oldSel,function() {
        Cursor.insertCharacter(text,false,false);
    });
    let newSel = Selection.get();

    Selection.set(oldSel.start.node,oldSel.start.offset,
                  newSel.end.node,newSel.end.offset,false,true);
}

export function unmarkText(): void {
    let range = Selection.get();
    Cursor.set(range.end.node,range.end.offset);
}

export function forwardSelectionAffinity(): boolean {
    return forwardSelection;
}

export function setForwardSelectionAffinity(value: boolean): void {
    forwardSelection = value;
}

export function positionRight(pos: Position, offset: number): Position {
    if (offset > 0) {
        for (; offset > 0; offset--) {
            let next = pos.nextMatch(Position.okForMovement);
            if (next == null)
                return pos;
            pos = next;
        }
    }
    else {
        for (; offset < 0; offset++) {
            let prev = pos.prevMatch(Position.okForMovement);
            if (prev == null)
                return pos;
            pos = prev;
        }
    }
    return pos;
}

function positionDown(pos: Position, offset: number): Position {
    if (offset > 0) {
        for (; offset > 0; offset--) {
            let below = Txt.posBelow(pos);
            if (below == null)
                return pos;
            pos = below;
        }
    }
    else {
        for (; offset < 0; offset++) {
            let above = Txt.posAbove(pos);
            if (above == null)
                return pos;
            pos = above;
        }
    }
    return pos;
}

export function positionRelativeTo(pos: Position, direction: Direction, offset: number): Position {
    if ((direction == "left") || (direction == "backward"))
        return positionRight(pos,-offset);
    else if ((direction == "right") || (direction == "forward"))
        return positionRight(pos,offset);
    else if (direction == "up")
        return positionDown(pos,-offset);
    else if (direction == "down")
        return positionDown(pos,offset);
    else
        throw new Error("unknown direction: "+direction);
}

export function comparePositions(pos1: Position, pos2: Position): number {
    if (pos1 == null)
        throw new Error("pos1 is null");
    if (pos2 == null)
        throw new Error("pos2 is null");
    return pos1.compare(pos2);
}

export function firstRectForRange(start: Position, end: Position): ClientRect {
    let range = new Range(start.node,start.offset,end.node,end.offset);
    let rects = range.getClientRects();
    if (rects.length == 0)
        return null;
    else
        return rects[0];
}

export function caretRectForPosition(pos: Position): ClientRect {
    return Geometry.rectAtPos(pos);
}

export function closestPositionToPoint(x: number, y: number): Position {
    return Geometry.positionAtPoint(x,y);
}

// UITextInputTokenizer methods

let punctuation = "!\"#%&',-/:;<=>@`~\\^\\$\\\\\\.\\*\\+\\?\\(\\)\\[\\]\\{\\}\\|";
let letterRE = new RegExp("[^\\s"+punctuation+"]");
let wordAtStartRE = new RegExp("^[^\\s"+punctuation+"]+");
let nonWordAtStartRE = new RegExp("^[\\s"+punctuation+"]+");
let wordAtEndRE = new RegExp("[^\\s"+punctuation+"]+$");
let nonWordAtEndRE = new RegExp("[\\s"+punctuation+"]+$");

function isForward(direction: string): boolean {
    return ((direction == "forward") ||
            (direction == "right") ||
            (direction == "down"));
}

export function isAtWordBoundary(pos: Position, direction: string): boolean {
    if (!(pos.node instanceof Text))
        return false;
    let paragraph = Txt.analyseParagraph(pos);
    if (paragraph == null)
        return false;
    let offset = Paragraph.offsetAtPosition(paragraph,pos);
    let before = paragraph.text.substring(0,offset);
    let after = paragraph.text.substring(offset);
    let text = paragraph.text;

    // !! coerces to boolean
    let afterMatch = !!((offset < text.length) && (text.charAt(offset).match(letterRE)));
    let beforeMatch = !!((offset > 0) && (text.charAt(offset-1).match(letterRE)));

    if (isForward(direction))
        return beforeMatch && !afterMatch;
    else
        return !beforeMatch;
}

export function isAtParagraphBoundary(pos: Position, direction: string): boolean {
    // FIXME
    return false;
}

export function isPositionAtBoundary(pos: Position, granularity: Granularity, direction: Direction): boolean {
    if (pos == null)
        return false;

    // FIXME: Temporary hack to avoid exceptions when running under iOS 8
    if ((granularity == "sentence") || (granularity == "document"))
        return false;

    if (granularity == "character") {
        return true;
    }
    else if (granularity == "word") {
        return isAtWordBoundary(pos,direction);
    }
    else if ((granularity == "paragraph") || (granularity == "line")) {
        if (isForward(direction))
            return Position.equal(pos,Txt.toEndOfBoundary(pos,granularity));
        else
            return Position.equal(pos,Txt.toStartOfBoundary(pos,granularity));
    }
    else if (granularity == "sentence") {
    }
    else if (granularity == "document") {
    }
    throw new Error("unsupported granularity: "+granularity);
}

export function isPositionWithinTextUnit(pos: Position, granularity: Granularity, direction: Direction): boolean {
    if (pos == null)
        return false;

    // FIXME: Temporary hack to avoid exceptions when running under iOS 8
    if ((granularity == "sentence") || (granularity == "document"))
        return true;

    if (granularity == "character") {
        return true;
    }
    else if (granularity == "word") {
        pos = Txt.closestPosInDirection(pos,direction);
        if (pos == null)
            return false;
        let paragraph = Txt.analyseParagraph(pos);
        if (paragraph == null)
            return false;
        if ((pos != null) && (pos.node instanceof Text)) {
            let offset = Paragraph.offsetAtPosition(paragraph,pos);
            let text = paragraph.text;
            if (isForward(direction))
                return !!((offset < text.length) && (text.charAt(offset).match(letterRE)));
            else
                return !!((offset > 0) && (text.charAt(offset-1).match(letterRE)));
        }
        else {
            return false;
        }
    }
    else if (granularity == "sentence") {
    }
    else if ((granularity == "paragraph") || (granularity == "line")) {
        let start = Txt.toStartOfBoundary(pos,granularity);
        let end = Txt.toEndOfBoundary(pos,granularity);
        start = start ? start : pos;
        end = end ? end : pos;
        if (isForward(direction)) {
            return ((start.compare(pos) <= 0) &&
                    (pos.compare(end) < 0));
        }
        else {
            return ((start.compare(pos) < 0) &&
                    (pos.compare(end) <= 0));
        }
    }
    else if (granularity == "document") {
    }
    throw new Error("unsupported granularity: "+granularity);
}

export function toWordBoundary(pos: Position, direction: string): Position {
    pos = Txt.closestPosInDirection(pos,direction);
    if (pos == null)
        return null;
    let paragraph = Txt.analyseParagraph(pos);
    if (paragraph == null)
        return null;
    let run = Paragraph.runFromNode(paragraph,pos.node);
    let offset = pos.offset + run.start;

    if (isForward(direction)) {
        let remaining = paragraph.text.substring(offset);
        let afterWord = remaining.replace(wordAtStartRE,"");
        let afterNonWord = remaining.replace(nonWordAtStartRE,"");

        if (remaining.length == 0) {
            return pos;
        }
        else if (afterWord.length < remaining.length) {
            let newOffset = offset + (remaining.length - afterWord.length);
            return Paragraph.positionAtOffset(paragraph,newOffset);
        }
        else {
            let newOffset = offset + (remaining.length - afterNonWord.length);
            return Paragraph.positionAtOffset(paragraph,newOffset);
        }
    }
    else {
        let remaining = paragraph.text.substring(0,offset);
        let beforeWord = remaining.replace(wordAtEndRE,"");
        let beforeNonWord = remaining.replace(nonWordAtEndRE,"");

        if (remaining.length == 0) {
            return pos;
        }
        else if (beforeWord.length < remaining.length) {
            let newOffset = offset - (remaining.length - beforeWord.length);
            return Paragraph.positionAtOffset(paragraph,newOffset);
        }
        else {
            let newOffset = offset - (remaining.length - beforeNonWord.length);
            return Paragraph.positionAtOffset(paragraph,newOffset);
        }
    }
}

export function toParagraphBoundary(pos: Position, direction: string): Position {
    if (isForward(direction)) {
        let end = Txt.toEndOfBoundary(pos,"paragraph");
        if (Position.equal(pos,end)) {
            end = end.nextMatch(Position.okForMovement);
            end = Txt.toEndOfBoundary(end,"paragraph");
            end = Txt.toStartOfBoundary(end,"paragraph");
        }
        return end ? end : pos;
    }
    else {
        let start = Txt.toStartOfBoundary(pos,"paragraph");
        if (Position.equal(pos,start)) {
            start = start.prevMatch(Position.okForMovement);
            start = Txt.toStartOfBoundary(start,"paragraph");
            start = Txt.toEndOfBoundary(start,"paragraph");
        }
        return start ? start : pos;
    }
}

export function toLineBoundary(pos: Position, direction: string): Position {
    if (isForward(direction)) {
        let end = Txt.toEndOfBoundary(pos,"line");
        return end ? end : pos;
    }
    else {
        let start = Txt.toStartOfBoundary(pos,"line");
        return start ? start : pos;
    }
}

export function positionToBoundary(pos: Position, granularity: Granularity, direction: Direction): Position {
    if (pos == null)
        return null;

    // FIXME: Temporary hack to avoid exceptions when running under iOS 8
    if (granularity == "sentence")
        granularity = "paragraph";

    if (granularity == "word")
        return toWordBoundary(pos,direction);
    else if (granularity == "paragraph")
        return toParagraphBoundary(pos,direction);
    else if (granularity == "line")
        return toLineBoundary(pos,direction);
    else if (granularity == "character")
        return positionRelativeTo(pos,direction,1);
    else if (granularity == "document")
        return isForward(direction) ? documentEndPosition() : documentStartPosition();
    else
        throw new Error("unsupported granularity: "+granularity);
}

export function rangeEnclosingPosition(pos: Position, granularity: Granularity, direction: Direction): Range {
    if (pos == null)
        return null;

    // FIXME: Temporary hack to avoid exceptions when running under iOS 8
    if (granularity == "sentence")
        granularity = "paragraph";

    if (granularity == "word") {
        pos = Txt.closestPosInDirection(pos,direction);
        if (pos == null)
            return null;
        let paragraph = Txt.analyseParagraph(pos);
        if (pos == null)
            return null;
        if (paragraph == null)
            return null;
        let run = Paragraph.runFromNode(paragraph,pos.node);
        let offset = pos.offset + run.start;

        let before = paragraph.text.substring(0,offset);
        let after = paragraph.text.substring(offset);
        let beforeWord = before.replace(wordAtEndRE,"");
        let afterWord = after.replace(wordAtStartRE,"");

        let ok: boolean;

        if (isForward(direction))
            ok = (afterWord.length < after.length);
        else
            ok = (beforeWord.length < before.length);

        if (ok) {
            let charsBefore = (before.length - beforeWord.length);
            let charsAfter = (after.length - afterWord.length);
            let startOffset = offset - charsBefore;
            let endOffset = offset + charsAfter;

            let startPos = Paragraph.positionAtOffset(paragraph,startOffset);
            let endPos = Paragraph.positionAtOffset(paragraph,endOffset);
            return new Range(startPos.node,startPos.offset,endPos.node,endPos.offset);
        }
        else {
            return null;
        }
    }
    else if ((granularity == "paragraph") || (granularity == "line")) {
        let start = Txt.toStartOfBoundary(pos,granularity);
        let end = Txt.toEndOfBoundary(pos,granularity);
        start = start ? start : pos;
        end = end ? end : pos;

        if ((granularity == "paragraph") || !isForward(direction)) {
            if (isForward(direction)) {
                if (Position.equal(pos,Txt.toEndOfBoundary(pos,granularity)))
                    return null;
            }
            else {
                if (Position.equal(pos,Txt.toStartOfBoundary(pos,granularity)))
                    return null;
            }
        }
        return new Range(start.node,start.offset,end.node,end.offset);
    }
    else {
        throw new Error("unsupported granularity: "+granularity);
    }
}
