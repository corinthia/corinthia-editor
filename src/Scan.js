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

define("Scan",function(require,exports) {
"use strict";

var Cursor = require("Cursor");
var DOM = require("DOM");
var Formatting = require("Formatting");
var Paragraph = require("Paragraph");
var Position = require("Position");
var Range = require("Range");
var Selection = require("Selection");
var Text = require("Text");
var Types = require("Types");

function Match(matchId,startPos,endPos) {
    this.matchId = matchId;
    this.startPos = startPos;
    this.endPos = endPos;
    this.spans = new Array();
}

var matchesById = new Object();
var nextMatchId = 1;

var curPos = null;
var curParagraph = null;

function reset() {
    curPos = new Position.Position(document.body,0);
    curParagraph = null;
    clearMatches();
}

function next() {
    if (curPos == null)
        return null;
    curPos = Text.toEndOfBoundary(curPos,"paragraph");
    if (curPos == null)
        return null;

    curParagraph = Text.analyseParagraph(curPos);
    if (curParagraph == null)
        return null;

    curPos = Position.nextMatch(curPos,Position.okForMovement);

    var sectionId = null;
    if (Types.isHeadingNode(curParagraph.node) &&
        (curParagraph.startOffset == 0) &&
        (curParagraph.endOffset == curParagraph.node.childNodes.length)) {
        sectionId = DOM.getAttribute(curParagraph.node,"id");
    }

    return { text: curParagraph.text,
             sectionId: sectionId };
}

function addMatch(start,end) {
    if (curParagraph == null)
        throw new Error("curParagraph is null");
    if ((start < 0) || (start > curParagraph.text.length))
        throw new Error("invalid start");
    if ((end < start) || (end > curParagraph.text.length))
        throw new Error("invalid end");

    var matchId = nextMatchId++;

    var startRun = Paragraph.runFromOffset(curParagraph,start);
    var endRun = Paragraph.runFromOffset(curParagraph,end);

    if (startRun == null)
        throw new Error("No start run");
    if (endRun == null)
        throw new Error("No end run");

    var startPos = new Position.Position(startRun.node,start - startRun.start);
    var endPos = new Position.Position(endRun.node,end - endRun.start);
    Position.track(startPos);
    Position.track(endPos);

    var match = new Match(matchId,startPos,endPos);
    matchesById[matchId] = match;
    return matchId;
}

function showMatch(matchId) {
    var match = matchesById[matchId];
    if (match == null)
        throw new Error("Match "+matchId+" not found");

    var range = new Range.Range(match.startPos.node,match.startPos.offset,
                          match.endPos.node,match.endPos.offset);
    var text = Range.getText(range);
    Formatting.splitAroundSelection(range,true);
    var outermost = Range.getOutermostNodes(range);
    for (var i = 0; i < outermost.length; i++) {
        var span = DOM.wrapNode(outermost[i],"SPAN");
        DOM.setAttribute(span,"class",Types.Keys.MATCH_CLASS);
        match.spans.push(span);
    }
}

function replaceMatch(matchId,replacement) {
    var match = matchesById[matchId];
    if (match == null)
        throw new Error("Match "+matchId+" not found");

    if (match.spans.length == 0)
        return;

    var span = match.spans[0];

    Selection.preserveWhileExecuting(function() {
        var replacementNode = DOM.createTextNode(document,replacement);
        DOM.insertBefore(span.parentNode,replacementNode,span);

        for (var i = 0; i < match.spans.length; i++)
            DOM.deleteNode(match.spans[i]);

        Formatting.mergeUpwards(replacementNode,Formatting.MERGEABLE_INLINE);
    });

    delete matchesById[matchId];
}

function removeSpansForMatch(match) {
    for (var i = 0; i < match.spans.length; i++)
        DOM.removeNodeButKeepChildren(match.spans[i]);
}

function removeMatch(matchId) {
    removeSpansForMatch(matchesById[matchId]);
    delete matchesById[matchId];
}

function goToMatch(matchId) {
    var match = matchesById[matchId];
    if (match == null)
        throw new Error("Match "+matchId+" not found");

    Selection.set(match.startPos.node,match.startPos.offset,
                  match.endPos.node,match.endPos.offset);
    Cursor.ensurePositionVisible(match.startPos,true);
}

function clearMatches() {
    for (var matchId in matchesById) {
        var match = matchesById[matchId];
        removeSpansForMatch(match);
        Position.untrack(match.startPos);
        Position.untrack(match.endPos);
    }

    matchesById = new Object();
    nextMatchId = 1;
}

exports.reset = reset;
exports.next = next;
exports.addMatch = addMatch;
exports.showMatch = showMatch;
exports.replaceMatch = replaceMatch;
exports.removeMatch = removeMatch;
exports.goToMatch = goToMatch;

});
