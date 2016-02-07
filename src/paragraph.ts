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

import Position = require("./position");
import Range = require("./range");
import Types = require("./types");

export function runFromOffset(paragraph,offset,end?) {
    if (paragraph.runs.length == 0)
        throw new Error("Paragraph has no runs");
    if (!end) {

        for (let i = 0; i < paragraph.runs.length; i++) {
            let run = paragraph.runs[i];
            if ((offset >= run.start) && (offset < run.end))
                return run;
            if ((i == paragraph.runs.length-1) && (offset == run.end))
                return run;
        }

    }
    else {

        for (let i = 0; i < paragraph.runs.length; i++) {
            let run = paragraph.runs[i];
            if ((offset > run.start) && (offset <= run.end))
                return run;
            if ((i == 0) && (offset == 0))
                return run;
        }

    }
}

export function runFromNode(paragraph,node) {
    for (let i = 0; i < paragraph.runs.length; i++) {
        if (paragraph.runs[i].node == node)
            return paragraph.runs[i];
    }
    throw new Error("Run for text node not found");
}

export function positionAtOffset(paragraph,offset,end?) {
    let run = runFromOffset(paragraph,offset,end);
    if (run == null)
        throw new Error("Run at offset "+offset+" not found");
    return new Position.Position(run.node,offset-run.start);
}

export function offsetAtPosition(paragraph,pos) {
    let run = runFromNode(paragraph,pos.node);
    return run.start + pos.offset;
}

export function getRunRects(paragraph) {
    let rects = new Array();
    for (let i = 0; i < paragraph.runs.length; i++) {
        let run = paragraph.runs[i];
        let runRange = new Range.Range(run.node,0,run.node,run.node.nodeValue.length);
        let runRects = Range.getClientRects(runRange);
        Array.prototype.push.apply(rects,runRects);
    }
    return rects;
}

export function getRunOrFallbackRects(paragraph,pos) {
    let rects = getRunRects(paragraph);
    if ((rects.length == 0) && (paragraph.node instanceof Element)) {
        if (Types.isBlockNode(paragraph.node) &&
            (paragraph.startOffset == 0) &&
            (paragraph.endOffset == paragraph.node.childNodes.length)) {
            rects = [paragraph.node.getBoundingClientRect()];
        }
        else {
            let beforeNode = paragraph.node.childNodes[paragraph.startOffset-1];
            let afterNode = paragraph.node.childNodes[paragraph.endOffset];
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
