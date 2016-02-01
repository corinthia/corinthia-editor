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

define("Paragraph",function(require,exports) {
"use strict";

var Position = require("Position");
var Range = require("Range");
var Types = require("Types");

function runFromOffset(paragraph,offset,end) {
    if (paragraph.runs.length == 0)
        throw new Error("Paragraph has no runs");
    if (!end) {

        for (var i = 0; i < paragraph.runs.length; i++) {
            var run = paragraph.runs[i];
            if ((offset >= run.start) && (offset < run.end))
                return run;
            if ((i == paragraph.runs.length-1) && (offset == run.end))
                return run;
        }

    }
    else {

        for (var i = 0; i < paragraph.runs.length; i++) {
            var run = paragraph.runs[i];
            if ((offset > run.start) && (offset <= run.end))
                return run;
            if ((i == 0) && (offset == 0))
                return run;
        }

    }
}

function runFromNode(paragraph,node) {
    for (var i = 0; i < paragraph.runs.length; i++) {
        if (paragraph.runs[i].node == node)
            return paragraph.runs[i];
    }
    throw new Error("Run for text node not found");
}

function positionAtOffset(paragraph,offset,end) {
    var run = runFromOffset(paragraph,offset,end);
    if (run == null)
        throw new Error("Run at offset "+offset+" not found");
    return new Position.Position(run.node,offset-run.start);
}

function offsetAtPosition(paragraph,pos) {
    var run = runFromNode(paragraph,pos.node);
    return run.start + pos.offset;
}

function getRunRects(paragraph) {
    var rects = new Array();
    for (var i = 0; i < paragraph.runs.length; i++) {
        var run = paragraph.runs[i];
        var runRange = new Range.Range(run.node,0,run.node,run.node.nodeValue.length);
        var runRects = Range.getClientRects(runRange);
        Array.prototype.push.apply(rects,runRects);
    }
    return rects;
}

function getRunOrFallbackRects(paragraph,pos) {
    var rects = getRunRects(paragraph);
    if ((rects.length == 0) && (paragraph.node.nodeType == Node.ELEMENT_NODE)) {
        if (Types.isBlockNode(paragraph.node) &&
            (paragraph.startOffset == 0) &&
            (paragraph.endOffset == paragraph.node.childNodes.length)) {
            rects = [paragraph.node.getBoundingClientRect()];
        }
        else {
            var beforeNode = paragraph.node.childNodes[paragraph.startOffset-1];
            var afterNode = paragraph.node.childNodes[paragraph.endOffset];
            if ((afterNode != null) && Types.isBlockNode(afterNode)) {
                rects = [afterNode.getBoundingClientRect()];
            }
            else if ((beforeNode != null) && Types.isBlockNode(beforeNode)) {
                rects = [beforeNode.getBoundingClientRect()];
            }
        }
    }
    return rects;
}

exports.runFromOffset = runFromOffset;
exports.runFromNode = runFromNode;
exports.positionAtOffset = positionAtOffset;
exports.offsetAtPosition = offsetAtPosition;
exports.getRunRects = getRunRects;
exports.getRunOrFallbackRects = getRunOrFallbackRects;

});
