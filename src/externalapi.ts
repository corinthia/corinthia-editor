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
import Callbacks = require("./callbacks");
import Clipboard = require("./clipboard");
import Cursor = require("./cursor");
import Equations = require("./equations");
import Figures = require("./figures");
import Formatting = require("./formatting");
import Input = require("./input");
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

function execute<T>(fun: () => T): T {
    let result = fun();
    PostponedActions.perform();
    return result;
}

// FIXME: Find a way to make the following types (currently defined in internal modules) public:
//
// Cursor.LinkProperties
// Figures.FigureProperties
// Figures.FigureGeometry
// Input.Direction
// Input.Granularity
// Input.RangeIds
// Outline.EncodedOutline
// Outline.PrintLayoutInfo
// Scan.ScanParagraph
// Styles.RuleSet
// Tables.TableProperties
// Tables.TableGeometry

export module autoCorrect {

    export function correctPrecedingWord(numChars: number, replacement: string, confirmed: boolean): void {
        return execute(() => AutoCorrect.correctPrecedingWord(numChars,replacement,confirmed));
    }

    export function getCorrection(): { original: string; replacement: string } {
        return execute(() => AutoCorrect.getCorrection());
    }

    export function getCorrectionCoords(): { x: number, y: number } {
        return execute(() => AutoCorrect.getCorrectionCoords());
    }

    export function acceptCorrection(): void {
        return execute(() => AutoCorrect.acceptCorrection());
    }

    export function replaceCorrection(replacement: string): void {
        return execute(() => AutoCorrect.replaceCorrection(replacement));
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
        return execute(() => ChangeTracking.setShowChanges(enabled));
    }

    export function setTrackChanges(enabled: boolean): void {
        return execute(() => ChangeTracking.setTrackChanges(enabled));
    }

}

export module callbacks {

    export function getBackMessages(): string {
        return execute(() => Callbacks.getBackMessages());
    }

}

export module clipboard {

    export function cut(): { [key: string]: string } {
        return execute(() => Clipboard.cut());
    }

    export function copy(): { [key: string]: string } {
        return execute(() => Clipboard.copy());
    }

    export function pasteText(text: string): void {
        return execute(() => Clipboard.pasteText(text));
    }

    export function pasteHTML(html: string): void {
        return execute(() => Clipboard.pasteHTML(html));
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
        return execute(() => Cursor.insertReference(itemId));
    }

    export function insertLink(text: string, url: string): void {
        return execute(() => Cursor.insertLink(text,url));
    }

    export function insertCharacter(str: string, allowInvalidPos: boolean): void {
        // FIXME: do we need to have the allowInvalidPos parameter? Should it be false by default
        // (to match the behaviour of the Objective C API)?
        return execute(() => Cursor.insertCharacter(str,allowInvalidPos,true));
    }

    export function deleteCharacter(): void {
        return execute(() => Cursor.deleteCharacter());
    }

    export function enterPressed(): void {
        return execute(() => Cursor.enterPressed());
    }

    export function getPrecedingWord(): string {
        return execute(() => Cursor.getPrecedingWord());
    }

    export function getLinkProperties(): Cursor.LinkProperties {
        return execute(() => Cursor.getLinkProperties());
    }

    export function setLinkProperties(properties: Cursor.LinkProperties): void {
        return execute(() => Cursor.setLinkProperties(properties));
    }

    export function setReferenceTarget(itemId: string): void {
        return execute(() => Cursor.setReferenceTarget(itemId));
    }

    export function insertFootnote(content: string): void {
        return execute(() => Cursor.insertFootnote(content));
    }

    export function insertEndnote(content: string): void {
        return execute(() => Cursor.insertEndnote(content));
    }

}

export module equations {

    export function insertEquation(): void {
        return execute(() => Equations.insertEquation());
    }

}

export module figures {

    export function insertFigure(filename: string, width: string, numbered: boolean, caption: string): void {
        return execute(() => Figures.insertFigure(filename,width,numbered,caption));
    }

    export function getSelectedFigureId(): string {
        return execute(() => Figures.getSelectedFigureId());
    }

    export function getProperties(itemId: string): Figures.FigureProperties {
        return execute(() => Figures.getProperties(itemId));
    }

    export function setProperties(itemId: string, width: string, src: string): void {
        return execute(() => Figures.setProperties(itemId,width,src));
    }

    export function getGeometry(itemId: string): Figures.FigureGeometry {
        return execute(() => Figures.getGeometry(itemId));
    }

}

export module formatting {

    export function getFormatting(): { [key: string]: string } {
        return execute(() => Formatting.getFormatting());
    }

    export function applyFormattingChanges(style: string, properties: { [key: string]: string }): void {
        return execute(() => Formatting.applyFormattingChanges(style,properties));
    }

}

export module input {

    export function removePosition(posId: number): void {
        return execute(() => Input.removePosition(posId));
    }

    export function textInRange(startId: number, startAdjust: number, endId: number, endAdjust: number): string {
        return execute(() => Input.textInRange(startId,startAdjust,endId,endAdjust));
    }

    export function replaceRange(startId: number, endId: number, text: string): void {
        return execute(() => Input.replaceRange(startId,endId,text));
    }

    export function selectedTextRange(): Input.RangeIds {
        return execute(() => Input.selectedTextRange());
    }

    export function setSelectedTextRange(startId: number, endId: number): void {
        return execute(() => Input.setSelectedTextRange(startId,endId));
    }

    export function markedTextRange(): Input.RangeIds {
        return execute(() => Input.markedTextRange());
    }

    export function setMarkedText(text: string, startOffset: number, endOffset: number): void {
        return execute(() => Input.setMarkedText(text,startOffset,endOffset));
    }

    export function unmarkText(): void {
        return execute(() => Input.unmarkText());
    }

    export function forwardSelectionAffinity(): boolean {
        return execute(() => Input.forwardSelectionAffinity());
    }

    export function setForwardSelectionAffinity(value: boolean): void {
        return execute(() => Input.setForwardSelectionAffinity(value));
    }

    export function positionRelativeTo(posId: number, direction: Input.Direction, offset: number): number {
        return execute(() => Input.positionRelativeTo(posId,direction,offset));
    }

    export function comparePositions(posId1: number, posId2: number): number {
        return execute(() => Input.comparePositions(posId1,posId2));
    }

    export function firstRectForRange(startId: number, endId: number): ClientRect {
        return execute(() => Input.firstRectForRange(startId,endId));
    }

    export function caretRectForPosition(posId: number): ClientRect {
        return execute(() => Input.caretRectForPosition(posId));
    }

    export function closestPositionToPoint(x: number, y: number): number {
        return execute(() => Input.closestPositionToPoint(x,y));
    }

    export function isPositionAtBoundary(posId: number, granularity: Input.Granularity, direction: Input.Direction): boolean {
        return execute(() => Input.isPositionAtBoundary(posId,granularity,direction));
    }

    export function isPositionWithinTextUnit(posId: number, granularity: Input.Granularity, direction: Input.Direction): boolean {
        return execute(() => Input.isPositionWithinTextUnit(posId,granularity,direction));
    }

    export function positionToBoundary(posId: number, granularity: Input.Granularity, direction: Input.Direction): number {
        return execute(() => Input.positionToBoundary(posId,granularity,direction));
    }

    export function rangeEnclosingPosition(posId: number, granularity: Input.Granularity, direction: Input.Direction): Input.RangeIds {
        return execute(() => Input.rangeEnclosingPosition(posId,granularity,direction));
    }

}

export module lists {

    export function increaseIndent(): void {
        return execute(() => Lists.increaseIndent());
    }

    export function decreaseIndent(): void {
        return execute(() => Lists.decreaseIndent());
    }

    export function clearList(): void {
        return execute(() => Lists.clearList());
    }

    export function setUnorderedList(): void {
        return execute(() => Lists.setUnorderedList());
    }

    export function setOrderedList(): void {
        return execute(() => Lists.setOrderedList());
    }

}

export module main {

    export function getLanguage(): string {
        return execute(() => Main.getLanguage());
    }

    export function setLanguage(lang: string): void {
        return execute(() => Main.setLanguage(lang));
    }

    export function setGenerator(generator: string): string {
        return execute(() => Main.setGenerator(generator));
    }

    export function prepareForSave(): boolean {
        return execute(() => Main.prepareForSave());
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
        return execute(() => Metadata.setMetadata(metadata));
    }

}

export module outline {

    export function getOutline(): Outline.EncodedOutline {
        return execute(() => Outline.getOutline());
    }

    export function moveSection(sectionId: string, parentId: string, nextId: string): void {
        return execute(() => Outline.moveSection(sectionId,parentId,nextId));
    }

    export function deleteItem(itemId: string): void {
        return execute(() => Outline.deleteItem(itemId));
    }

    export function goToItem(itemId: string): void {
        return execute(() => Outline.goToItem(itemId));
    }

    export function scheduleUpdateStructure(): void {
        return execute(() => Outline.scheduleUpdateStructure());
    }

    export function setNumbered(itemId: string, numbered: boolean): void {
        return execute(() => Outline.setNumbered(itemId,numbered));
    }

    export function setTitle(itemId: string, title: string): void {
        return execute(() => Outline.setTitle(itemId,title));
    }

    export function insertTableOfContents(): void {
        return execute(() => Outline.insertTableOfContents());
    }

    export function insertListOfFigures(): void {
        return execute(() => Outline.insertListOfFigures());
    }

    export function insertListOfTables(): void {
        return execute(() => Outline.insertListOfTables());
    }

    export function setPrintMode(newPrintMode: boolean): void {
        return execute(() => Outline.setPrintMode(newPrintMode));
    }

    export function examinePrintLayout(pageHeight: number): Outline.PrintLayoutInfo {
        return execute(() => Outline.examinePrintLayout(pageHeight));
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

    export function next(): Scan.ScanParagraph {
        return execute(() => Scan.next());
    }

    export function addMatch(start: number, end: number): number {
        return execute(() => Scan.addMatch(start,end));
    }

    export function showMatch(matchId: number): void {
        return execute(() => Scan.showMatch(matchId));
    }

    export function replaceMatch(matchId: number, replacement: string): void {
        return execute(() => Scan.replaceMatch(matchId,replacement));
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
    export function setCSSText(cssText: string, cssRules: Styles.RuleSet): {} {
        return execute(() => Styles.setCSSText(cssText,cssRules));
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
        return execute(() => Tables.insertTable(rows,cols,width,numbered,caption,className));
    }

    export function addAdjacentRow(): void {
        return execute(() => Tables.addAdjacentRow());
    }

    export function addAdjacentColumn(): void {
        return execute(() => Tables.addAdjacentColumn());
    }

    export function removeAdjacentRow(): void {
        return execute(() => Tables.removeAdjacentRow());
    }

    export function removeAdjacentColumn(): void {
        return execute(() => Tables.removeAdjacentColumn());
    }

    export function clearCells(): void {
        return execute(() => Tables.clearCells());
    }

    export function mergeCells(): void {
        return execute(() => Tables.mergeCells());
    }

    export function splitSelection(): void {
        return execute(() => Tables.splitSelection());
    }

    export function getSelectedTableId(): string {
        return execute(() => Tables.getSelectedTableId());
    }

    export function getProperties(itemId: string): Tables.TableProperties {
        return execute(() => Tables.getProperties(itemId));
    }

    export function setProperties(itemId: string, width: string): void {
        return execute(() => Tables.setProperties(itemId,width));
    }

    export function setColWidths(itemId: string, widths: number[]): void {
        return execute(() => Tables.setColWidths(itemId,widths));
    }

    export function getGeometry(itemId: string): Tables.TableGeometry {
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
        return execute(() => UndoManager.undo());
    }

    export function redo(): void {
        return execute(() => UndoManager.redo());
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
