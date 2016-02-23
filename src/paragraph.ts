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
import Text = require("./text");

export function runFromOffset(paragraph: Text.ParagraphInfo, offset: number, end?: boolean): Text.Run {
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

export function runFromNode(paragraph: Text.ParagraphInfo, node: Node): Text.Run {
    for (let i = 0; i < paragraph.runs.length; i++) {
        if (paragraph.runs[i].node == node)
            return paragraph.runs[i];
    }
    throw new Error("Run for text node not found");
}

export function positionAtOffset(paragraph: Text.ParagraphInfo, offset: number, end?: boolean): Position {
    let run = runFromOffset(paragraph,offset,end);
    if (run == null)
        throw new Error("Run at offset "+offset+" not found");
    return new Position(run.node,offset-run.start);
}

export function offsetAtPosition(paragraph: Text.ParagraphInfo, pos: Position): number {
    let run = runFromNode(paragraph,pos.node);
    return run.start + pos.offset;
}

export function getRunRects(paragraph: Text.ParagraphInfo): ClientRect[] {
    let rects = new Array();
    for (let i = 0; i < paragraph.runs.length; i++) {
        let run = paragraph.runs[i];
        let runRange = new Range(run.node,0,run.node,run.node.nodeValue.length);
        let runRects = Range.getClientRects(runRange);
        Array.prototype.push.apply(rects,runRects);
    }
    return rects;
}

export function getRunOrFallbackRects(paragraph: Text.ParagraphInfo, pos: Position): ClientRect[] {
    let rects = getRunRects(paragraph);
    if ((rects.length == 0) && (paragraph.node instanceof Element)) {
        let node = paragraph.node;
        let startOffset = paragraph.startOffset;
        let endOffset = paragraph.endOffset;
        if ((node instanceof HTMLElement) &&
            Types.isBlockNode(node) &&
            (startOffset == 0) &&
            (endOffset == node.childNodes.length)) {
            rects = [node.getBoundingClientRect()];
        }
        else {
            let beforeNode = node.childNodes[startOffset-1];
            let afterNode = node.childNodes[endOffset];
            if ((afterNode != null) && (afterNode instanceof HTMLElement) && Types.isBlockNode(afterNode)) {
                rects = [afterNode.getBoundingClientRect()];
            }
            else if ((beforeNode != null) && (beforeNode instanceof HTMLElement) && Types.isBlockNode(beforeNode)) {
                rects = [beforeNode.getBoundingClientRect()];
            }
        }
    }
    return rects;
}
