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

import Input = require("./input");
import Position = require("./position");
import Range = require("./range");
import Selection = require("./selection");

// We only import the externalapi module to get access to the type definitions it contains.
// The external API functions are *not* intended for use by internal modules.
import ExternallyVisibleTypes = require("./externalapi");
export type Granularity = ExternallyVisibleTypes.Granularity;
export type Direction = ExternallyVisibleTypes.Direction;
export type RangeIds = ExternallyVisibleTypes.RangeIds;
export type PositionRef = ExternallyVisibleTypes.PositionRef;
export type RangeRef = ExternallyVisibleTypes.RangeRef;

let positions: { [key: string]: Position } = {};
let nextRefId = 1;

const documentStartId = "ADocumentStart";
const documentEndId = "ADocumentEnd";
const selectionStartId = "ASelectionStart";
const selectionEndId = "ASelectionEnd";

export function documentStartAnchor(): PositionRef {
    return { "PositionRefId": documentStartId };
}

export function documentEndAnchor(): PositionRef {
    return { "PositionRefId": documentEndId };
}

export function selectionStartAnchor(): PositionRef {
    return { "PositionRefId": selectionStartId }
}

export function selectionEndAnchor(): PositionRef {
    return { "PositionRefId": selectionEndId };
}

export function wrapPosition(pos: Position): PositionRef {
    if (pos == null)
        return null;
    let copy = new Position(pos.node,pos.offset);
    copy.targetX = pos.targetX;
    pos = copy;

    let refId = "D"+(nextRefId++);
    positions[refId] = pos;

    pos.track();

    return { PositionRefId: refId };
}

function getPositionId(ref: PositionRef): string {
    if (ref == null)
        throw new Error("Supplied position reference is null");
    let id = ref.PositionRefId;
    if (id == null)
        throw new Error("Supplied position reference has no id");
    if ((id.length == 0) || ((id[0] != "A") && (id[0] != "D")))
        throw new Error("Invalid reference id "+JSON.stringify(id)+"; neither an anchor or a dynamic position");
    return id;
}

function isAnchorPositionId(id: string): boolean {
    return (id[0] == "A");
}

export function unwrapPosition(ref: PositionRef): Position {
    let id = getPositionId(ref);

    if (isAnchorPositionId(id)) {
        // Anchor position
        if (id == documentStartId) {
            return Input.documentStartPosition();
        }
        else if (id == documentEndId) {
            return Input.documentEndPosition();
        }
        else if (id == selectionStartId) {
            let range = Selection.get();
            return (range != null) ? range.start : null;
        }
        else if (id == selectionEndId) {
            let range = Selection.get();
            return (range != null) ? range.end : null;
        }
        else {
            throw new Error("Invalid anchor position id "+JSON.stringify(id));
        }
    }
    else {
        // Dynamic position
        let pos = positions[id];
        if (pos == null)
            throw new Error("No position for reference id "+JSON.stringify(id));
        return pos;
    }
}

export function invalidatePositions(): void {
    Object.keys(positions).forEach((id) => {
        if (isAnchorPositionId(id))
            throw new Error("Found anchored position "+JSON.stringify(id)+" in positions map - "+
                            "this should not happen");
        let pos = positions[id];
        pos.untrack();
        delete positions[id];
    });
}

function wrapRange(range: Range): RangeRef {
    if (range == null)
        return null;
    else
        return { start: wrapPosition(range.start), end: wrapPosition(range.end) };
}

function unwrapRange(rref: RangeRef): Range {
    if (rref == null) {
        return null;
    }
    else {
        let start = unwrapPosition(rref.start);
        let end = unwrapPosition(rref.end);
        if ((start == null) || (end == null))
            return null;
        return new Range(start.node,start.offset,end.node,end.offset);
    }
}

export function textInRange(start: PositionRef, end: PositionRef): string {
    let startPos = unwrapPosition(start);
    let endPos = unwrapPosition(end);
    return Input.textInRange(startPos,endPos);
}

export function replaceRange(start: PositionRef, end: PositionRef, text: string): void {
    let startPos = unwrapPosition(start);
    let endPos = unwrapPosition(end);
    return Input.replaceRange(startPos,endPos,text);
}

export function selectedTextRange(): RangeRef {
    let result = Input.selectedTextRange();
    return wrapRange(result);
}

export function setSelectedTextRange(start: PositionRef, end: PositionRef): void {
    let startPos = unwrapPosition(start);
    let endPos = unwrapPosition(end);
    return Input.setSelectedTextRange(startPos,endPos);
}

export function markedTextRange(): RangeRef {
    let result = Input.markedTextRange();
    return wrapRange(result);
}

export function setMarkedText(text: string, startOffset: number, endOffset: number): void {
    return Input.setMarkedText(text,startOffset,endOffset);
}

export function unmarkText(): void {
    return Input.unmarkText();
}

export function forwardSelectionAffinity(): boolean {
    return Input.forwardSelectionAffinity();
}

export function setForwardSelectionAffinity(value: boolean): void {
    return Input.setForwardSelectionAffinity(value);
}

export function positionRelativeTo(pos: PositionRef, direction: Direction, offset: number): PositionRef {
    let p = unwrapPosition(pos);
    let result = Input.positionRelativeTo(p,direction,offset);
    return wrapPosition(result);
}

export function comparePositions(pos1: PositionRef, pos2: PositionRef): number {
    let p1 = unwrapPosition(pos1);
    let p2 = unwrapPosition(pos2);
    return Input.comparePositions(p1,p2);
}

export function firstRectForRange(start: PositionRef, end: PositionRef): ClientRect {
    let startPos = unwrapPosition(start);
    let endPos = unwrapPosition(end);
    return Input.firstRectForRange(startPos,endPos);
}

export function caretRectForPosition(pos: PositionRef): ClientRect {
    let p = unwrapPosition(pos);
    return Input.caretRectForPosition(p);
}

export function closestPositionToPoint(x: number, y: number): PositionRef {
    let result = Input.closestPositionToPoint(x,y);
    return wrapPosition(result);
}

export function isPositionAtBoundary(pos: PositionRef, granularity: Granularity, direction: Direction): boolean {
    let p = unwrapPosition(pos);
    return Input.isPositionAtBoundary(p,granularity,direction);
}

export function isPositionWithinTextUnit(pos: PositionRef, granularity: Granularity, direction: Direction): boolean {
    let p = unwrapPosition(pos);
    return Input.isPositionWithinTextUnit(p,granularity,direction);
}

export function positionToBoundary(pos: PositionRef, granularity: Granularity, direction: Direction): PositionRef {
    let p = unwrapPosition(pos);
    let result = Input.positionToBoundary(p,granularity,direction);
    return wrapPosition(result);
}

export function rangeEnclosingPosition(pos: PositionRef, granularity: Granularity, direction: Direction): RangeRef {
    let p = unwrapPosition(pos);
    let result = Input.rangeEnclosingPosition(p,granularity,direction);
    return wrapRange(result);
}
