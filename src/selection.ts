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

// FIXME: cursor does not display correctly if it is after a space at the end of the line

import Callbacks = require("./callbacks")
import Collections = require("./collections");
import Cursor = require("./cursor");
import DOM = require("./dom");
import ElementTypes = require("./elementTypes");
import Formatting = require("./formatting");
import Geometry = require("./geometry");
import Input = require("./input");
import Position = require("./position");
import Range = require("./range");
import Tables = require("./tables");
import Traversal = require("./traversal");
import Types = require("./types");
import UndoManager = require("./undo");
import Util = require("./util");

let HANDLE_NONE = 0;
let HANDLE_START = 1;
let HANDLE_END = 2;

let activeHandle = HANDLE_NONE;

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
//                                 Selection getter and setter                                //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////

let internalSelection: {
    value: {
        startNode: Node;
        startOffset: number;
        endNode: Node;
        endOffset: number;
        isMarked: boolean;
    }
} = { value: null };

export function isMarked(): boolean {
    if (internalSelection.value == null)
        return null;
    else
        return internalSelection.value.isMarked;
}

// public
export function get(): Range.Range {
    if (internalSelection.value == null)
        return null;
    else
        return new Range.Range(internalSelection.value.startNode,internalSelection.value.startOffset,
                               internalSelection.value.endNode,internalSelection.value.endOffset);
}

// public
export function setInternal(newStartNode: Node, newStartOffset: number,
                            newEndNode: Node, newEndOffset: number,
                            isMarked?: boolean): void {
    let range = new Range.Range(newStartNode,newStartOffset,newEndNode,newEndOffset);
    if (!Range.isForwards(range))
        range = new Range.Range(newEndNode,newEndOffset,newStartNode,newStartOffset);
    range = boundaryCompliantRange(range);

    UndoManager.setProperty(internalSelection,"value",
                            { startNode: range.start.node,
                              startOffset: range.start.offset,
                              endNode: range.end.node,
                              endOffset: range.end.offset,
                              isMarked: isMarked });
}

export function set(newStartNode: Node, newStartOffset: number,
                    newEndNode: Node, newEndOffset: number,
                    keepActiveHandle?: boolean, isMarked?: boolean): void {
    setInternal(newStartNode,newStartOffset,newEndNode,newEndOffset,isMarked);
    update();
    if (!keepActiveHandle)
        activeHandle = HANDLE_NONE;
}

// public
export function clear(): void {
    UndoManager.setProperty(internalSelection,"value",null);
    update();
}

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
//                                  Other selection functions                                 //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////

let selectionDivs: HTMLElement[] = [];
let selectionHighlights: HTMLElement[] = [];
let tableSelection: Tables.TableRegion = null;

// public (for tests)
export function updateTableSelection(selRange: Range.Range): boolean {
    tableSelection = Tables.regionFromRange(selRange);
    if (tableSelection == null)
        return false;

    Range.trackWhileExecuting(selRange,function() {

        removeSelectionHighlights(getRangeData(null));

        let sel = tableSelection;

        let topLeftTD = Tables.Table_get(sel.structure,sel.top,sel.left);
        let bottomRightTD = Tables.Table_get(sel.structure,sel.bottom,sel.right);

        let topLeftRect = topLeftTD.element.getBoundingClientRect();
        let bottomRightRect = bottomRightTD.element.getBoundingClientRect();

        let left = topLeftRect.left;
        let top = topLeftRect.top;

        let bottom = bottomRightRect.bottom;
        let right = bottomRightRect.right;

        let x = left;
        let y = top;
        let width = right - left;
        let height = bottom - top;

        x += window.scrollX;
        y += window.scrollY;

        let div = makeSelectionDiv();
        DOM.setAttribute(div,"class",Types.Keys.SELECTION_HIGHLIGHT);
        DOM.setStyleProperties(div,{ "position": "absolute",
                                     "left": x+"px",
                                     "top": y+"px",
                                     "width": width+"px",
                                     "height": height+"px",
                                     "background-color": "rgb(201,221,238)",
                                     "z-index": -1 });

        setTableEdges(x,y,width,height);
        setEditorHandles(new TableHandles(x,y,width,height));
    });

    setInternal(selRange.start.node,selRange.start.offset,
                selRange.end.node,selRange.end.offset);

    return true;
}

function makeSelectionDiv(): HTMLElement {
    let div = DOM.createElement(document,"DIV");
    DOM.appendChild(document.body,div);
    selectionDivs.push(div);
    return div;
}

function setTableEdges(x: number, y: number, width: number, height: number): void {
    let left = makeSelectionDiv();
    let right = makeSelectionDiv();
    let top = makeSelectionDiv();
    let bottom = makeSelectionDiv();

    let thick = 2;
    width++;
    height++;
    setBoxCoords(left,x-thick,y-thick,thick,height+2*thick);
    setBoxCoords(right,x+width,y-thick,thick,height+2*thick);
    setBoxCoords(top,x-thick,y-thick,width+2*thick,thick);
    setBoxCoords(bottom,x-thick,y+height,width+2*thick,thick);

    function setBoxCoords(box: HTMLElement, x: number, y: number, width: number, height: number): void {
        DOM.setStyleProperties(box,{ "position": "absolute",
                                     "left": x+"px",
                                     "top": y+"px",
                                     "width": width+"px",
                                     "height": height+"px",
                                     "background-color": "blue",
                                     "z-index": 1 });
    }
}

class EditorHandles { }

class TableHandles extends EditorHandles {
    constructor(
        public x: number,
        public y: number,
        public width: number,
        public height: number
    ) { super() }
}

class CursorHandles extends EditorHandles {
    constructor(
        public left: number,
        public top: number,
        public width: number,
        public height: number
    ) { super(); }
}

class SelectionHandles extends EditorHandles {
    constructor(
        public x1: number,
        public y1: number,
        public height1: number,
        public x2: number,
        public y2: number,
        public height2: number,
        public boundsLeft: number,
        public boundsTop: number,
        public boundsRight: number,
        public boundsBottom: number
    ) { super(); }
}

class NoneHandles extends EditorHandles {
    constructor() { super(); }
}

let editorHandles: EditorHandles = new NoneHandles();
function setEditorHandles(info: EditorHandles): void {
    let oldEditorHandles = editorHandles;
    editorHandles = info;
    UndoManager.addAction(function() {
        setEditorHandles(oldEditorHandles);
    });
    if (info instanceof CursorHandles) {
        Callbacks.setCursor(info.left,info.top,info.width,info.height);
    }
    else if (info instanceof SelectionHandles) {
        if (!isMarked()) {
            Callbacks.setSelectionHandles(info.x1,info.y1,
                                       info.height1,info.x2,info.y2,info.height2);
        }
        Callbacks.setSelectionBounds(info.boundsLeft,info.boundsTop,
                                  info.boundsRight,info.boundsBottom);
    }
    else if (info instanceof TableHandles) {
        Callbacks.setTableSelection(info.x,info.y,info.width,info.height);
    }
    else {
        Callbacks.clearSelectionHandlesAndCursor();
    }
}

function getPrevHighlightText(node: Node): Text {
    if ((node.previousSibling != null) && Types.isSelectionHighlight(node.previousSibling)) {
        let lastChild = node.previousSibling.lastChild;
        if ((lastChild != null) && (lastChild instanceof Text))
            return lastChild;
    }
    return null;
}

function getNextHighlightText(node: Node): Text {
    if ((node.nextSibling != null) && Types.isSelectionHighlight(node.nextSibling)) {
        let firstChild = node.nextSibling.firstChild;
        if ((firstChild != null) && (firstChild instanceof Text))
            return firstChild;
    }
    return null;
}

function getTextNodeBefore(node: Node): Text {
    let prev = node.previousSibling;
    if ((prev != null) && (prev instanceof Text)) {
        return prev;
    }
    else {
        let text = DOM.createTextNode(document,"");
        DOM.insertBefore(node.parentNode,text,node);
        return text;
    }
}

function getTextNodeAfter(node: Node): Text {
    let next = node.nextSibling;
    if ((next != null) && (next instanceof Text)) {
        return next;
    }
    else {
        let text = DOM.createTextNode(document,"");
        DOM.insertBefore(node.parentNode,text,node.nextSibling);
        return text;
    }
}

function setSelectionHighlights(highlights: HTMLElement[]): void {
    UndoManager.addAction(setSelectionHighlights,selectionHighlights);
    selectionHighlights = highlights;
}

function createSelectionHighlights(data: RangeData): void {
    let newHighlights = Util.arrayCopy(selectionHighlights);

    let outermost = data.outermost;
    for (let i = 0; i < outermost.length; i++) {
        recurse(outermost[i]);
    }

    setSelectionHighlights(newHighlights);

    function recurse(node: Node): void {
        if (Types.isSpecialBlockNode(node)) {
            if (!Types.isSelectionHighlight(node.parentNode)) {
                let wrapped = DOM.wrapNode(node,"DIV");
                DOM.setAttribute(wrapped,"class",Types.Keys.SELECTION_CLASS);
                newHighlights.push(wrapped);
            }
        }
        else if (Types.isNoteNode(node)) {
            if (!Types.isSelectionHighlight(node.parentNode)) {
                let wrapped = DOM.wrapNode(node,"SPAN");
                DOM.setAttribute(wrapped,"class",Types.Keys.SELECTION_CLASS);
                newHighlights.push(wrapped);
            }
        }
        else if (node instanceof Text) {
            createTextHighlight(node,data,newHighlights);
        }
        else {
            let next: Node;
            for (let child = node.firstChild; child != null; child = next) {
                next = child.nextSibling;
                recurse(child);
            }
        }
    }
}

function createTextHighlight(node: Text, data: RangeData, newHighlights: HTMLElement[]): void {
    let selRange = data.range;
    if (Types.isSelectionHighlight(node.parentNode)) {

        if ((node == selRange.end.node) && (node.nodeValue.length > selRange.end.offset)) {
            let destTextNode = getTextNodeAfter(node.parentNode);
            DOM.moveCharacters(node,
                               selRange.end.offset,
                               node.nodeValue.length,
                               destTextNode,0,
                               true,false);
        }
        if ((node == selRange.start.node) && (selRange.start.offset > 0)) {
            let destTextNode = getTextNodeBefore(node.parentNode);
            DOM.moveCharacters(node,
                               0,
                               selRange.start.offset,
                               destTextNode,destTextNode.nodeValue.length,
                               false,true);
        }

        return;
    }

    let anext: Node;
    for (let a: Node = node; a != null; a = anext) {
        anext = a.parentNode;
        if (Types.isSelectionHighlight(a))
            DOM.removeNodeButKeepChildren(a);
    }

    if (node == selRange.end.node) {
        if (Util.isWhitespaceString(node.nodeValue.substring(0,selRange.end.offset)))
            return;
        Formatting.splitTextAfter(selRange.end,
                                  function() { return true; });
    }


    if (node == selRange.start.node) {
        if (Util.isWhitespaceString(node.nodeValue.substring(selRange.start.offset)))
            return;
        Formatting.splitTextBefore(selRange.start,
                                   function() { return true; });
    }

    let prevText = getPrevHighlightText(node);
    let nextText = getNextHighlightText(node);

    if ((prevText != null) && containsSelection(data.nodeSet,prevText)) {
        DOM.moveCharacters(node,0,node.nodeValue.length,
                           prevText,prevText.nodeValue.length,true,false);
        DOM.deleteNode(node);
    }
    else if ((nextText != null) && containsSelection(data.nodeSet,nextText)) {
        DOM.moveCharacters(node,0,node.nodeValue.length,
                           nextText,0,false,true);
        DOM.deleteNode(node);
    }
    else if (!Traversal.isWhitespaceTextNode(node)) {
        // Call moveCharacters() with an empty range, to force any tracked positions
        // that are at the end of prevText or the start of nextText to move into this
        // node
        if (prevText != null) {
            DOM.moveCharacters(prevText,
                               prevText.nodeValue.length,prevText.nodeValue.length,
                               node,0);
        }
        if (nextText != null) {
            DOM.moveCharacters(nextText,0,0,node,node.nodeValue.length);
        }

        let wrapped = DOM.wrapNode(node,"SPAN");
        DOM.setAttribute(wrapped,"class",Types.Keys.SELECTION_CLASS);
        newHighlights.push(wrapped);
    }
}

interface RangeData {
    range: Range.Range;
    nodeSet: Collections.NodeSet;
    nodes: Node[];
    outermost: Node[];
}

function getRangeData(selRange: Range.Range): RangeData {
    let nodeSet = new Collections.NodeSet();
    let nodes: Node[];
    let outermost: Node[];
    if (selRange != null) {
        outermost = Range.getOutermostNodes(selRange);
        nodes = Range.getAllNodes(selRange);
        for (let i = 0; i < nodes.length; i++)
            nodeSet.add(nodes[i]);
    }
    else {
        nodes = new Array();
        outermost = new Array();
    }
    return { range: selRange, nodeSet: nodeSet, nodes: nodes, outermost: outermost };
}

function removeSelectionHighlights(data: RangeData, force?: boolean): void {
    let selectedSet = data.nodeSet;

    let remainingHighlights = new Array();
    let checkMerge = new Array();
    for (let i = 0; i < selectionHighlights.length; i++) {
        let span = selectionHighlights[i];
        if ((span.parentNode != null) && (force || !containsSelection(selectedSet,span))) {
            if (span.firstChild != null)
                checkMerge.push(span.firstChild);
            if (span.lastChild != null)
                checkMerge.push(span.lastChild);

            DOM.removeNodeButKeepChildren(span);
        }
        else if (span.parentNode != null) {
            remainingHighlights.push(span);
        }
    }
    setSelectionHighlights(remainingHighlights);

    for (let i = 0; i < checkMerge.length; i++) {
        // if not already merged
        if ((checkMerge[i] != null) && (checkMerge[i].parentNode != null)) {
            Formatting.mergeWithNeighbours(checkMerge[i],[]);
        }
    }
}

function containsSelection(selectedSet: Collections.NodeSet, node: Node): boolean {
    if (selectedSet.contains(node))
        return true;
    for (let child = node.firstChild; child != null; child = child.nextSibling) {
        if (containsSelection(selectedSet,child))
            return true;
    }
    return false;
}

export function update(): void {
    let selRange = get();
    let selMarked = isMarked();

    Range.trackWhileExecuting(selRange,function() {
        // Remove table selection DIVs
        for (let i = 0; i < selectionDivs.length; i++)
            DOM.deleteNode(selectionDivs[i]);
        selectionDivs = new Array();
    });

    if (selRange == null) {
        DOM.ignoreMutationsWhileExecuting(function() {
            removeSelectionHighlights(getRangeData(null));
        });
        return;
    }

    Range.assertValid(selRange,"Selection");

    if (Range.isEmpty(selRange)) {
        // We just have a cursor

        Range.trackWhileExecuting(selRange,function() {
            DOM.ignoreMutationsWhileExecuting(function() {
                removeSelectionHighlights(getRangeData(selRange));
            });
        });
        // Selection may have changed as a result of removeSelectionHighlights()
        setInternal(selRange.start.node,selRange.start.offset,
                              selRange.end.node,selRange.end.offset,
                              selMarked);
        selRange = get(); // since setInternal can theoretically change it

        // If we can't find the cursor rect for some reason, just don't update the position.
        // This is better than using an incorrect position or throwing an exception.
        let rect = Geometry.displayRectAtPos(selRange.end);
        if (rect != null) {
            let left = rect.left + window.scrollX;
            let top = rect.top + window.scrollY;
            let height = rect.height;
            let width = rect.width ? rect.width : 2;
            setEditorHandles(new CursorHandles(left,top,width,height));
        }
        return;
    }

    if (updateTableSelection(selRange))
        return;

    let rects = Range.getClientRects(selRange);

    if ((rects != null) && (rects.length > 0)) {
        let boundsLeft: number = null;
        let boundsRight: number = null;
        let boundsTop: number = null;
        let boundsBottom: number = null

        for (let i = 0; i < rects.length; i++) {
            let left = rects[i].left + window.scrollX;
            let top = rects[i].top + window.scrollY;
            let width = rects[i].width;
            let height = rects[i].height;
            let right = left + width;
            let bottom = top + height;

            if (boundsLeft == null) {
                boundsLeft = left;
                boundsTop = top;
                boundsRight = right;
                boundsBottom = bottom;
            }
            else {
                if (boundsLeft > left)
                    boundsLeft = left;
                if (boundsRight < right)
                    boundsRight = right;
                if (boundsTop > top)
                    boundsTop = top;
                if (boundsBottom < bottom)
                    boundsBottom = bottom;
            }
        }

        Range.trackWhileExecuting(selRange,function() {
            DOM.ignoreMutationsWhileExecuting(function() {
                let data = getRangeData(selRange);
                createSelectionHighlights(data);
                removeSelectionHighlights(data);
            });
        });

        // Selection may have changed as a result of create/removeSelectionHighlights()
        setInternal(selRange.start.node,selRange.start.offset,
                              selRange.end.node,selRange.end.offset,
                              selMarked);

        let firstRect = rects[0];
        let lastRect = rects[rects.length-1];

        let x1 = firstRect.left + window.scrollX;
        let y1 = firstRect.top + window.scrollY;
        let height1 = firstRect.height;
        let x2 = lastRect.right + window.scrollX;
        let y2 = lastRect.top + window.scrollY;
        let height2 = lastRect.height;

        setEditorHandles(new SelectionHandles(x1,y1,height1,x2,y2,height2,
            boundsLeft,boundsTop,boundsRight,boundsBottom));

    }
    else {
        setEditorHandles(new NoneHandles());
    }
}

// public
export function selectAll(): void {
    set(document.body,0,document.body,document.body.childNodes.length);
}

// public
export function selectParagraph(): void {
    let selRange = get();
    if (selRange == null)
        return;
    let startNode = Position.closestActualNode(selRange.start);
    while (!Types.isParagraphNode(startNode) && !Types.isContainerNode(startNode))
        startNode = startNode.parentNode;

    let endNode = Position.closestActualNode(selRange.end);
    while (!Types.isParagraphNode(endNode) && !Types.isContainerNode(endNode))
        endNode = endNode.parentNode;

    let startPos = new Position.Position(startNode,0);
    let endPos = new Position.Position(endNode,DOM.maxChildOffset(endNode));
    startPos = Position.closestMatchForwards(startPos,Position.okForMovement);
    endPos = Position.closestMatchBackwards(endPos,Position.okForMovement);

    set(startPos.node,startPos.offset,endPos.node,endPos.offset);
}

// private
function getPunctuationCharsForRegex(): string {
    let escaped = "^$\\.*+?()[]{}|"; // From ECMAScript regexp spec (PatternCharacter)
    let unescaped = "";
    for (let i = 32; i <= 127; i++) {
        let c = String.fromCharCode(i);
        if ((escaped.indexOf(c) < 0) && !c.match(/[\w\d]/))
            unescaped += c;
    }
    return unescaped + escaped.replace(/(.)/g,"\\$1");
}

// The following regular expressions are used by selectWordAtCursor(). We initialise them at
// startup to avoid repeatedly initialising them.
let punctuation = getPunctuationCharsForRegex();
let wsPunctuation = "\\s"+punctuation;

// Note: We use a blacklist of punctuation characters here instead of a whitelist of "word"
// characters, as the \w character class in javascript regular expressions only matches
// characters in english words. By using a blacklist, and assuming every other character is
// part of a word, we can select words containing non-english characters. This isn't a perfect
// solution, because there are many unicode characters that represent punctuation as well, but
// at least we handle the common ones here.

let reOtherEnd = new RegExp("["+wsPunctuation+"]*$");
let reOtherStart = new RegExp("^["+wsPunctuation+"]*");
let reWordOtherEnd = new RegExp("[^"+wsPunctuation+"]*["+wsPunctuation+"]*$");
let reWordOtherStart = new RegExp("^["+wsPunctuation+"]*[^"+wsPunctuation+"]*");

let reWordStart = new RegExp("^[^"+wsPunctuation+"]+");
let reWordEnd = new RegExp("[^"+wsPunctuation+"]+$");

export function posAtStartOfWord(pos: Position.Position): Position.Position {
    let node = pos.node;
    let offset = pos.offset;

    if (node instanceof Text) {
        let before = node.nodeValue.substring(0,offset);
        let matches = before.match(reWordEnd);
        if (matches) {
            let wordStart = offset - matches[0].length;
            return new Position.Position(node,wordStart);
        }
    }

    return pos;
}

export function posAtEndOfWord(pos: Position.Position): Position.Position {
    let node = pos.node;
    let offset = pos.offset;

    if (node instanceof Text) {
        let after = node.nodeValue.substring(offset);
        let matches = after.match(reWordStart);
        if (matches) {
            let wordEnd = offset + matches[0].length;
            return new Position.Position(node,wordEnd);
        }
    }

    return pos;
}

function rangeOfWordAtPos(pos: Position.Position): Range.Range {
    let node = pos.node;
    let offset = pos.offset;

    if (node instanceof Text) {
        let before = node.nodeValue.substring(0,offset);
        let after = node.nodeValue.substring(offset);

        let otherBefore = before.match(reOtherEnd)[0];
        let otherAfter = after.match(reOtherStart)[0];

        let wordOtherBefore = before.match(reWordOtherEnd)[0];
        let wordOtherAfter = after.match(reWordOtherStart)[0];

        let startOffset = offset;
        let endOffset = offset;

        let haveWordBefore = (wordOtherBefore.length != otherBefore.length);
        let haveWordAfter = (wordOtherAfter.length != otherAfter.length);

        if ((otherBefore.length == 0) && (otherAfter.length == 0)) {
            startOffset = offset - wordOtherBefore.length;
            endOffset = offset + wordOtherAfter.length;
        }
        else if (haveWordBefore && !haveWordAfter) {
            startOffset = offset - wordOtherBefore.length;
        }
        else if (haveWordAfter && !haveWordBefore) {
            endOffset = offset + wordOtherAfter.length;
        }
        else if (otherBefore.length <= otherAfter.length) {
            startOffset = offset - wordOtherBefore.length;
        }
        else {
            endOffset = offset + wordOtherAfter.length;
        }

        return new Range.Range(node,startOffset,node,endOffset);
    }
    else if (node instanceof Element) {
        let nodeBefore = node.childNodes[offset-1];
        let nodeAfter = node.childNodes[offset];

        if ((nodeBefore != null) && !Traversal.isWhitespaceTextNode(nodeBefore))
            return new Range.Range(node,offset-1,node,offset);
        else if ((nodeAfter != null) && !Traversal.isWhitespaceTextNode(nodeAfter))
            return new Range.Range(node,offset,node,offset+1);
    }

    return null;
}

// public
export function selectWordAtCursor(): void {
    let selRange = get();
    if (selRange == null)
        return;

    let pos = Position.closestMatchBackwards(selRange.end,Position.okForMovement);
    let range = rangeOfWordAtPos(pos);
    if (range != null) {
        set(range.start.node,range.start.offset,range.end.node,range.end.offset);
    }
}

// public
export function dragSelectionBegin(x: number, y: number, selectWord: boolean): string {
    let pos = Position.closestMatchForwards(Geometry.positionAtPoint(x,y),Position.okForMovement);

    if (pos == null) {
        clear();
        return "error";
    }

    set(pos.node,pos.offset,pos.node,pos.offset);

    if (selectWord)
        selectWordAtCursor();

    return "end";
}

let selectionHandleEnd = true;

function toStartOfWord(pos: Position.Position): Position.Position {
    if (Input.isAtWordBoundary(pos,"backward"))
        return pos;
    let boundary = Input.toWordBoundary(pos,"backward");
    return (boundary != null) ? boundary : pos;
}

function toEndOfWord(pos: Position.Position): Position.Position {
    if (Input.isAtWordBoundary(pos,"forward"))
        return pos;
    let boundary = Input.toWordBoundary(pos,"forward");
    return (boundary != null) ? boundary : pos;
}

// public
export function dragSelectionUpdate(x: number, y: number, selectWord: boolean): string {
    y = Cursor.scrollDocumentForY(y);

    let pos = Position.closestMatchForwards(Geometry.positionAtPoint(x,y),Position.okForMovement);
    let selRange = get();
    if ((pos == null) || (selRange == null))
        return "none";

    let start = selRange.start;
    let end = selRange.end;

    if (selectionHandleEnd) {
        if (Position.compare(pos,start) < 0) {
            if (selectWord)
                pos = toStartOfWord(pos);
            selectionHandleEnd = false;
        }
        else {
            if (selectWord)
                pos = toEndOfWord(pos);
        }
        set(start.node,start.offset,pos.node,pos.offset);
    }
    else {
        if (Position.compare(pos,end) > 0) {
            if (selectWord)
                pos = toEndOfWord(pos);
            selectionHandleEnd = true;
        }
        else {
            if (selectWord)
                pos = toStartOfWord(pos);
        }
        set(pos.node,pos.offset,end.node,end.offset);
    }

    return selectionHandleEnd ? "end" : "start";
}

// FIXME: TS: I think TS lets us restrict the set of strings that can be used - do this here
function moveBoundary(command: string): string {
    let range = get();
    if (range == null)
        return null;

    let pos: Position.Position = null;
    if (command == "start-left")
        range.start = pos = Position.prevMatch(range.start,Position.okForMovement);
    else if (command == "start-right")
        range.start = pos = Position.nextMatch(range.start,Position.okForMovement);
    else if (command == "end-left")
        range.end = pos = Position.prevMatch(range.end,Position.okForMovement);
    else if (command == "end-right")
        range.end = pos = Position.nextMatch(range.end,Position.okForMovement);

    if ((range.start != null) && (range.end != null)) {
        range = Range.forwards(range);
        set(range.start.node,range.start.offset,range.end.node,range.end.offset);
        if (range.end == pos)
            return "end";
        else if (range.end == pos)
            return "start";
    }
    return null;
}

// public
export function moveStartLeft(): string {
    return moveBoundary("start-left");
}

// public
export function moveStartRight(): string {
    return moveBoundary("start-right");
}

// public
export function moveEndLeft(): string {
    return moveBoundary("end-left");
}

// public
export function moveEndRight(): string {
    return moveBoundary("end-right");
}

// public
export function setSelectionStartAtCoords(x: number, y: number): void {
    let position = Position.closestMatchForwards(Geometry.positionAtPoint(x,y),Position.okForMovement);
    if (position != null) {
        position = Position.closestMatchBackwards(position,Position.okForMovement);
        let selRange = get();
        let newRange = new Range.Range(position.node,position.offset,
                                 selRange.end.node,selRange.end.offset);
        if (Range.isForwards(newRange)) {
            set(newRange.start.node,newRange.start.offset,
                          newRange.end.node,newRange.end.offset);
        }
    }
}

// public
export function setSelectionEndAtCoords(x: number, y: number): void {
    let position = Position.closestMatchForwards(Geometry.positionAtPoint(x,y),Position.okForMovement);
    if (position != null) {
        position = Position.closestMatchBackwards(position,Position.okForMovement);
        let selRange = get();
        let newRange = new Range.Range(selRange.start.node,selRange.start.offset,
                                 position.node,position.offset);
        if (Range.isForwards(newRange)) {
            set(newRange.start.node,newRange.start.offset,
                          newRange.end.node,newRange.end.offset);
        }
    }
}

// public
// FIXME: TS: I think TS lets us restrict the set of strings that can be used - do this here
export function setTableSelectionEdgeAtCoords(edge: string, x: number, y: number): void {
    if (tableSelection == null)
        return;

    let structure = tableSelection.structure;
    let pointInfo = findCellInTable(structure,x,y);
    if (pointInfo == null)
        return;

    if (edge == "topLeft") {
        if (pointInfo.row <= tableSelection.bottom)
            tableSelection.top = pointInfo.row;
        if (pointInfo.col <= tableSelection.right)
            tableSelection.left = pointInfo.col;
    }
    else if (edge == "bottomRight") {
        if (pointInfo.row >= tableSelection.top)
            tableSelection.bottom = pointInfo.row;
        if (pointInfo.col >= tableSelection.left)
            tableSelection.right = pointInfo.col;
    }

    // FIXME: handle the case where there is no cell at the specified row and column
    let topLeftCell = Tables.Table_get(structure,tableSelection.top,tableSelection.left);
    let bottomRightCell = Tables.Table_get(structure,tableSelection.bottom,tableSelection.right);

    let topLeftNode = topLeftCell.element.parentNode;
    let topLeftOffset = DOM.nodeOffset(topLeftCell.element);
    let bottomRightNode = bottomRightCell.element.parentNode;
    let bottomRightOffset = DOM.nodeOffset(bottomRightCell.element)+1;

    set(topLeftNode,topLeftOffset,bottomRightNode,bottomRightOffset);

    // FIXME: this could possibly be optimised
    function findCellInTable(structure: Tables.Table, x: number, y: number): Tables.Cell {
        for (let r = 0; r < structure.numRows; r++) {
            for (let c = 0; c < structure.numCols; c++) {
                let cell = Tables.Table_get(structure,r,c);
                if (cell != null) {
                    let rect = cell.element.getBoundingClientRect();
                    if ((x >= rect.left) && (x <= rect.right) &&
                        (y >= rect.top) && (y <= rect.bottom))
                        return cell;
                }
            }
        }
        return null;
    }
}

// public
export function setEmptySelectionAt(node: Node, offset: number): void {
    set(node,offset,node,offset);
}

// private
function deleteTextSelection(selRange: Range.Range, keepEmpty: boolean): void {
    let nodes = Range.getOutermostNodes(selRange);
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];

        let removeWholeNode = false;

        if ((node == selRange.start.node) &&
            (node == selRange.end.node)) {
            let startOffset = selRange.start.offset;
            let endOffset = selRange.end.offset;
            if ((node instanceof Text) &&
                ((startOffset > 0) || (endOffset < node.nodeValue.length))) {
                DOM.deleteCharacters(node,startOffset,endOffset);
            }
            else {
                removeWholeNode = true;
            }
        }
        else if (node == selRange.start.node) {
            let offset = selRange.start.offset;
            if ((node instanceof Text) && (offset > 0)) {
                DOM.deleteCharacters(node,offset);
            }
            else {
                removeWholeNode = true;
            }
        }
        else if (node == selRange.end.node) {
            let offset = selRange.end.offset;
            if ((node instanceof Text) && (offset < node.nodeValue.length)) {
                DOM.deleteCharacters(node,0,offset);
            }
            else {
                removeWholeNode = true;
            }
        }
        else {
            removeWholeNode = true;
        }

        if (removeWholeNode) {
            switch (node._type) {
            case ElementTypes.HTML_TD:
            case ElementTypes.HTML_TH:
                DOM.deleteAllChildren(node);
                break;
            default:
                DOM.deleteNode(node);
                break;
            }
        }
    }

    let detail = Range.detail(selRange);

    let sameTextNode = (selRange.start.node == selRange.end.node) &&
                       (selRange.start.node instanceof Text);

    if ((detail.startAncestor != null) && (detail.endAncestor != null) &&
        (detail.startAncestor.nextSibling == detail.endAncestor) &&
        !sameTextNode) {
        prepareForMerge(detail);
        DOM.mergeWithNextSibling(detail.startAncestor,
                                      Formatting.MERGEABLE_BLOCK_AND_INLINE);
        if (Types.isParagraphNode(detail.startAncestor) &&
            (detail.startAncestor._type != ElementTypes.HTML_DIV))
            removeParagraphDescendants(detail.startAncestor);
    }

    if (!keepEmpty) {
        let startNode = selRange.start.node;
        let endNode = selRange.end.node;
        if (startNode.parentNode != null)
            delEmpty(selRange,startNode);
        if (endNode.parentNode != null)
            delEmpty(selRange,endNode);
    }

    Cursor.updateBRAtEndOfParagraph(Range.singleNode(selRange));
}

function delEmpty(selRange: Range.Range, node: Node): void {
    while ((node != document.body) &&
           (node instanceof Element) &&
           (node.firstChild == null)) {

        if (Types.isTableCell(node) || Types.isTableCell(node.parentNode))
            return;

        if (!fixPositionOutside(selRange.start,node))
            break;
        if (!fixPositionOutside(selRange.end,node))
            break;

        let parent = node.parentNode;
        Range.trackWhileExecuting(selRange,function() {
            DOM.deleteNode(node);
        });
        node = parent;
    }
}

function fixPositionOutside(pos: Position.Position, node: Node): boolean {
    if (pos.node == node) {
        let before = new Position.Position(node.parentNode,DOM.nodeOffset(node));
        let after = new Position.Position(node.parentNode,DOM.nodeOffset(node)+1);
        before = Position.prevMatch(before,Position.okForMovement);
        after = Position.nextMatch(after,Position.okForMovement);

        if (before != null) {
            pos.node = before.node;
            pos.offset = before.offset;
        }
        else if (after != null) {
            pos.node = after.node;
            pos.offset = after.offset;
        }
        else {
            return false;
        }
    }
    return true;
}

export function deleteRangeContents(range: Range.Range, keepEmpty: boolean): void {
    Range.trackWhileExecuting(range,function() {
        DOM.ignoreMutationsWhileExecuting(function() {
            removeSelectionHighlights(getRangeData(range),true);
        });

        let region = Tables.regionFromRange(range);
        if (region != null)
            Tables.deleteRegion(region);
        else
            deleteTextSelection(range,keepEmpty);
    });

    set(range.start.node,range.start.offset,range.start.node,range.start.offset);
}

export function deleteContents(keepEmpty?: boolean): void {
    let range = get();
    if (range == null)
        return;
    deleteRangeContents(range,keepEmpty);
}

// private
function removeParagraphDescendants(parent: Node): void {
    let next: Node;
    for (let child = parent.firstChild; child != null; child = next) {
        next = child.nextSibling;
        removeParagraphDescendants(child);
        if (Types.isParagraphNode(child))
            DOM.removeNodeButKeepChildren(child);
    }
}

// private
function findFirstParagraph(node: Node): HTMLElement {
    if ((node instanceof HTMLElement) && Types.isParagraphNode(node))
        return node;
    if (node._type == ElementTypes.HTML_LI) {
        let nonWhitespaceInline = false;

        for (let child = node.firstChild; child != null; child = child.nextSibling) {
            if (Types.isInlineNode(child) && !Traversal.isWhitespaceTextNode(child))
                nonWhitespaceInline = true;

            if ((child instanceof HTMLElement) && Types.isParagraphNode(child)) {
                if (nonWhitespaceInline)
                    return putPrecedingSiblingsInParagraph(node,child);
                return child;
            }
            else if (Types.isListNode(child)) {
                if (nonWhitespaceInline)
                    return putPrecedingSiblingsInParagraph(node,child);
                return findFirstParagraph(child);
            }
        }
        if (nonWhitespaceInline)
            return putPrecedingSiblingsInParagraph(node,null);
    }
    return null;

    function putPrecedingSiblingsInParagraph(parent: Node, node: Node): HTMLElement {
        let p = DOM.createElement(document,"P");
        while (parent.firstChild != node)
            DOM.appendChild(p,parent.firstChild);
        return p;
    }
}

// private
function prepareForMerge(detail: Range.RangeDetail): void {
    if (Types.isParagraphNode(detail.startAncestor) && Types.isInlineNode(detail.endAncestor)) {
        let name = detail.startAncestor.nodeName; // check-ok
        let newParagraph = DOM.createElement(document,name);
        DOM.insertBefore(detail.endAncestor.parentNode,newParagraph,detail.endAncestor);
        DOM.appendChild(newParagraph,detail.endAncestor);
        detail.endAncestor = newParagraph;
    }
    else if (Types.isInlineNode(detail.startAncestor) && Types.isParagraphNode(detail.endAncestor)) {
        let name = detail.endAncestor.nodeName; // check-ok
        let newParagraph = DOM.createElement(document,name);
        DOM.insertBefore(detail.startAncestor.parentNode,newParagraph,
                         detail.startAncestor.nextSibling);
        DOM.appendChild(newParagraph,detail.startAncestor);
        detail.startAncestor = newParagraph;
    }
    else if (Types.isParagraphNode(detail.startAncestor) &&
             Types.isListNode(detail.endAncestor) &&
             (detail.endAncestor.firstChild._type == ElementTypes.HTML_LI)) {
        let list = detail.endAncestor;
        let li = detail.endAncestor.firstChild;

        let paragraph = findFirstParagraph(li);
        if (paragraph != null) {
            DOM.insertBefore(list.parentNode,paragraph,list);
            let name = detail.startAncestor.nodeName; // check-ok
            DOM.replaceElement(paragraph,name);
        }
        if (!Types.nodeHasContent(li))
            DOM.deleteNode(li);
        if (Traversal.firstChildElement(list) == null)
            DOM.deleteNode(list);
    }
    else if (Types.isParagraphNode(detail.endAncestor) &&
             Types.isListNode(detail.startAncestor) &&
             (detail.startAncestor.lastChild._type == ElementTypes.HTML_LI)) {
        let list = detail.startAncestor;
        let li = detail.startAncestor.lastChild;
        let p = detail.endAncestor;
        let oldLastChild = li.lastChild;
        while (p.firstChild != null)
            DOM.insertBefore(li,p.firstChild,null);
        DOM.deleteNode(p);
        if (oldLastChild != null) {
            DOM.mergeWithNextSibling(oldLastChild,
                                          Formatting.MERGEABLE_BLOCK_AND_INLINE);
        }
    }

    if ((detail.startAncestor.lastChild != null) && (detail.endAncestor.firstChild != null)) {
        let childDetail: any = new Object();
        childDetail.startAncestor = detail.startAncestor.lastChild;
        childDetail.endAncestor = detail.endAncestor.firstChild;
        prepareForMerge(childDetail);
    }
}

// public
export function clearSelection(): void {
    clear();
}

// public
export function preserveWhileExecuting<T>(fun: () => T): T {
    let range = get();
    let result: T;

    // Since the selection may have changed as a result of changes to the document, we
    // have to call clear() or set() so that undo history is saved
    if (range == null) {
        result = fun();
        clear();
    }
    else {
        result = Range.trackWhileExecuting(range,fun);
        set(range.start.node,range.start.offset,range.end.node,range.end.offset);
    }
    return result;
}

export function preferElementPositions(): void {
    let range = get();
    if (range == null)
        return;
    range.start = Position.preferElementPosition(range.start);
    range.end = Position.preferElementPosition(range.end);
    set(range.start.node,range.start.offset,
                  range.end.node,range.end.offset);
}

function getBoundaryContainer(node: Node, topAncestor: Node): HTMLElement {
    let container = document.body;
    for (; node != topAncestor.parentNode; node = node.parentNode) {
        if (node instanceof HTMLElement) {
            switch (node._type) {
            case ElementTypes.HTML_FIGURE:
            case ElementTypes.HTML_TABLE:
                container = node;
                break;
            }
        }
    }
    return container;
}

function boundaryCompliantRange(range: Range.Range): Range.Range {
    if (range == null)
        return null;

    let detail = Range.detail(range);
    let start = range.start;
    let end = range.end;
    let startNode = Position.closestActualNode(start);
    let endNode = Position.closestActualNode(end);
    let startContainer = getBoundaryContainer(startNode.parentNode,detail.commonAncestor);
    let endContainer = getBoundaryContainer(endNode.parentNode,detail.commonAncestor);

    if (startContainer != endContainer) {

        let doStart = false;
        let doEnd = false;

        if (nodeHasAncestor(startContainer,endContainer)) {
            doStart = true;
        }
        else if (nodeHasAncestor(endContainer,startContainer)) {
            doEnd = true;
        }
        else {
            doStart = true;
            doEnd = true;
        }

        if (doStart && (startContainer != document.body))
            start = new Position.Position(startContainer.parentNode,DOM.nodeOffset(startContainer));
        if (doEnd && (endContainer != document.body))
            end = new Position.Position(endContainer.parentNode,DOM.nodeOffset(endContainer)+1);
    }
    return new Range.Range(start.node,start.offset,end.node,end.offset);

    function nodeHasAncestor(node: Node, ancestor: Node): boolean {
        for (; node != null; node = node.parentNode) {
            if (node == ancestor)
                return true;
        }
        return false;
    }
}

export function print(): void {
    Callbacks.debug("");
    Callbacks.debug("");
    Callbacks.debug("");
    Callbacks.debug("================================================================================");

    let sel = get();
    if (sel == null) {
        Callbacks.debug("No selection");
        return;
    }

    printSelectionElement(document.body,"");

    function printSelectionElement(node: HTMLElement, indent: string): void {
        let className = DOM.getAttribute(node,"class");
        if (className != null)
            Callbacks.debug(indent+node.nodeName+" ("+className+")");
        else
            Callbacks.debug(indent+node.nodeName);

        let child = node.firstChild;
        let offset = 0;
        while (true) {

            let isStart = ((sel.start.node == node) && (sel.start.offset == offset));
            let isEnd = ((sel.end.node == node) && (sel.end.offset == offset));
            if (isStart && isEnd)
                Callbacks.debug(indent+"    []");
            else if (isStart)
                Callbacks.debug(indent+"    [");
            else if (isEnd)
                Callbacks.debug(indent+"    ]");

            if (child == null)
                break;

            if (child instanceof HTMLElement)
                printSelectionElement(child,indent+"    ");
            else if (child instanceof Text)
                printSelectionText(child,indent+"    ");

            child = child.nextSibling;
            offset++;
        }
    }

    function printSelectionText(node: Text, indent: string): void {
        let value = node.nodeValue;

        if (sel.end.node == node) {
            let afterSelection = value.substring(sel.end.offset);
            value = value.substring(0,sel.end.offset) + "]" + afterSelection;
        }

        if (sel.start.node == node) {
            let beforeSelection = value.substring(0,sel.start.offset);
            value = beforeSelection + "[" + value.substring(sel.start.offset);
        }

        Callbacks.debug(indent+JSON.stringify(value));
    }
}
