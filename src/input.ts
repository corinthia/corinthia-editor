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
import Paragraph = require("./paragraph");
import Position = require("./position");
import Range = require("./range");
import Selection = require("./selection");
import Txt = require("./text");
import Util = require("./util");

export interface RangeIds {
    startId: number;
    endId: number;
}

// function idebug(str) {
//    Util.debug(str);
// }

let forwardSelection = true;
let positions: { [key: number]: Position.Position } = {};
let BaseIdNull = 0;
let BaseIdDocumentStart = 1;
let BaseIdDocumentEnd = 2;
let BaseIdSelectionStart = 3;
let BaseIdSelectionEnd = 4;
let firstDynamicPosId = 5;
let nextPosId = firstDynamicPosId;

export function addPosition(pos: Position.Position): number {
    if (pos == null)
        return 0;
    let copy = new Position.Position(pos.node,pos.offset);
    copy.targetX = pos.targetX;
    pos = copy;
    pos.posId = nextPosId++;
    positions[pos.posId] = pos;
    Position.track(pos);
    return pos.posId;
}

export function getPosition(posId: number): Position.Position {
    if (posId < firstDynamicPosId) {
        switch (posId) {
        case BaseIdNull: {
            return null;
        }
        case BaseIdDocumentStart: {
            let pos = new Position.Position(document.body,0);
            pos = Position.closestMatchForwards(pos,Position.okForMovement);
            return pos;
        }
        case BaseIdDocumentEnd: {
            let pos = new Position.Position(document.body,document.body.childNodes.length);
            pos = Position.closestMatchBackwards(pos,Position.okForMovement);
            return pos;
        }
        case BaseIdSelectionStart: {
            let range = Selection.get();
            return (range != null) ? range.start : null;
        }
        case BaseIdSelectionEnd: {
            let range = Selection.get();
            return (range != null) ? range.end : null;
        }
        default:
            return null;
        }
    }
    if (positions[posId] == null)
        throw new Error("No position for pos id "+posId);
    return positions[posId];
}

// void
export function removePosition(posId: number): void {
    //idebug("removePosition("+posId+")");
    let pos = positions[posId];
    if (pos == null) {
        throw new Error("no position for id "+posId);
    }
    Position.untrack(pos);
    delete positions[posId];
}

// string
export function textInRange(startId: number, startAdjust: number, endId: number, endAdjust: number): string {
    let start = getPosition(startId);
    let end = getPosition(endId);
    start = positionRight(start,startAdjust);
    end = positionRight(end,endAdjust);
    if ((start == null) || (end == null))
        return "";

    let range = new Range.Range(start.node,start.offset,end.node,end.offset);
    let result = Range.getText(range);
    //idebug("textInRange("+startId+","+startAdjust+","+endId+","+endAdjust+") = "+
    //       JSON.stringify(result));
    return result;
}

// void
export function replaceRange(startId: number, endId: number, text: string): void {
    //idebug("replaceRange("+startId+","+endId+","+JSON.stringify(text)+")");
    let start = getPosition(startId);
    let end = getPosition(endId);
    if (start == null)
        throw new Error("start is null");
    if (end == null)
        throw new Error("end is null");

    let range = new Range.Range(start.node,start.offset,end.node,end.offset);
    Range.trackWhileExecuting(range,function() {
        Selection.deleteRangeContents(range,true);
    });
    range.start = Position.preferTextPosition(range.start);
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

// { startId, endId }
export function selectedTextRange(): RangeIds {
    let range = Selection.get();
    if (range == null) {
        //idebug("selectedTextRange = null");
        return null;
    }
    else {
        let startId = addPosition(range.start);
        let endId = addPosition(range.end);
        //idebug("selectedTextRange = "+startId+", "+endId);
        return { startId: startId,
                 endId: endId };
    }
}

// void
export function setSelectedTextRange(startId: number, endId: number): void {
    //idebug("setSelectedTextRange("+startId+","+endId+")");
    let start = getPosition(startId);
    let end = getPosition(endId);

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

// { startId, endId }
export function markedTextRange(): RangeIds {
    //idebug("markedTextRange");
    return null;
}

// void
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

// void
export function unmarkText(): void {
    let range = Selection.get();
    Cursor.set(range.end.node,range.end.offset);
    //idebug("unmarkText");
}

// boolean
export function forwardSelectionAffinity(): boolean {
    //idebug("forwardSelectionAffinity");
    return forwardSelection;
}

// void
export function setForwardSelectionAffinity(value: boolean): void {
    //idebug("setForwardSelectionAffinity");
    forwardSelection = value;
}

function positionRight(pos: Position.Position, offset: number): Position.Position {
    if (offset > 0) {
        for (; offset > 0; offset--) {
            let next = Position.nextMatch(pos,Position.okForMovement);
            if (next == null)
                return pos;
            pos = next;
        }
    }
    else {
        for (; offset < 0; offset++) {
            let prev = Position.prevMatch(pos,Position.okForMovement);
            if (prev == null)
                return pos;
            pos = prev;
        }
    }
    return pos;
}

function positionDown(pos: Position.Position, offset: number): Position.Position {
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

// posId
export function positionFromPositionOffset(posId: number, offset: number): number {
    let pos = getPosition(posId);
    let res = addPosition(positionRight(pos,offset));
    //idebug("positionFromPositionOffset("+posId+","+offset+") = "+res);
    return res;
}

// posId
export function positionFromPositionInDirectionOffset(posId: number, direction: string, offset: number): number {
    //idebug("positionFromPositionInDirectionOffset("+posId+","+direction+","+offset+")");
    let pos = getPosition(posId);
    if (direction == "left")
        return addPosition(positionRight(pos,-offset));
    else if (direction == "right")
        return addPosition(positionRight(pos,offset));
    else if (direction == "up")
        return addPosition(positionDown(pos,-offset));
    else if (direction == "down")
        return addPosition(positionDown(pos,offset));
    else
        throw new Error("unknown direction: "+direction);
}

// int
export function comparePositionToPosition(posId1: number, posId2: number): number {
    //idebug("comparePositionToPosition("+posId1+","+posId2+")");
    let pos1 = getPosition(posId1);
    let pos2 = getPosition(posId2);
    if (pos1 == null)
        throw new Error("pos1 is null");
    if (pos2 == null)
        throw new Error("pos2 is null");
    return Position.compare(pos1,pos2);
}

// int
export function offsetFromPositionToPosition(fromId: number, toId: number): number {
    //idebug("offsetFromPositionToPosition("+fromId+","+toId+")");
    throw new Error("offsetFromPositionToPosition: not implemented");
}

export function positionWithinRangeFarthestInDirection(startId: number, endId: number, direction: string): number {
    //idebug("positionWithinRangeFarthestInDirection("+startId+","+endId+","+direction);
    throw new Error("positionWithinRangeFarthestInDirection: not implemented");
}

// { startId, endId }
export function characterRangeByExtendingPositionInDirection(posId: number, direction: string): number {
    //idebug("characterRangeByExtendingPositionInDirection("+posId+","+direction);
    throw new Error("characterRangeByExtendingPositionInDirection: not implemented");
}

export function firstRectForRange(startId: number, endId: number): Util.XYWHRect {
    //idebug("firstRectForRange("+startId+","+endId+")");
    let start = getPosition(startId);
    let end = getPosition(endId);
    let range = new Range.Range(start.node,start.offset,end.node,end.offset);
    let rects = Range.getClientRects(range);
    if (rects.length == 0)
        return { x: 0, y: 0, width: 0, height: 0 };
    else
        return { x: rects[0].left, y: rects[0].top,
                 width: rects[0].width, height: rects[0].height };
}

export function caretRectForPosition(posId: number): Util.XYWHRect {
    //idebug("caretRectForPosition("+posId+")");
    let pos = getPosition(posId);
    let rect = Position.rectAtPos(pos);
    if (rect == null)
        return { x: 0, y: 0, width: 0, height: 0 };
    else
        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

// posId
export function closestPositionToPoint(x: number, y: number): number {
    return addPosition(Position.atPoint(x,y));
}

// posId
export function closestPositionToPointWithinRange(x: number, y: number, startId: number, endId: number): number {
    //idebug("closestPositionToPointWithinRange("+x+","+y+")");
    throw new Error("closestPositionToPointWithinRange: not implemented");
}

// { startId, endId }
export function characterRangeAtPoint(x: number, y: number): RangeIds {
    //idebug("characterRangeAtPoint("+x+","+y+")");
    throw new Error("characterRangeAtPoint: not implemented");
}

// posId
export function positionWithinRangeAtCharacterOffset(startId: number, endId: number, offset: string): number {
    //idebug("positionWithinRangeAtCharacterOffset("+startId+","+endId+","+offset+")");
    throw new Error("positionWithinRangeAtCharacterOffset: not implemented");
}

// int
export function characterOffsetOfPositionWithinRange(posId: number, startId: number, endId: number): number {
    //idebug("characterOffsetOfPositionWithinRange("+posId+","+startId+","+endId+")");
    throw new Error("characterOffsetOfPositionWithinRange: not implemented");
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

export function isAtWordBoundary(pos: Position.Position, direction: string): boolean {
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

export function isAtParagraphBoundary(pos: Position.Position, direction: string): boolean {
    // FIXME
    return false;
}

export function isPositionAtBoundaryGranularityInDirection(posId: number, granularity: string, direction: string): boolean {
    //idebug("isPositionAtBoundaryGranularityInDirection("+
    //       posId+","+granularity+","+direction+")");
    let pos = getPosition(posId);
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

export function isPositionWithinTextUnitInDirection(posId: number, granularity: string, direction: string): boolean {
    //idebug("isPositionWithinTextUnitInDirection("+
    //       posId+","+granularity+","+direction+")");
    let pos = getPosition(posId);
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
            return ((Position.compare(start,pos) <= 0) &&
                    (Position.compare(pos,end) < 0));
        }
        else {
            return ((Position.compare(start,pos) < 0) &&
                    (Position.compare(pos,end) <= 0));
        }
    }
    else if (granularity == "document") {
    }
    throw new Error("unsupported granularity: "+granularity);
}

export function toWordBoundary(pos: Position.Position, direction: string): Position.Position {
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

export function toParagraphBoundary(pos: Position.Position, direction: string): Position.Position {
    if (isForward(direction)) {
        let end = Txt.toEndOfBoundary(pos,"paragraph");
        if (Position.equal(pos,end)) {
            end = Position.nextMatch(end,Position.okForMovement);
            end = Txt.toEndOfBoundary(end,"paragraph");
            end = Txt.toStartOfBoundary(end,"paragraph");
        }
        return end ? end : pos;
    }
    else {
        let start = Txt.toStartOfBoundary(pos,"paragraph");
        if (Position.equal(pos,start)) {
            start = Position.prevMatch(start,Position.okForMovement);
            start = Txt.toStartOfBoundary(start,"paragraph");
            start = Txt.toEndOfBoundary(start,"paragraph");
        }
        return start ? start : pos;
    }
}

export function toLineBoundary(pos: Position.Position, direction: string): Position.Position {
    if (isForward(direction)) {
        let end = Txt.toEndOfBoundary(pos,"line");
        return end ? end : pos;
    }
    else {
        let start = Txt.toStartOfBoundary(pos,"line");
        return start ? start : pos;
    }
}

export function positionFromPositionToBoundaryInDirection(posId: number, granularity: string, direction: string): number {
    //idebug("positionFromPositionToBoundaryInDirection("+
    //       posId+","+granularity+","+direction+")");
    let pos = getPosition(posId);
    if (pos == null)
        return null;

    // FIXME: Temporary hack to avoid exceptions when running under iOS 8
    if (granularity == "sentence")
        granularity = "paragraph";

    if (granularity == "word")
        return addPosition(toWordBoundary(pos,direction));
    else if (granularity == "paragraph")
        return addPosition(toParagraphBoundary(pos,direction));
    else if (granularity == "line")
        return addPosition(toLineBoundary(pos,direction));
    else if (granularity == "character")
        return positionFromPositionInDirectionOffset(posId,direction,1);
    else if (granularity == "document")
        return isForward(direction) ? BaseIdDocumentEnd : BaseIdDocumentStart;
    else
        throw new Error("unsupported granularity: "+granularity);
}

export function rangeEnclosingPositionWithGranularityInDirection(posId: number, granularity: string, direction: string): RangeIds {
    //idebug("rangeEnclosingPositionWithGranularityInDirection("+
    //       posId+","+granularity+","+direction);
    let pos = getPosition(posId);
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

        let ok;

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
            return { startId: addPosition(startPos),
                     endId: addPosition(endPos) };
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
        return { startId: addPosition(start),
                 endId: addPosition(end) };
    }
    else {
        throw new Error("unsupported granularity: "+granularity);
    }
}
