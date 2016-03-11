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

import PostponedActions = require("./postponedActions");

import AutoCorrect = require("./autoCorrect");
import ChangeTracking = require("./changeTracking");
import Clipboard = require("./clipboard");
import Cursor = require("./cursor");
import Equations = require("./equations");
import Events = require("./events");
import Figures = require("./figures");
import Formatting = require("./formatting");
import InputRef = require("./inputref");
import Lists = require("./lists");
import Main = require("./main");
import Metadata = require("./metadata");
import Outline = require("./outline");
import Preview = require("./preview");
import Scan = require("./scan");
import Selection = require("./selection");
import Styles = require("./styles");
import Tables = require("./tables");
import UndoManager = require("./undo");
import Viewport = require("./viewport");

export interface LinkProperties {
    href: string;
    text: string;
}

export interface FigureProperties {
    width: string;
    src: string;
}

export interface FigureGeometry {
    contentRect: ClientRect;
    fullRect: ClientRect;
    parentRect: ClientRect;
    hasCaption: boolean;
}

export type Direction = "left" | "right" | "up" | "down" | "forward" | "backward";

export type Granularity = "character" | "word" | "sentence" | "paragraph" | "line" | "document";

export interface PositionRef {
    PositionRefId: string;
}

export interface RangeRef {
    start: PositionRef;
    end: PositionRef;
}

export interface RangeIds {
    startId: number;
    endId: number;
}

export interface EncodedOutline {
    sections: EncodedOutlineItem[];
    figures: EncodedOutlineItem[];
    tables: EncodedOutlineItem[];
}

export interface EncodedOutlineItem {
    id: string;
    number: string;
    children: EncodedOutlineItem[];
}

export interface PrintLayoutInfo {
    destsByPage: {
        [key: string]: {
            itemId: string;
            x: number;
            y: number }[]
        };
    linksByPage: {
        [key: string]: {
            pageNo: number;
            left: number;
            top: number;
            width: number;
            height: number;
            href: string }[]
         };
    leafRectsByPage: {
        [key: string]: {
            left: number;
            top: number;
            width: number;
            height: number; }[]
        };
}

export interface ScanParagraph {
    text: string;
    sectionId: string;
}

export interface Rule {
    [property: string]: string;
}

export interface RuleSet {
    [selector: string]: Rule;
}

export interface TableProperties {
    width: string;
    rows: number;
    cols: number;
}

export interface TableGeometry {
    contentRect: ClientRect;
    fullRect: ClientRect;
    parentRect: ClientRect;
    columnWidths: number[];
    hasCaption: boolean;
}

export interface EventReceiver {

    debug?(message: any): void;
    error?(error: string, type?: string): void;
    addOutlineItem?(itemId: string, type: string, title: string): void;
    updateOutlineItem?(itemId: string, title: string): void;
    removeOutlineItem?(itemId: string): void;
    outlineUpdated?(): void;
    setCursor?(x: number, y: number, width: number, height: number): void;
    setSelectionHandles?(x1: number, y1: number, height1: number, x2: number, y2: number, height2: number): void;
    setTableSelection?(x: number, y: number, width: number, height: number): void;
    setSelectionBounds?(left: number, top: number, right: number, bottom: number): void;
    clearSelectionHandlesAndCursor?(): void;
    updateAutoCorrect?(): void;
    documentModified?(): void;

}

function execute<T>(fun: () => T): T {
    try {
        let result = fun();
        PostponedActions.perform();
        return result;
    }
    finally {
        Events.executePending();
    }
}

function modify<T>(fun: () => T): T {
    try {
        let result = fun();
        PostponedActions.perform();
        return result;
    }
    finally {
        InputRef.invalidatePositions();
        Events.documentModified();
        Events.executePending();
    }
}

export module autoCorrect {

    export function correctPrecedingWord(numChars: number, replacement: string, confirmed: boolean): void {
        return modify(() => AutoCorrect.correctPrecedingWord(numChars,replacement,confirmed));
    }

    export function getCorrection(): { original: string; replacement: string } {
        return execute(() => AutoCorrect.getCorrection());
    }

    export function getCorrectionCoords(): { x: number, y: number } {
        return execute(() => AutoCorrect.getCorrectionCoords());
    }

    export function acceptCorrection(): void {
        return modify(() => AutoCorrect.acceptCorrection());
    }

    export function replaceCorrection(replacement: string): void {
        return modify(() => AutoCorrect.replaceCorrection(replacement));
    }

}

export module changeTracking {

    export function showChanges(): boolean {
        return execute(() => ChangeTracking.showChanges());
    }

    export function trackChanges(): boolean {
        return execute(() => ChangeTracking.trackChanges());
    }

    export function setShowChanges(enabled: boolean): void {
        return modify(() => ChangeTracking.setShowChanges(enabled));
    }

    export function setTrackChanges(enabled: boolean): void {
        return modify(() => ChangeTracking.setTrackChanges(enabled));
    }

}

export module events {

    export function getEventMessages(): string {
        // Note: We deliberately do not use execute() here
        return Events.getBackMessages();
    }

    export function setReceiver(receiver: EventReceiver): void {
        // Note: We deliberately do not use execute() here
        Events.setReceiver(receiver);
    }

}

export module clipboard {

    export function cut(): { [key: string]: string } {
        return modify(() => Clipboard.cut());
    }

    export function copy(): { [key: string]: string } {
        return execute(() => Clipboard.copy());
    }

    export function pasteText(text: string): void {
        return modify(() => Clipboard.pasteText(text));
    }

    export function pasteHTML(html: string): void {
        return modify(() => Clipboard.pasteHTML(html));
    }

}

export module cursor {

    export function positionCursor(x: number, y: number, wordBoundary: boolean): string {
        return execute(() => Cursor.positionCursor(x,y,wordBoundary));
    }

    export function getCursorPosition(): ClientRect {
        return execute(() => Cursor.getCursorPosition());
    }

    export function moveLeft(): void {
        return execute(() => Cursor.moveLeft());
    }

    export function moveRight(): void {
        return execute(() => Cursor.moveRight());
    }

    export function moveToStartOfDocument(): void {
        return execute(() => Cursor.moveToStartOfDocument());
    }

    export function moveToEndOfDocument(): void {
        return execute(() => Cursor.moveToEndOfDocument());
    }

    export function insertReference(itemId: string): void {
        return modify(() => Cursor.insertReference(itemId));
    }

    export function insertLink(text: string, url: string): void {
        return modify(() => Cursor.insertLink(text,url));
    }

    export function insertCharacter(str: string, allowInvalidPos: boolean): void {
        // FIXME: do we need to have the allowInvalidPos parameter? Should it be false by default
        // (to match the behaviour of the Objective C API)?
        return modify(() => Cursor.insertCharacter(str,allowInvalidPos,true));
    }

    export function deleteCharacter(): void {
        return modify(() => Cursor.deleteCharacter());
    }

    export function enterPressed(): void {
        return modify(() => Cursor.enterPressed());
    }

    export function getPrecedingWord(): string {
        return execute(() => Cursor.getPrecedingWord());
    }

    export function getLinkProperties(): LinkProperties {
        return execute(() => Cursor.getLinkProperties());
    }

    export function setLinkProperties(properties: LinkProperties): void {
        return modify(() => Cursor.setLinkProperties(properties));
    }

    export function setReferenceTarget(itemId: string): void {
        return modify(() => Cursor.setReferenceTarget(itemId));
    }

    export function insertFootnote(content: string): void {
        return modify(() => Cursor.insertFootnote(content));
    }

    export function insertEndnote(content: string): void {
        return modify(() => Cursor.insertEndnote(content));
    }

}

export module equations {

    export function insertEquation(): void {
        return modify(() => Equations.insertEquation());
    }

}

export module figures {

    export function insertFigure(filename: string, width: string, numbered: boolean, caption: string): void {
        return modify(() => Figures.insertFigure(filename,width,numbered,caption));
    }

    export function getSelectedFigureId(): string {
        return execute(() => Figures.getSelectedFigureId());
    }

    export function getProperties(itemId: string): FigureProperties {
        return execute(() => Figures.getProperties(itemId));
    }

    export function setProperties(itemId: string, width: string, src: string): void {
        return modify(() => Figures.setProperties(itemId,width,src));
    }

    export function getGeometry(itemId: string): FigureGeometry {
        return execute(() => Figures.getGeometry(itemId));
    }

}

export module formatting {

    export function getFormatting(): { [key: string]: string } {
        return execute(() => Formatting.getFormatting());
    }

    export function applyFormattingChanges(style: string, properties: { [key: string]: string }): void {
        return modify(() => Formatting.applyFormattingChanges(style,properties));
    }

}

export module input {

    export function documentStartAnchor(): PositionRef {
        return execute(() => InputRef.documentStartAnchor());
    }

    export function documentEndAnchor(): PositionRef {
        return execute(() => InputRef.documentEndAnchor());
    }

    export function selectionStartAnchor(): PositionRef {
        return execute(() => InputRef.selectionStartAnchor());
    }

    export function selectionEndAnchor(): PositionRef {
        return execute(() => InputRef.selectionEndAnchor());
    }

    export function textInRange(start: PositionRef, end: PositionRef): string {
        return execute(() => InputRef.textInRange(start,end));
    }

    export function replaceRange(start: PositionRef, end: PositionRef, text: string): void {
        return execute(() => InputRef.replaceRange(start,end,text));
    }

    export function selectedTextRange(): RangeRef {
        return execute(() => InputRef.selectedTextRange());
    }

    export function setSelectedTextRange(start: PositionRef, end: PositionRef): void {
        return execute(() => InputRef.setSelectedTextRange(start,end));
    }

    export function markedTextRange(): RangeRef {
        return execute(() => InputRef.markedTextRange());
    }

    export function setMarkedText(text: string, startOffset: number, endOffset: number): void {
        return execute(() => InputRef.setMarkedText(text,startOffset,endOffset));
    }

    export function unmarkText(): void {
        return execute(() => InputRef.unmarkText());
    }

    export function forwardSelectionAffinity(): boolean {
        return execute(() => InputRef.forwardSelectionAffinity());
    }

    export function setForwardSelectionAffinity(value: boolean): void {
        return execute(() => InputRef.setForwardSelectionAffinity(value));
    }

    export function positionRelativeTo(pos: PositionRef, direction: Direction, offset: number): PositionRef {
        return execute(() => InputRef.positionRelativeTo(pos,direction,offset));
    }

    export function comparePositions(pos1: PositionRef, pos2: PositionRef): number {
        return execute(() => InputRef.comparePositions(pos1,pos2));
    }

    export function firstRectForRange(start: PositionRef, end: PositionRef): ClientRect {
        return execute(() => InputRef.firstRectForRange(start,end));
    }

    export function caretRectForPosition(pos: PositionRef): ClientRect {
        return execute(() => InputRef.caretRectForPosition(pos));
    }

    export function closestPositionToPoint(x: number, y: number): PositionRef {
        return execute(() => InputRef.closestPositionToPoint(x,y));
    }

    export function isPositionAtBoundary(pos: PositionRef, granularity: Granularity, direction: Direction): boolean {
        return execute(() => InputRef.isPositionAtBoundary(pos,granularity,direction));
    }

    export function isPositionWithinTextUnit(pos: PositionRef, granularity: Granularity, direction: Direction): boolean {
        return execute(() => InputRef.isPositionWithinTextUnit(pos,granularity,direction));
    }

    export function positionToBoundary(pos: PositionRef, granularity: Granularity, direction: Direction): PositionRef {
        return execute(() => InputRef.positionToBoundary(pos,granularity,direction));
    }

    export function rangeEnclosingPosition(pos: PositionRef, granularity: Granularity, direction: Direction): RangeRef {
        return execute(() => InputRef.rangeEnclosingPosition(pos,granularity,direction));
    }

}

export module lists {

    export function increaseIndent(): void {
        return modify(() => Lists.increaseIndent());
    }

    export function decreaseIndent(): void {
        return modify(() => Lists.decreaseIndent());
    }

    export function clearList(): void {
        return modify(() => Lists.clearList());
    }

    export function setUnorderedList(): void {
        return modify(() => Lists.setUnorderedList());
    }

    export function setOrderedList(): void {
        return modify(() => Lists.setOrderedList());
    }

}

export module main {

    export function getLanguage(): string {
        return execute(() => Main.getLanguage());
    }

    export function setLanguage(lang: string): void {
        return modify(() => Main.setLanguage(lang));
    }

    export function setGenerator(generator: string): string {
        return execute(() => Main.setGenerator(generator));
    }

    export function prepareForSave(): boolean {
        return modify(() => Main.prepareForSave());
    }

    export function getHTML(): string {
        return execute(() => Main.getHTML());
    }

    export function isEmptyDocument(): boolean {
        return execute(() => Main.isEmptyDocument());
    }

    export function execute<T>(fun: () => T): T {
        // Note: We do not wrap this in the execute() function defined above, since Main.execute()
        // serves a similar purpose. The difference between the two is that Main.execute() does not
        // propagate exceptions, but instead invokes the error() callback, and returns null.
        return Main.execute(fun);
    }

    export function init(width: number, textScale: number, cssURL: string): any {
        return execute(() => Main.init(width,textScale,cssURL));
    }

}

export module metadata {

    export function getMetadata(): { [key: string]: string } {
        return execute(() => Metadata.getMetadata());
    }

    export function setMetadata(metadata: { [key: string]: string }) {
        return modify(() => Metadata.setMetadata(metadata));
    }

}

export module outline {

    export function getOutline(): EncodedOutline {
        return execute(() => Outline.getOutline());
    }

    export function moveSection(sectionId: string, parentId: string, nextId: string): void {
        return modify(() => Outline.moveSection(sectionId,parentId,nextId));
    }

    export function deleteItem(itemId: string): void {
        return modify(() => Outline.deleteItem(itemId));
    }

    export function goToItem(itemId: string): void {
        return execute(() => Outline.goToItem(itemId));
    }

    export function scheduleUpdateStructure(): void {
        return modify(() => Outline.scheduleUpdateStructure());
    }

    export function setNumbered(itemId: string, numbered: boolean): void {
        return modify(() => Outline.setNumbered(itemId,numbered));
    }

    export function setTitle(itemId: string, title: string): void {
        return modify(() => Outline.setTitle(itemId,title));
    }

    export function insertTableOfContents(): void {
        return modify(() => Outline.insertTableOfContents());
    }

    export function insertListOfFigures(): void {
        return modify(() => Outline.insertListOfFigures());
    }

    export function insertListOfTables(): void {
        return modify(() => Outline.insertListOfTables());
    }

    export function setPrintMode(newPrintMode: boolean): void {
        return modify(() => Outline.setPrintMode(newPrintMode));
    }

    export function examinePrintLayout(pageHeight: number): PrintLayoutInfo {
        return modify(() => Outline.examinePrintLayout(pageHeight));
    }

    export function detectSectionNumbering(): boolean {
        return execute(() => Outline.detectSectionNumbering());
    }

    export function findUsedStyles(): { [key: string]: boolean } {
        return execute(() => Outline.findUsedStyles());
    }

}

export module preview {

    export function showForStyle(styleId: string, uiName: string, titleText: string): void {
        return execute(() => Preview.showForStyle(styleId,uiName,titleText));
    }

}

export module scan {

    export function reset(): void {
        return execute(() => Scan.reset());
    }

    export function next(): ScanParagraph {
        return execute(() => Scan.next());
    }

    export function addMatch(start: number, end: number): number {
        return execute(() => Scan.addMatch(start,end));
    }

    export function showMatch(matchId: number): void {
        return execute(() => Scan.showMatch(matchId));
    }

    export function replaceMatch(matchId: number, replacement: string): void {
        return modify(() => Scan.replaceMatch(matchId,replacement));
    }

    export function removeMatch(matchId: number): void {
        return execute(() => Scan.removeMatch(matchId));
    }

    export function goToMatch(matchId: number): void {
        return execute(() => Scan.goToMatch(matchId));
    }

}

export module selection {

    export function update(): void {
        return execute(() => Selection.update());
    }

    export function selectAll(): void {
        return execute(() => Selection.selectAll());
    }

    export function selectParagraph(): void {
        return execute(() => Selection.selectParagraph());
    }

    export function selectWordAtCursor(): void {
        return execute(() => Selection.selectWordAtCursor());
    }

    export function dragSelectionBegin(x: number, y: number, selectWord: boolean): string {
        return execute(() => Selection.dragSelectionBegin(x,y,selectWord));
    }

    export function dragSelectionUpdate(x: number, y: number, selectWord: boolean): string {
        return execute(() => Selection.dragSelectionUpdate(x,y,selectWord));
    }

    export function moveStartLeft(): string {
        return execute(() => Selection.moveStartLeft());
    }

    export function moveStartRight(): string {
        return execute(() => Selection.moveStartRight());
    }

    export function moveEndLeft(): string {
        return execute(() => Selection.moveEndLeft());
    }

    export function moveEndRight(): string {
        return execute(() => Selection.moveEndRight());
    }

    export function setSelectionStartAtCoords(x: number, y: number): void {
        return execute(() => Selection.setSelectionStartAtCoords(x,y));
    }

    export function setSelectionEndAtCoords(x: number, y: number): void {
        return execute(() => Selection.setSelectionEndAtCoords(x,y));
    }

    export function setTableSelectionEdgeAtCoords(edge: string, x: number, y: number): void {
        return execute(() => Selection.setTableSelectionEdgeAtCoords(edge,x,y));
    }

    export function print(): void {
        return execute(() => Selection.print());
    }

}

export module styles {

    export function getCSSText(): string {
        return execute(() => Styles.getCSSText());
    }

    // FIXME: This should return void (need to update Objective C interface)
    export function setCSSText(cssText: string, cssRules: RuleSet): {} {
        return modify(() => Styles.setCSSText(cssText,cssRules));
    }

    export function getParagraphClass(): string {
        return execute(() => Styles.getParagraphClass());
    }

    export function setParagraphClass(cls: string): void {
        return execute(() => Styles.setParagraphClass(cls));
    }

}

export module tables {

    export function insertTable(rows: number, cols: number, width: string, numbered: boolean,
                                caption: string, className?: string): void {
        return modify(() => Tables.insertTable(rows,cols,width,numbered,caption,className));
    }

    export function addAdjacentRow(): void {
        return modify(() => Tables.addAdjacentRow());
    }

    export function addAdjacentColumn(): void {
        return modify(() => Tables.addAdjacentColumn());
    }

    export function removeAdjacentRow(): void {
        return modify(() => Tables.removeAdjacentRow());
    }

    export function removeAdjacentColumn(): void {
        return modify(() => Tables.removeAdjacentColumn());
    }

    export function clearCells(): void {
        return modify(() => Tables.clearCells());
    }

    export function mergeCells(): void {
        return modify(() => Tables.mergeCells());
    }

    export function splitSelection(): void {
        return modify(() => Tables.splitSelection());
    }

    export function getSelectedTableId(): string {
        return execute(() => Tables.getSelectedTableId());
    }

    export function getProperties(itemId: string): TableProperties {
        return execute(() => Tables.getProperties(itemId));
    }

    export function setProperties(itemId: string, width: string): void {
        return modify(() => Tables.setProperties(itemId,width));
    }

    export function setColWidths(itemId: string, widths: number[]): void {
        return modify(() => Tables.setColWidths(itemId,widths));
    }

    export function getGeometry(itemId: string): TableGeometry {
        return execute(() => Tables.getGeometry(itemId));
    }

}

export module undoManager {

    export function getLength(): number {
        return execute(() => UndoManager.getLength());
    }

    export function getIndex(): number {
        return execute(() => UndoManager.getIndex());
    }

    export function setIndex(index: number): void {
        return execute(() => UndoManager.setIndex(index));
    }

    export function undo(): void {
        return modify(() => UndoManager.undo());
    }

    export function redo(): void {
        return modify(() => UndoManager.redo());
    }

    export function newGroup(type?: string): void {
        return execute(() => UndoManager.newGroup(type,null));
    }

    export function groupType(): string {
        return execute(() => UndoManager.groupType());
    }

}

export module viewport {

    export function setViewportWidth(width: number): void {
        return execute(() => Viewport.setViewportWidth(width));
    }

    export function setTextScale(textScale: number): void {
        return execute(() => Viewport.setTextScale(textScale));
    }

}
