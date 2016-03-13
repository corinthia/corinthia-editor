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

import Collections = require("./collections");
import Cursor = require("./cursor");
import DOM = require("./dom");
import Events = require("./events")
import Formatting = require("./formatting");
import Geometry = require("./geometry");
import Position = require("./position");
import PostponedActions = require("./postponedActions");
import Range = require("./range");
import Selection = require("./selection");
import Traversal = require("./traversal");
import Types = require("./types");
import UndoManager = require("./undo");

function removeCorrectionSpan(span: HTMLElement): void {
    if (span.parentNode == null)
        return;
    Selection.preserveWhileExecuting(function() {
        let firstChild = span.firstChild;
        DOM.removeNodeButKeepChildren(span);
        if (firstChild != null)
            Formatting.mergeWithNeighbours(firstChild,[]);
    });
}

class Correction {

    public span: HTMLElement;
    public modificationListener: (event: any) => void;

    constructor(span: HTMLElement) {
        this.span = span;
        this.modificationListener = function(event: any): void {
            if (DOM.getIgnoreMutations())
                return;
            PostponedActions.add(function() {
                // This will trigger a removeCorrection() call
                removeCorrectionSpan(span);
            });
        };
    }

    public toString(): string {
        return this.span.getAttribute("original")+" -> "+Traversal.getNodeText(this.span);
    }

}

let correctionsByNode: Collections.NodeMap<Correction> = null;
let correctionList: Correction[] = null;

// private
function docNodeInserted(event: any): void {
    try {
        recurse(event.target);
    }
    catch (e) {
        Events.error(e);
    }

    function recurse(node: Node): void {
        if ((node instanceof HTMLElement) && Types.isAutoCorrectNode(node))
            addCorrection(node);
        for (let child = node.firstChild; child != null; child = child.nextSibling)
            recurse(child);
    }
}

// private
function docNodeRemoved(event: any): void {
    try {
        recurse(event.target);
    }
    catch (e) {
        Events.error(e);
    }

    function recurse(node: Node): void {
        if ((node instanceof HTMLElement) && Types.isAutoCorrectNode(node))
            removeCorrection(node);
        for (let child = node.firstChild; child != null; child = child.nextSibling)
            recurse(child);
    }
}

export function init(): void {
    correctionsByNode = new Collections.NodeMap<Correction>();
    correctionList = new Array();
    document.addEventListener("DOMNodeInserted",docNodeInserted);
    document.addEventListener("DOMNodeRemoved",docNodeRemoved);
}

// public (for the undo tests, when they report results)
export function removeListeners(): void {
    document.removeEventListener("DOMNodeInserted",docNodeInserted);
    document.removeEventListener("DOMNodeRemoved",docNodeRemoved);
}

export function addCorrection(span: HTMLElement): void {
    let correction = new Correction(span);
    correctionsByNode.put(span,correction);
    correctionList.push(correction);
    Events.updateAutoCorrect();

    span.addEventListener("DOMSubtreeModified",correction.modificationListener);
}

export function removeCorrection(span: HTMLElement): void {
    let correction = correctionsByNode.get(span);
    if (correction == null)
        throw new Error("No autocorrect entry for "+JSON.stringify(Traversal.getNodeText(span)));

    let index: number = null;
    for (let i = 0; i < correctionList.length; i++) {
        if (correctionList[i].span == span) {
            index = i;
            break;
        }
    }
    if (index == null)
        throw new Error("Correction "+correction+" not found in correctionList");
    correctionList.splice(index,1);
    Events.updateAutoCorrect();

    span.removeEventListener("DOMSubtreeModified",correction.modificationListener);
    correctionsByNode.remove(span);
}

export function getCorrections(): { original: string; replacement: string }[] {
    let result: { original: string; replacement: string }[] = new Array();
    for (let i = 0; i < correctionList.length; i++) {
        let correction = correctionList[i];
        result.push({ original: correction.span.getAttribute("original"),
                      replacement: Traversal.getNodeText(correction.span)});
    }
    return result;
}

export function correctPrecedingWord(numChars: number, replacement: string, confirmed: boolean): void {
    Selection.preserveWhileExecuting(function() {
        let selRange = Selection.get();
        if ((selRange == null) && !selRange.isEmpty()) // FIXME: Second part of this doesn't look right
            return;

        let node = selRange.start.node;
        let offset = selRange.start.offset;
        if (node instanceof Text) {

            let original = node.nodeValue.substring(offset-numChars,offset);

            if (confirmed) {
                DOM.replaceCharacters(node,offset-numChars,offset,replacement);
                return;
            }

            UndoManager.newGroup("Auto-correct");
            let before = node.nodeValue.substring(0,offset-numChars);
            let beforeText = DOM.createTextNode(document,before);
            let replacementText = DOM.createTextNode(document,replacement);
            let span = DOM.createElement(document,"SPAN");
            DOM.setAttribute(span,"class",Types.Keys.AUTOCORRECT_CLASS);
            DOM.setAttribute(span,"original",original);
            DOM.appendChild(span,replacementText);
            DOM.insertBefore(node.parentNode,beforeText,node);
            DOM.insertBefore(node.parentNode,span,node);
            DOM.deleteCharacters(node,0,offset);
            // Add the new group in a postponed action, so that the change to the style element
            // is not counted as a separate action
            PostponedActions.add(UndoManager.newGroup);
        }
    });
}

export function getCorrection(): { original: string; replacement: string } {
    let correction = getCurrent();
    if (correction == null)
        return null;

    return { original: correction.span.getAttribute("original"),
             replacement: Traversal.getNodeText(correction.span) };
}

export function getCorrectionCoords(): { x: number, y: number } {
    let correction = getCurrent();
    if (correction == null)
        return null;

    let textNode = correction.span.firstChild;
    if ((textNode == null) || !(textNode instanceof Text))
        return null;

    let offset = Math.floor(textNode.nodeValue.length/2);
    Selection.set(textNode,offset,textNode,offset);
    Cursor.scrollViewForCursor();
    let rect = Geometry.displayRectAtPos(new Position(textNode,offset));

    if (rect == null) // FIXME: pos
        throw new Error("no rect for pos "+(new Position(textNode,offset)));

    if (rect == null)
        return null;

    return { x: rect.left, y: rect.top };
}

function getCurrent(): Correction {
    let range = Selection.get();
    if (range != null) {
        let endNode = range.end.closestActualNode();
        for (; endNode != null; endNode = endNode.parentNode) {
            if (Types.isAutoCorrectNode(endNode))
                return correctionsByNode.get(endNode);
        }
    }

    if (correctionList.length > 0)
        return correctionList[correctionList.length-1];

    return null;
}

export function acceptCorrection(): void {
    UndoManager.newGroup("Accept");
    let correction = getCurrent();
    if (correction == null)
        return;

    removeCorrectionSpan(correction.span);
    UndoManager.newGroup();
}

export function revertCorrection(): void {
    let correction = getCurrent();
    if (correction == null)
        return;

    replaceCorrection(correction.span.getAttribute("original"));
}

export function replaceCorrection(replacement: string): void {
    UndoManager.newGroup("Replace");
    let correction = getCurrent();
    if (correction == null)
        return;

    Selection.preserveWhileExecuting(function() {
        let text = DOM.createTextNode(document,replacement);
        DOM.insertBefore(correction.span.parentNode,text,correction.span);
        DOM.deleteNode(correction.span);
        Formatting.mergeWithNeighbours(text,[]);
    });
    UndoManager.newGroup();
}
