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

import Cursor = require("./cursor");
import DOM = require("./dom");
import Formatting = require("./formatting");
import Paragraph = require("./paragraph");
import Position = require("./position");
import Range = require("./range");
import Selection = require("./selection");
import Txt = require("./text");
import Types = require("./types");

// We only import the externalapi module to get access to the type definitions it contains.
// The external API functions are *not* intended for use by internal modules.
import ExternallyVisibleTypes = require("./externalapi");
export type ScanParagraph = ExternallyVisibleTypes.ScanParagraph;

class Match {

    public matchId: number;
    public startPos: Position;
    public endPos: Position;
    public spans: HTMLElement[];

    constructor(matchId: number, startPos: Position, endPos: Position) {
        this.matchId = matchId;
        this.startPos = startPos;
        this.endPos = endPos;
        this.spans = new Array();
    }

}

let matchesById: { [key: number]: Match } = {};
let nextMatchId = 1;

let curPos: Position = null;
let curParagraph: Txt.ParagraphInfo = null;

export function reset(): void {
    curPos = new Position(document.body,0);
    curParagraph = null;
    clearMatches();
}

export function next(): ScanParagraph {
    if (curPos == null)
        return null;
    curPos = Txt.toEndOfBoundary(curPos,"paragraph");
    if (curPos == null)
        return null;

    curParagraph = Txt.analyseParagraph(curPos);
    if (curParagraph == null)
        return null;

    curPos = curPos.nextMatch(Position.okForMovement);

    let sectionId: string = null;
    let paragraphNode = curParagraph.node;
    if ((paragraphNode instanceof HTMLElement) &&
        Types.isHeadingNode(paragraphNode) &&
        (curParagraph.startOffset == 0) &&
        (curParagraph.endOffset == paragraphNode.childNodes.length)) {
        sectionId = DOM.getAttribute(paragraphNode,"id");
    }

    return { text: curParagraph.text,
             sectionId: sectionId };
}

export function addMatch(start: number, end: number): number {
    if (curParagraph == null)
        throw new Error("curParagraph is null");
    if ((start < 0) || (start > curParagraph.text.length))
        throw new Error("invalid start");
    if ((end < start) || (end > curParagraph.text.length))
        throw new Error("invalid end");

    let matchId = nextMatchId++;

    let startRun = Paragraph.runFromOffset(curParagraph,start);
    let endRun = Paragraph.runFromOffset(curParagraph,end);

    if (startRun == null)
        throw new Error("No start run");
    if (endRun == null)
        throw new Error("No end run");

    let startPos = new Position(startRun.node,start - startRun.start);
    let endPos = new Position(endRun.node,end - endRun.start);
    startPos.track();
    endPos.track();

    let match = new Match(matchId,startPos,endPos);
    matchesById[matchId] = match;
    return matchId;
}

export function showMatch(matchId: number): void {
    let match = matchesById[matchId];
    if (match == null)
        throw new Error("Match "+matchId+" not found");

    let range = new Range(match.startPos.node,match.startPos.offset,
                          match.endPos.node,match.endPos.offset);
    let text = range.getText();
    Formatting.splitAroundSelection(range,true);
    let outermost = range.getOutermostNodes();
    for (let i = 0; i < outermost.length; i++) {
        let span = DOM.wrapNode(outermost[i],"SPAN");
        DOM.setAttribute(span,"class",Types.Keys.MATCH_CLASS);
        match.spans.push(span);
    }
}

export function replaceMatch(matchId: number, replacement: string): void {
    let match = matchesById[matchId];
    if (match == null)
        throw new Error("Match "+matchId+" not found");

    if (match.spans.length == 0)
        return;

    let span = match.spans[0];

    Selection.preserveWhileExecuting(function() {
        let replacementNode = DOM.createTextNode(document,replacement);
        DOM.insertBefore(span.parentNode,replacementNode,span);

        for (let i = 0; i < match.spans.length; i++)
            DOM.deleteNode(match.spans[i]);

        Formatting.mergeUpwards(replacementNode,Formatting.MERGEABLE_INLINE);
    });

    delete matchesById[matchId];
}

function removeSpansForMatch(match: Match): void {
    for (let i = 0; i < match.spans.length; i++)
        DOM.removeNodeButKeepChildren(match.spans[i]);
}

export function removeMatch(matchId: number): void {
    removeSpansForMatch(matchesById[matchId]);
    delete matchesById[matchId];
}

export function goToMatch(matchId: number): void {
    let match = matchesById[matchId];
    if (match == null)
        throw new Error("Match "+matchId+" not found");

    Selection.set(match.startPos.node,match.startPos.offset,
                  match.endPos.node,match.endPos.offset);
    Cursor.ensurePositionVisible(match.startPos,true);
}

function clearMatches(): void {
    for (let matchId in matchesById) {
        let match = matchesById[matchId];
        removeSpansForMatch(match);
        match.startPos.untrack();
        match.endPos.untrack();
    }

    matchesById = {};
    nextMatchId = 1;
}
