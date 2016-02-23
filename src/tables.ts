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

import Callbacks = require("./callbacks")
import Clipboard = require("./clipboard");
import Collections = require("./collections");
import Cursor = require("./cursor");
import DOM = require("./dom");
import ElementTypes = require("./elementTypes");
import Outline = require("./outline");
import Position = require("./position");
import PostponedActions = require("./postponedActions");
import Range = require("./range");
import Selection = require("./selection");
import Traversal = require("./traversal");
import Types = require("./types");
import UndoManager = require("./undo");
import Util = require("./util");

export class Cell {

    public element: HTMLElement;
    public row: number;
    public col: number;
    public colspan: number;
    public rowspan: number;
    public top: number;
    public bottom: number;
    public left: number;
    public right: number;

    constructor(element: HTMLElement, row: number, col: number) {
        this.element = element;
        this.row = row;
        this.col = col;

        if (element.hasAttribute("colspan"))
            this.colspan = parseInt(element.getAttribute("colspan"));
        else
            this.colspan = 1;
        if (element.hasAttribute("rowspan"))
            this.rowspan = parseInt(element.getAttribute("rowspan"));
        else
            this.rowspan = 1;

        if (this.colspan < 1)
            this.colspan = 1;
        if (this.rowspan < 1)
            this.rowspan = 1;

        this.top = this.row;
        this.bottom = this.top + this.rowspan - 1;
        this.left = this.col;
        this.right = this.left + this.colspan - 1;
    }

    public setRowspan(rowspan: number): void {
        if (rowspan < 1)
            rowspan = 1;
        this.rowspan = rowspan;
        this.bottom = this.top + this.rowspan - 1;
        if (rowspan == 1)
            DOM.removeAttribute(this.element,"rowspan");
        else
            DOM.setAttribute(this.element,"rowspan",""+rowspan);
    }

    public setColspan(colspan: number): void {
        if (colspan < 1)
            colspan = 1;
        this.colspan = colspan;
        this.right = this.left + this.colspan - 1;
        if (colspan == 1)
            DOM.removeAttribute(this.element,"colspan");
        else
            DOM.setAttribute(this.element,"colspan",""+colspan);
    }

}

export class Table {

    public element: HTMLElement;
    public row: number;
    public col: number;
    public cells: Cell[][];
    public numRows: number;
    public numCols: number;
    public translated: boolean;
    public cellsByElement: Collections.NodeMap<Cell>;

    constructor(element: HTMLElement) {
        this.element = element;
        this.row = 0;
        this.col = 0;
        this.cells = new Array();
        this.numRows = 0;
        this.numCols = 0;
        this.translated = false;
        this.cellsByElement = new Collections.NodeMap<Cell>();
        Table_processTable(this,element);
    }

}

// public
export function Table_get(table: Table, row: number, col: number): Cell {
    if (table.cells[row] == null)
        return null;
    return table.cells[row][col];
}

// public
export function Table_set(table: Table, row: number, col: number, cell: Cell) {
    if (table.numRows < row+1)
        table.numRows = row+1;
    if (table.numCols < col+1)
        table.numCols = col+1;
    if (table.cells[row] == null)
        table.cells[row] = new Array();
    table.cells[row][col] = cell;
}

// public
export function Table_setRegion(table: Table, top: number, left: number, bottom: number, right: number, cell: Cell) {
    for (let row = top; row <= bottom; row++) {
        for (let col = left; col <= right; col++) {
            let destCell = Table_get(table,row,col);
            DOM.deleteNode(destCell.element);
            Table_set(table,row,col,cell);
        }
    }
}

function Table_processTable(table: Table, node: HTMLElement): void {
    let type = node._type;
    switch (node._type) {
    case ElementTypes.HTML_TD:
    case ElementTypes.HTML_TH: {
        while (Table_get(table,table.row,table.col) != null)
            table.col++;

        let cell = new Cell(node,table.row,table.col);
        table.cellsByElement.put(node,cell);

        for (let r = 0; r < cell.rowspan; r++) {
            for (let c = 0; c < cell.colspan; c++) {
                Table_set(table,table.row+r,table.col+c,cell);
            }
        }
        table.col += cell.colspan;
        break;
    }
    case ElementTypes.HTML_TR:
        for (let child = node.firstChild; child != null; child = child.nextSibling) {
            if (child instanceof HTMLElement)
                Table_processTable(table,child);
        }
        table.row++;
        table.col = 0;
        break;
    default:
        for (let child = node.firstChild; child != null; child = child.nextSibling) {
            if (child instanceof HTMLElement)
                Table_processTable(table,child);
        }
        break;
    }
}

// public
export function insertTable(rows: number, cols: number, width: string, numbered: boolean,
                            caption: string, className?: string): void {
    UndoManager.newGroup("Insert table");

    if (rows < 1)
        rows = 1;
    if (cols < 1)
        cols = 1;

    let haveCaption = (caption != null) && (caption != "");
    let table = DOM.createElement(document,"TABLE");

    if (width != null)
        DOM.setStyleProperties(table,{"width": width});

    if (className != null)
        DOM.setAttribute(table,"class",className);

    // Caption comes first
    if (haveCaption) {
        let tableCaption = DOM.createElement(document,"CAPTION");
        DOM.appendChild(tableCaption,DOM.createTextNode(document,caption));
        DOM.appendChild(table,tableCaption);
    }

    // Set equal column widths
    let colWidth = Math.round(100/cols)+"%";
    for (let c = 0; c < cols; c++) {
        let col = DOM.createElement(document,"COL");
        DOM.setAttribute(col,"width",colWidth);
        DOM.appendChild(table,col);
    }

    let firstTD: HTMLElement = null;

    // Then the rows and columns
    let tbody = DOM.createElement(document,"TBODY");
    DOM.appendChild(table,tbody);
    for (let r = 0; r < rows; r++) {
        let tr = DOM.createElement(document,"TR");
        DOM.appendChild(tbody,tr);
        for (let c = 0; c < cols; c++) {
            let td = DOM.createElement(document,"TD");
            let p = DOM.createElement(document,"P");
            let br = DOM.createElement(document,"BR");
            DOM.appendChild(tr,td);
            DOM.appendChild(td,p);
            DOM.appendChild(p,br);

            if (firstTD == null)
                firstTD = td;
        }
    }

    Clipboard.pasteNodes([table]);

    // Now that the table has been inserted into the DOM tree, the outline code will
    // have noticed it and added an id attribute, as well as a caption giving the
    // table number.
    Outline.setNumbered(table.getAttribute("id"),numbered);

    // Place the cursor at the start of the first cell on the first row
    let pos = new Position(firstTD,0);
    pos = Position.closestMatchForwards(pos,Position.okForMovement);
    Selection.set(pos.node,pos.offset,pos.node,pos.offset);

    PostponedActions.add(UndoManager.newGroup);
}

// private
function createEmptyTableCell(elementName: string): HTMLElement {
    let br = DOM.createElement(document,"BR");
    let p = DOM.createElement(document,"P");
    let td = DOM.createElement(document,elementName);
    DOM.appendChild(p,br);
    DOM.appendChild(td,p);
    return td;
}

// private
function addEmptyTableCell(newTR: HTMLElement, elementName: string): HTMLElement {
    let td = createEmptyTableCell(elementName);
    DOM.appendChild(newTR,td);
    return td;
}

// private
function populateNewRow(structure: Table, newTR: HTMLElement, newRow: number, oldRow: number): void {
    let col = 0;
    while (col < structure.numCols) {
        let existingCell = Table_get(structure,oldRow,col);
        if (((newRow > oldRow) && (newRow < existingCell.row + existingCell.rowspan)) ||
            ((newRow < oldRow) && (newRow >= existingCell.row))) {
            existingCell.setRowspan(existingCell.rowspan+1);
        }
        else {
            let td = addEmptyTableCell(newTR,existingCell.element.nodeName); // check-ok
            if (existingCell.colspan != 1)
                DOM.setAttribute(td,"colspan",""+existingCell.colspan);
        }
        col += existingCell.colspan;
    }
}

function tableAtRightOfRange(range: Range): Table {
    if (!Range.isEmpty(range))
        return null;

    let pos = Position.preferElementPosition(range.start);
    if ((pos.node instanceof Element) && (pos.offset < pos.node.childNodes.length)) {
        let element = pos.node.childNodes[pos.offset];
        if (element instanceof HTMLTableElement)
            return analyseStructure(element);
    }
    return null;
}

function tableAtLeftOfRange(range: Range): Table {
    if (!Range.isEmpty(range))
        return null;

    let pos = Position.preferElementPosition(range.start);
    if ((pos.node instanceof Element) && (pos.offset > 0)) {
        let element = pos.node.childNodes[pos.offset-1];
        if (element instanceof HTMLTableElement)
            return analyseStructure(element);
    }
    return null;
}

function insertRowAbove(table: Table, row: number): void {
    let cell = Table_get(table,row,0);
    let oldTR = cell.element.parentNode;
    let newTR = DOM.createElement(document,"TR");
    DOM.insertBefore(oldTR.parentNode,newTR,oldTR);
    populateNewRow(table,newTR,row-1,row);
}

function insertRowBelow(table: Table, row: number): void {
    let cell = Table_get(table,row,0);
    let oldTR = cell.element.parentNode;
    let newTR = DOM.createElement(document,"TR");
    DOM.insertBefore(oldTR.parentNode,newTR,oldTR.nextSibling);
    populateNewRow(table,newTR,row+1,row);
}

function insertRowAdjacentToRange(range: Range): void {
    let table: Table;

    table = tableAtLeftOfRange(range);
    if (table != null) {
        insertRowBelow(table,table.numRows-1);
        return;
    }

    table = tableAtRightOfRange(range);
    if (table != null) {
        insertRowAbove(table,0);
        return;
    }
}

// public
export function addAdjacentRow(): void {
    UndoManager.newGroup("Insert row below");
    Selection.preserveWhileExecuting(function() {
        let range = Selection.get();
        let region = regionFromRange(range,true);
        if (region != null)
            insertRowBelow(region.structure,region.bottom);
        else
            insertRowAdjacentToRange(range);
    });
    UndoManager.newGroup();
}

// private
function getColElements(table: HTMLElement): HTMLElement[] {
    let cols = new Array<HTMLElement>();
    for (let child = table.firstChild; child != null; child = child.nextSibling) {
        switch (child._type) {
        case ElementTypes.HTML_COLGROUP:
            for (let gc = child.firstChild; gc != null; gc = gc.nextSibling) {
                if (gc instanceof HTMLTableColElement)
                    cols.push(gc);
            }
            break;
        case ElementTypes.HTML_COL:
            if (child instanceof HTMLTableColElement) // Only needed for type guard
                cols.push(child);
            break;
        }
    }
    return cols;
}

// private
function getColWidthsFromElements(colElements: HTMLElement[], expectedCount: number): string[] {
    // FIXME: also handle the case where the width has been set as a CSS property in the
    // style attribute. There's probably not much we can do if the width comes from a style
    // rule elsewhere in the document though.
    let colWidths = new Array<string>();
    for (let i = 0; i < colElements.length; i++) {
        if (colElements[i].hasAttribute("width"))
            colWidths.push(colElements[i].getAttribute("width"));
        else
            colWidths.push("");
    }
    return colWidths;
}

// private
function addMissingColElements(structure: Table, colElements: HTMLElement[]): void {
    // If there are fewer COL elements than there are colums, add extra ones, copying the
    // width value from the last one
    // FIXME: handle col elements with colspan > 1, as well as colgroups with width set
    // FIXME: What if there are 0 col elements?
    while (colElements.length < structure.numCols) {
        let newColElement = DOM.createElement(document,"COL");
        let lastColElement = colElements[colElements.length-1];
        DOM.insertBefore(lastColElement.parentNode,newColElement,lastColElement.nextSibling);
        colElements.push(newColElement);
        DOM.setAttribute(newColElement,"width",lastColElement.getAttribute("width"));
    }
}

// private
function fixColPercentages(structure: Table, colElements: HTMLElement[]): void {
    let colWidths = getColWidthsFromElements(colElements,structure.numCols);

    let percentages = colWidths.map(getPercentage);
    if (percentages.every(notNull)) {
        let colWidthTotal = 0;
        for (let i = 0; i < percentages.length; i++)
            colWidthTotal += percentages[i];

        for (let i = 0; i < colElements.length; i++) {
            let pct = 100*percentages[i]/colWidthTotal;
            // Store value using at most two decimal places
            pct = Math.round(100*pct)/100;
            DOM.setAttribute(colElements[i],"width",pct+"%");
        }
    }

    function notNull(arg: any): boolean {
        return (arg != null);
    }

    function getPercentage(str: string): number {
        if (str.match(/^\s*\d+(\.\d+)?\s*%\s*$/))
            return parseInt(str.replace(/\s*%\s*$/,""));
        else
            return null;
    }
}

// private
// FIXME: TS: calls to this function pass in right as a number, but it is treated as a boolean here
// It may be that the if (right) statements are actually supposed to be if (right != 0), since
// javascript treats 0 as false for the purpose of if statements.
function addColElement(structure: Table, oldIndex: number, right: any): void {
    let table = structure.element;

    let colElements = getColElements(table);
    if (colElements.length == 0) {
        // The table doesn't have any COL elements; don't add any
        return;
    }

    addMissingColElements(structure,colElements);

    let prevColElement = colElements[oldIndex];
    let newColElement = DOM.createElement(document,"COL");
    DOM.setAttribute(newColElement,"width",prevColElement.getAttribute("width"));
    if (right)
        DOM.insertBefore(prevColElement.parentNode,newColElement,prevColElement.nextSibling);
    else
        DOM.insertBefore(prevColElement.parentNode,newColElement,prevColElement);

    if (right) {
        colElements.splice(oldIndex+1,0,newColElement);
    }
    else {
        colElements.splice(oldIndex+1,0,newColElement);
    }

    fixColPercentages(structure,colElements);
}

// private
function deleteColElements(structure: Table, left: number, right: number): void {
    let table = structure.element;

    let colElements = getColElements(table);
    if (colElements.length == 0) {
        // The table doesn't have any COL elements
        return;
    }

    addMissingColElements(structure,colElements);

    for (let col = left; col <= right; col++)
        DOM.deleteNode(colElements[col]);
    colElements.splice(left,right-left+1);

    fixColPercentages(structure,colElements);
}

// private
function addColumnCells(structure: Table, oldIndex: number, right: boolean): void {
    for (let row = 0; row < structure.numRows; row++) {
        let cell = Table_get(structure,row,oldIndex);
        let oldTD = cell.element;
        if (cell.row == row) {

            if (((right && (oldIndex+1 < cell.col + cell.colspan)) ||
                (!right && (oldIndex-1 >= cell.col))) &&
                (cell.colspan > 1)) {
                cell.setColspan(cell.colspan+1);
            }
            else {
                let newTD = createEmptyTableCell(oldTD.nodeName); // check-ok
                if (right)
                    DOM.insertBefore(cell.element.parentNode,newTD,oldTD.nextSibling);
                else
                    DOM.insertBefore(cell.element.parentNode,newTD,oldTD);
                if (cell.rowspan != 1)
                    DOM.setAttribute(newTD,"rowspan",""+cell.rowspan);
            }
        }
    }
}

function insertColumnAdjacentToRange(range: Range): void {
    let table: Table;

    table = tableAtLeftOfRange(range);
    if (table != null) {
        let right = table.numCols-1;
        addColElement(table,right,right+1);
        addColumnCells(table,right,true);
        return;
    }

    table = tableAtRightOfRange(range);
    if (table != null) {
        let left = 0;
        addColElement(table,left,left-1);
        addColumnCells(table,left,false);
        return;
    }
}

// public
export function addAdjacentColumn(): void {
    UndoManager.newGroup("Insert column at right");
    Selection.preserveWhileExecuting(function() {
        let range = Selection.get();
        let region = regionFromRange(range,true);
        if (region != null) {
            addColElement(region.structure,region.right,region.right+1);
            addColumnCells(region.structure,region.right,true);
        }
        else {
            insertColumnAdjacentToRange(range);
        }
    });
    UndoManager.newGroup();
}

function columnHasContent(table: Table, col: number): boolean {
    for (let row = 0; row < table.numRows; row++) {
        let cell = Table_get(table,row,col);
        if ((cell != null) && (cell.col == col) && Types.nodeHasContent(cell.element))
            return true;
    }
    return false;
}

function rowHasContent(table: Table, row: number): boolean {
    for (let col = 0; col < table.numCols; col++) {
        let cell = Table_get(table,row,col);
        if ((cell != null) && (cell.row == row) && Types.nodeHasContent(cell.element))
            return true;
    }
    return false;
}

function selectRegion(table: Table, top: number, bottom: number, left: number, right: number): void {
    left = clampCol(table,left);
    right = clampCol(table,right);
    top = clampRow(table,top);
    bottom = clampRow(table,bottom);

    let tlCell = Table_get(table,top,left);
    let brCell = Table_get(table,bottom,right);
    if ((tlCell != null) && (brCell != null)) {
        let tlPos = new Position(tlCell.element,0);
        tlPos = Position.closestMatchForwards(tlPos,Position.okForMovement);

        let brPos = new Position(brCell.element,brCell.element.childNodes.length);
        brPos = Position.closestMatchBackwards(brPos,Position.okForMovement);

        Selection.set(tlPos.node,tlPos.offset,brPos.node,brPos.offset);
    }
}

function clampCol(table: Table, col: number): number {
    if (col > table.numCols-1)
        col = table.numCols-1;
    if (col < 0)
        col = 0;
    return col;
}

function clampRow(table: Table, row: number): number {
    if (row > table.numRows-1)
        row = table.numRows-1;
    if (row < 0)
        row = 0;
    return row;
}

function removeRowAdjacentToRange(range: Range): void {
    let table: Table;

    table = tableAtLeftOfRange(range);
    if ((table != null) && (table.numRows >= 2)) {
        UndoManager.newGroup("Delete one row");
        let row = table.numRows-1;
        deleteRegion(new TableRegion(table,row,row,0,table.numCols-1));
        UndoManager.newGroup();
        return;
    }

    table = tableAtRightOfRange(range);
    if ((table != null) && (table.numRows >= 2)) {
        UndoManager.newGroup("Delete one row");
        deleteRegion(new TableRegion(table,0,0,0,table.numCols-1));
        UndoManager.newGroup();
        return;
    }
}

export function removeAdjacentRow(): void {
    let range = Selection.get();
    let region = regionFromRange(range,true);

    if (region == null) {
        removeRowAdjacentToRange(range);
        return;
    }

    if (region.structure.numRows <= 1)
        return;

    UndoManager.newGroup("Delete one row");

    let table = region.structure;
    let left = region.left;
    let right = region.right;
    let top = region.top;
    let bottom = region.bottom;

    // Is there an empty row below the selection? If so, delete it
    if ((bottom+1 < table.numRows) && !rowHasContent(table,bottom+1)) {
        Selection.preserveWhileExecuting(function() {
            deleteRegion(new TableRegion(table,bottom+1,bottom+1,0,table.numCols-1));
        });
    }

    // Is there an empty row above the selection? If so, delete it
    else if ((top-1 >= 0) && !rowHasContent(table,top-1)) {
        Selection.preserveWhileExecuting(function() {
            deleteRegion(new TableRegion(table,top-1,top-1,0,table.numCols-1));
        });
    }


    // There are no empty rows adjacent to the selection. Delete the right-most row
    // of the selection (which may be the only one)
    else {
        Selection.preserveWhileExecuting(function() {
            deleteRegion(new TableRegion(table,bottom,bottom,0,table.numCols-1));
        });

        table = analyseStructure(table.element);
        let multiple = (top != bottom);

        if (multiple) {
            selectRegion(table,top,bottom-1,left,right);
        }
        else {
            let newRow = clampRow(table,bottom);
            let newCell = Table_get(table,newRow,left);
            if (newCell != null) {
                let pos = new Position(newCell.element,0);
                pos = Position.closestMatchForwards(pos,Position.okForMovement);
                Selection.set(pos.node,pos.offset,pos.node,pos.offset);
            }
        }
    }

    UndoManager.newGroup();
}

function removeColumnAdjacentToRange(range: Range): void {
    let table: Table;

    table = tableAtLeftOfRange(range);
    if ((table != null) && (table.numCols >= 2)) {
        UndoManager.newGroup("Delete one column");
        let col = table.numCols-1;
        deleteRegion(new TableRegion(table,0,table.numRows-1,col,col));
        UndoManager.newGroup();
        return;
    }

    table = tableAtRightOfRange(range);
    if ((table != null) && (table.numCols >= 2)) {
        UndoManager.newGroup("Delete one column");
        deleteRegion(new TableRegion(table,0,table.numRows-1,0,0));
        UndoManager.newGroup();
        return;
    }
}

export function removeAdjacentColumn(): void {
    let range = Selection.get();
    let region = regionFromRange(range,true);

    if (region == null) {
        removeColumnAdjacentToRange(range);
        return;
    }

    if (region.structure.numCols <= 1)
        return;

    UndoManager.newGroup("Delete one column");

    let table = region.structure;
    let left = region.left;
    let right = region.right;
    let top = region.top;
    let bottom = region.bottom;

    // Is there an empty column to the right of the selection? If so, delete it
    if ((right+1 < table.numCols) && !columnHasContent(table,right+1)) {
        Selection.preserveWhileExecuting(function() {
            deleteRegion(new TableRegion(table,0,table.numRows-1,right+1,right+1));
        });
    }

    // Is there an empty column to the left of the selection? If so, delete it
    else if ((left-1 >= 0) && !columnHasContent(table,left-1)) {
        Selection.preserveWhileExecuting(function() {
            deleteRegion(new TableRegion(table,0,table.numRows-1,left-1,left-1));
        });
    }

    // There are no empty columns adjacent to the selection. Delete the right-most column
    // of the selection (which may be the only one)
    else {
        Selection.preserveWhileExecuting(function() {
            deleteRegion(new TableRegion(table,0,table.numRows-1,right,right));
        });

        table = analyseStructure(table.element);
        let multiple = (left != right);

        if (multiple) {
            selectRegion(table,top,bottom,left,right-1);
        }
        else {
            let newCol = clampCol(table,right);
            let newCell = Table_get(table,top,newCol);
            if (newCell != null) {
                let pos = new Position(newCell.element,0);
                pos = Position.closestMatchForwards(pos,Position.okForMovement);
                Selection.set(pos.node,pos.offset,pos.node,pos.offset);
            }
        }
    }

    UndoManager.newGroup();
}

// private
function deleteTable(structure: Table): void {
    DOM.deleteNode(structure.element);
}

// private
function deleteRows(structure: Table, top: number, bottom: number): void {
    let trElements = new Array<HTMLElement>();
    getTRs(structure.element,trElements);

    for (let row = top; row <= bottom; row++)
        DOM.deleteNode(trElements[row]);
}

// private
function getTRs(node: Node, result: HTMLElement[]): void {
    if ((node instanceof HTMLElement) && (node._type == ElementTypes.HTML_TR)) {
        result.push(node);
    }
    else {
        for (let child = node.firstChild; child != null; child = child.nextSibling)
            getTRs(child,result);
    }
}

// private
function deleteColumns(structure: Table, left: number, right: number): void {
    let nodesToDelete = new Collections.NodeSet();
    for (let row = 0; row < structure.numRows; row++) {
        for (let col = left; col <= right; col++) {
            let cell = Table_get(structure,row,col);
            nodesToDelete.add(cell.element);
        }
    }
    nodesToDelete.forEach(DOM.deleteNode);
    deleteColElements(structure,left,right);
}

// private
function deleteCellContents(region: TableRegion): void {
    let structure = region.structure;
    for (let row = region.top; row <= region.bottom; row++) {
        for (let col = region.left; col <= region.right; col++) {
            let cell = Table_get(structure,row,col);
            DOM.deleteAllChildren(cell.element);
        }
    }
}

// public
export function deleteRegion(region: TableRegion): void {
    let structure = region.structure;

    let coversEntireWidth = (region.left == 0) && (region.right == structure.numCols-1);
    let coversEntireHeight = (region.top == 0) && (region.bottom == structure.numRows-1);

    if (coversEntireWidth && coversEntireHeight)
        deleteTable(region.structure);
    else if (coversEntireWidth)
        deleteRows(structure,region.top,region.bottom);
    else if (coversEntireHeight)
        deleteColumns(structure,region.left,region.right);
    else
        deleteCellContents(region);
}

// public
export function clearCells(): void {
    // TODO
}

// public
export function mergeCells(): void {
    Selection.preserveWhileExecuting(function() {
        let region = regionFromRange(Selection.get());
        if (region == null)
            return;

        let structure = region.structure;

        // FIXME: handle the case of missing cells
        // (or even better, add cells where there are some missing)

        for (let row = region.top; row <= region.bottom; row++) {
            for (let col = region.left; col <= region.right; col++) {
                let cell = Table_get(structure,row,col);
                let cellFirstRow = cell.row;
                let cellLastRow = cell.row + cell.rowspan - 1;
                let cellFirstCol = cell.col;
                let cellLastCol = cell.col + cell.colspan - 1;

                if ((cellFirstRow < region.top) || (cellLastRow > region.bottom) ||
                    (cellFirstCol < region.left) || (cellLastCol > region.right)) {
                    Callbacks.debug("Can't merge this table: cell at "+row+","+col+
                               " goes outside bounds of selection");
                    return;
                }
            }
        }

        let mergedCell = Table_get(structure,region.top,region.left);

        for (let row = region.top; row <= region.bottom; row++) {
            for (let col = region.left; col <= region.right; col++) {
                let cell = Table_get(structure,row,col);
                // parentNode will be null if we've already done this cell
                if ((cell != mergedCell) && (cell.element.parentNode != null)) {
                    while (cell.element.firstChild != null)
                        DOM.appendChild(mergedCell.element,cell.element.firstChild);
                    DOM.deleteNode(cell.element);
                }
            }
        }

        let totalRows = region.bottom - region.top + 1;
        let totalCols = region.right - region.left + 1;
        if (totalRows == 1)
            DOM.removeAttribute(mergedCell.element,"rowspan");
        else
            DOM.setAttribute(mergedCell.element,"rowspan",""+totalRows);
        if (totalCols == 1)
            DOM.removeAttribute(mergedCell.element,"colspan");
        else
            DOM.setAttribute(mergedCell.element,"colspan",""+totalCols);
    });
}

// public
export function splitSelection(): void {
    Selection.preserveWhileExecuting(function() {
        let range = Selection.get();
        Range.trackWhileExecuting(range,function() {
            let region = regionFromRange(range,true);
            if (region != null)
                TableRegion_splitCells(region);
        });
    });
}

// public
export function TableRegion_splitCells(region: TableRegion): void {
    let structure = region.structure;
    let trElements = new Array<HTMLElement>();
    getTRs(structure.element,trElements);

    for (let row = region.top; row <= region.bottom; row++) {
        for (let col = region.left; col <= region.right; col++) {
            let cell = Table_get(structure,row,col);
            if ((cell.rowspan > 1) || (cell.colspan > 1)) {

                let original = cell.element;

                for (let r = cell.top; r <= cell.bottom; r++) {
                    for (let c = cell.left; c <= cell.right; c++) {
                        if ((r == cell.top) && (c == cell.left))
                            continue;
                        let newTD = createEmptyTableCell(original.nodeName); // check-ok
                        let nextElement: HTMLElement = null;

                        let nextCol = cell.right+1;
                        while (nextCol < structure.numCols) {
                            let nextCell = Table_get(structure,r,nextCol);
                            if ((nextCell != null) && (nextCell.row == r)) {
                                nextElement = nextCell.element;
                                break;
                            }
                            nextCol++;
                        }

                        DOM.insertBefore(trElements[r],newTD,nextElement);
                        Table_set(structure,r,c,new Cell(newTD,r,c));
                    }
                }
                DOM.removeAttribute(original,"rowspan");
                DOM.removeAttribute(original,"colspan");
            }
        }
    }
}

// public
export function cloneRegion(region: TableRegion): HTMLElement {
    let cellNodesDone = new Collections.NodeSet();
    let table = DOM.shallowCopyElement(region.structure.element);
    for (let row = region.top; row <= region.bottom; row++) {
        let tr = DOM.createElement(document,"TR");
        DOM.appendChild(table,tr);
        for (let col = region.left; col <= region.right; col++) {
            let cell = Table_get(region.structure,row,col);
            if (!cellNodesDone.contains(cell.element)) {
                DOM.appendChild(tr,DOM.cloneNode(cell.element,true));
                cellNodesDone.add(cell.element);
            }
        }
    }
    return table;
}

// private
function pasteCells(fromTableElement: HTMLElement, toRegion: TableRegion): void {
    // TODO
    let fromStructure = analyseStructure(fromTableElement);
}

// public
export function Table_fix(table: Table): Table {
    let changed = false;

    let tbody: Node = null;
    for (let child = table.element.firstChild; child != null; child = child.nextSibling) {
        if (child._type == ElementTypes.HTML_TBODY)
            tbody = child;
    }

    if (tbody == null)
        return table; // FIXME: handle presence of THEAD and TFOOT, and also a missing TBODY

    let trs = new Array();
    for (let child = tbody.firstChild; child != null; child = child.nextSibling) {
        if (child._type == ElementTypes.HTML_TR)
            trs.push(child);
    }

    while (trs.length < table.numRows) {
        let tr = DOM.createElement(document,"TR");
        DOM.appendChild(tbody,tr);
        trs.push(tr);
    }

    for (let row = 0; row < table.numRows; row++) {
        for (let col = 0; col < table.numCols; col++) {
            let cell = Table_get(table,row,col);
            if (cell == null) {
                let td = createEmptyTableCell("TD");
                DOM.appendChild(trs[row],td);
                changed = true;
            }
        }
    }

    if (changed)
        return new Table(table.element);
    else
        return table;
}

// public
export function Table_fixColumnWidths(structure: Table): void {
    let colElements = getColElements(structure.element);
    if (colElements.length == 0)
        return;
    addMissingColElements(structure,colElements);

    let widths = getColWidths(structure);
    fixWidths(widths,structure.numCols);
    colElements = getColElements(structure.element);
    for (let i = 0; i < widths.length; i++)
        DOM.setAttribute(colElements[i],"width",widths[i]+"%");
}

// public
export function analyseStructure(element: HTMLElement): Table {
    // FIXME: we should probably be preserving the selection here, since we are modifying
    // the DOM (though I think it's unlikely it would cause problems, becausing the fixup
    // logic only adds elements). However this method is called (indirectly) from within
    // Selection.update(), which causes unbounded recursion due to the subsequent Selecton_set()
    // that occurs.
    let initial = new Table(element);
    let fixed = Table_fix(initial);
    return fixed;
}

// public
export function findContainingCell(node: Node): HTMLElement {
    for (let ancestor = node; ancestor != null; ancestor = ancestor.parentNode) {
        if ((ancestor instanceof HTMLElement) && Types.isTableCell(ancestor))
            return ancestor;
    }
    return null;
}

// public
export function findContainingTable(node: Node): HTMLElement {
    for (let ancestor = node; ancestor != null; ancestor = ancestor.parentNode) {
        if (ancestor instanceof HTMLTableElement)
            return ancestor;
    }
    return null;
}

export class TableRegion {

    constructor(
        public structure: Table,
        public top: number,
        public bottom: number,
        public left: number,
        public right: number
    ) { }

    public toString(): string {
        return "("+this.top+","+this.left+") - ("+this.bottom+","+this.right+")";
    }

}

// public
export function regionFromRange(range: Range, allowSameCell?: boolean): TableRegion {
    if (range == null)
        return null;

    let start = Position.closestActualNode(range.start,true);
    let end = Position.closestActualNode(range.end,true);

    let startTD = findContainingCell(start);
    let endTD = findContainingCell(end);

    if (!Types.isTableCell(start) || !Types.isTableCell(end)) {
        if (!allowSameCell) {
            if (startTD == endTD) // not in cell, or both in same cell
                return null;
        }
    }

    if ((startTD == null) || (endTD == null))
        return null;

    let startTable = findContainingTable(startTD);
    let endTable = findContainingTable(endTD);

    if (startTable != endTable)
        return null;

    let structure = analyseStructure(startTable);

    let startInfo = structure.cellsByElement.get(startTD);
    let endInfo = structure.cellsByElement.get(endTD);

    let startTopRow = startInfo.row;
    let startBottomRow = startInfo.row + startInfo.rowspan - 1;
    let startLeftCol = startInfo.col;
    let startRightCol = startInfo.col + startInfo.colspan - 1;

    let endTopRow = endInfo.row;
    let endBottomRow = endInfo.row + endInfo.rowspan - 1;
    let endLeftCol = endInfo.col;
    let endRightCol = endInfo.col + endInfo.colspan - 1;

    let top = (startTopRow < endTopRow) ? startTopRow : endTopRow;
    let bottom = (startBottomRow > endBottomRow) ? startBottomRow : endBottomRow;
    let left = (startLeftCol < endLeftCol) ? startLeftCol : endLeftCol;
    let right = (startRightCol > endRightCol) ? startRightCol : endRightCol;

    let region = new TableRegion(structure,top,bottom,left,right);
    adjustRegionForSpannedCells(region);
    return region;
}

// private
function adjustRegionForSpannedCells(region: TableRegion): void {
    let structure = region.structure;
    let boundariesOk: boolean;
    let columnsOk: boolean;
    do {
        boundariesOk = true;
        for (let row = region.top; row <= region.bottom; row++) {
            let cell = Table_get(structure,row,region.left);
            if (region.left > cell.left) {
                region.left = cell.left;
                boundariesOk = false;
            }
            cell = Table_get(structure,row,region.right);
            if (region.right < cell.right) {
                region.right = cell.right;
                boundariesOk = false;
            }
        }

        for (let col = region.left; col <= region.right; col++) {
            let cell = Table_get(structure,region.top,col);
            if (region.top > cell.top) {
                region.top = cell.top;
                boundariesOk = false;
            }
            cell = Table_get(structure,region.bottom,col);
            if (region.bottom < cell.bottom) {
                region.bottom = cell.bottom;
                boundariesOk = false;
            }
        }
    } while (!boundariesOk);
}

export function getSelectedTableId(): string {
    let element = Cursor.getAdjacentElementWithType(ElementTypes.HTML_TABLE);
    return element ? element.getAttribute("id") : null;
}

export interface TableProperties {
    width: string;
    rows: number;
    cols: number;
}

export function getProperties(itemId: string): TableProperties {
    let element = document.getElementById(itemId);
    if ((element == null) || (element._type != ElementTypes.HTML_TABLE))
        return null;
    let structure = analyseStructure(element);
    let width = element.style.width;
    return { width: width, rows: structure.numRows, cols: structure.numCols };
}

export function setProperties(itemId: string, width: string): void {
    let table = document.getElementById(itemId);
    if (table == null)
        return null;
    DOM.setStyleProperties(table,{ width: width });
    Selection.update(); // ensure cursor/selection drawn in correct pos
}

// Returns an array of numbers representing the percentage widths (0 - 100) of each
// column. This works on the assumption that all tables are supposed to have all of
// their column widths specified, and in all cases as percentages. Any which do not
// are considered invalid, and have any non-percentage values filled in based on the
// average values of all valid percentage-based columns.
export function getColWidths(structure: Table): number[] {
    let colElements = getColElements(structure.element);
    let colWidths = new Array<number>();

    for (let i = 0; i < structure.numCols; i++) {
        let value: number = null;

        if (i < colElements.length) {
            let widthStr = DOM.getAttribute(colElements[i],"width");
            if (widthStr != null) {
                value = parsePercentage(widthStr);
            }
        }

        if ((value != null) && (value >= 1.0)) {
            colWidths[i] = value;
        }
        else {
            colWidths[i] = null;
        }
    }

    fixWidths(colWidths,structure.numCols);

    return colWidths;

    function parsePercentage(str: string): number {
        if (str.match(/^\s*\d+(\.\d+)?\s*%\s*$/))
            return parseFloat(str.replace(/\s*%\s*$/,""));
        else
            return null;
    }
}

function fixWidths(colWidths: number[], numCols: number): void {
    let totalWidth = 0;
    let numValidCols = 0;
    for (let i = 0; i < numCols; i++) {
        if (colWidths[i] != null) {
            totalWidth += colWidths[i];
            numValidCols++;
        }
    }

    let averageWidth = (numValidCols > 0) ? totalWidth/numValidCols : 1.0;
    for (let i = 0; i < numCols; i++) {
        if (colWidths[i] == null) {
            colWidths[i] = averageWidth;
            totalWidth += averageWidth;
        }
    }

    // To cater for the case where the column widths do not all add up to 100%,
    // recalculate all of them based on their value relative to the total width
    // of all columns. For example, if there are three columns of 33%, 33%, and 33%,
    // these will get rounded up to 33.33333.....%.
    // If there are no column widths defined, each will have 100/numCols%.
    if (totalWidth > 0) {
        for (let i = 0; i < numCols; i++) {
            colWidths[i] = 100.0*colWidths[i]/totalWidth;
        }
    }
}

// public
export function setColWidths(itemId: string, widths: number[]): void {
    let element = document.getElementById(itemId);
    if (element == null)
        return null;

    let structure = analyseStructure(element);

    fixWidths(widths,structure.numCols);

    let colElements = getColElements(element);
    for (let i = 0; i < widths.length; i++)
        DOM.setAttribute(colElements[i],"width",widths[i]+"%");

    Selection.update();
}

export interface TableGeometry {
    contentRect: ClientRect;
    fullRect: ClientRect;
    parentRect: ClientRect;
    columnWidths: number[];
    hasCaption: boolean;
}

// public
// FIXME: TS: Have this return an instance of a new interface called TableGeometry
export function getGeometry(itemId: string): TableGeometry {
    let element = document.getElementById(itemId);
    if ((element == null) || (element.parentNode == null))
        return null;
    let parent = element.parentNode;
    let parentElement: HTMLElement = null;
    if (parent instanceof HTMLElement)
        parentElement = parent;
    else
        throw new Error("Table parent is not a HTMLElement");

    let structure = analyseStructure(element);

    // Calculate the rect based on the cells, not the whole table element;
    // we want to ignore the caption
    let topLeftCell = Table_get(structure,0,0);
    let bottomRightCell = Table_get(structure,structure.numRows-1,structure.numCols-1);

    if (topLeftCell == null)
        throw new Error("No top left cell");
    if (bottomRightCell == null)
        throw new Error("No bottom right cell");

    let topLeftRect = topLeftCell.element.getBoundingClientRect();
    let bottomRightRect = bottomRightCell.element.getBoundingClientRect();

    let left: number = topLeftRect.left + window.scrollX;
    let right: number = bottomRightRect.right + window.scrollX;
    let top: number = topLeftRect.top + window.scrollY;
    let bottom: number = bottomRightRect.bottom + window.scrollY;

    let caption = Traversal.firstChildOfType(element,ElementTypes.HTML_CAPTION);

    let result: any = new Object();
    return {
        contentRect: { left: left, top: top, right: right, bottom: bottom, width: right - left, height: bottom - top },
        fullRect: Util.absElementRect(element),
        parentRect: Util.absElementRect(parentElement),
        columnWidths: getColWidths(structure),
        hasCaption: (caption != null)
    };
}
