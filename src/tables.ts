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

define("Tables",function(require,exports) {
"use strict";

var Clipboard = require("Clipboard");
var Collections = require("Collections");
var Cursor = require("Cursor");
var DOM = require("DOM");
var ElementTypes = require("ElementTypes");
var Outline = require("Outline");
var Position = require("Position");
var PostponedActions = require("PostponedActions");
var Range = require("Range");
var Selection = require("Selection");
var Traversal = require("Traversal");
var Types = require("Types");
var UndoManager = require("UndoManager");
var Util = require("Util");

function Cell(element,row,col) {
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

function Cell_setRowspan(cell,rowspan) {
    if (rowspan < 1)
        rowspan = 1;
    cell.rowspan = rowspan;
    cell.bottom = cell.top + cell.rowspan - 1;
    if (rowspan == 1)
        DOM.removeAttribute(cell.element,"rowspan");
    else
        DOM.setAttribute(cell.element,"rowspan",rowspan);
}

function Cell_setColspan(cell,colspan) {
    if (colspan < 1)
        colspan = 1;
    cell.colspan = colspan;
    cell.right = cell.left + cell.colspan - 1;
    if (colspan == 1)
        DOM.removeAttribute(cell.element,"colspan");
    else
        DOM.setAttribute(cell.element,"colspan",colspan);
}

function Table(element) {
    this.element = element;
    this.row = 0;
    this.col = 0;
    this.cells = new Array();
    this.numRows = 0;
    this.numCols = 0;
    this.translated = false;
    this.cellsByElement = new Collections.NodeMap();
    Table_processTable(this,element);
}

// public
function Table_get(table,row,col) {
    if (table.cells[row] == null)
        return null;
    return table.cells[row][col];
}

// public
function Table_set(table,row,col,cell) {
    if (table.numRows < row+1)
        table.numRows = row+1;
    if (table.numCols < col+1)
        table.numCols = col+1;
    if (table.cells[row] == null)
        table.cells[row] = new Array();
    table.cells[row][col] = cell;
}

// public
function Table_setRegion(table,top,left,bottom,right,cell) {
    for (var row = top; row <= bottom; row++) {
        for (var col = left; col <= right; col++) {
            var destCell = Table_get(table,row,col);
            DOM.deleteNode(destCell.element);
            Table_set(table,row,col,cell);
        }
    }
}

function Table_processTable(table,node) {
    var type = node._type;
    switch (node._type) {
    case ElementTypes.HTML_TD:
    case ElementTypes.HTML_TH: {
        while (Table_get(table,table.row,table.col) != null)
            table.col++;

        var cell = new Cell(node,table.row,table.col);
        table.cellsByElement.put(node,cell);

        for (var r = 0; r < cell.rowspan; r++) {
            for (var c = 0; c < cell.colspan; c++) {
                Table_set(table,table.row+r,table.col+c,cell);
            }
        }
        table.col += cell.colspan;
        break;
    }
    case ElementTypes.HTML_TR:
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            Table_processTable(table,child);
        table.row++;
        table.col = 0;
        break;
    default:
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            Table_processTable(table,child);
        break;
    }
}

// public
function insertTable(rows,cols,width,numbered,caption,className) {
    UndoManager.newGroup("Insert table");

    if (rows < 1)
        rows = 1;
    if (cols < 1)
        cols = 1;

    var haveCaption = (caption != null) && (caption != "");
    var table = DOM.createElement(document,"TABLE");

    if (width != null)
        DOM.setStyleProperties(table,{"width": width});

    if (className != null)
        DOM.setAttribute(table,"class",className);

    // Caption comes first
    if (haveCaption) {
        var tableCaption = DOM.createElement(document,"CAPTION");
        DOM.appendChild(tableCaption,DOM.createTextNode(document,caption));
        DOM.appendChild(table,tableCaption);
    }

    // Set equal column widths
    var colWidth = Math.round(100/cols)+"%";
    for (var c = 0; c < cols; c++) {
        var col = DOM.createElement(document,"COL");
        DOM.setAttribute(col,"width",colWidth);
        DOM.appendChild(table,col);
    }

    var firstTD = null;

    // Then the rows and columns
    var tbody = DOM.createElement(document,"TBODY");
    DOM.appendChild(table,tbody);
    for (var r = 0; r < rows; r++) {
        var tr = DOM.createElement(document,"TR");
        DOM.appendChild(tbody,tr);
        for (var c = 0; c < cols; c++) {
            var td = DOM.createElement(document,"TD");
            var p = DOM.createElement(document,"P");
            var br = DOM.createElement(document,"BR");
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
    var pos = new Position.Position(firstTD,0);
    pos = Position.closestMatchForwards(pos,Position.okForMovement);
    Selection.set(pos.node,pos.offset,pos.node,pos.offset);

    PostponedActions.add(UndoManager.newGroup);
}

// private
function createEmptyTableCell(elementName) {
    var br = DOM.createElement(document,"BR");
    var p = DOM.createElement(document,"P");
    var td = DOM.createElement(document,elementName);
    DOM.appendChild(p,br);
    DOM.appendChild(td,p);
    return td;
}

// private
function addEmptyTableCell(newTR,elementName) {
    var td = createEmptyTableCell(elementName);
    DOM.appendChild(newTR,td);
    return td;
}

// private
function populateNewRow(structure,newTR,newRow,oldRow) {
    var col = 0;
    while (col < structure.numCols) {
        var existingCell = Table_get(structure,oldRow,col);
        if (((newRow > oldRow) && (newRow < existingCell.row + existingCell.rowspan)) ||
            ((newRow < oldRow) && (newRow >= existingCell.row))) {
            Cell_setRowspan(existingCell,existingCell.rowspan+1);
        }
        else {
            var td = addEmptyTableCell(newTR,existingCell.element.nodeName); // check-ok
            if (existingCell.colspan != 1)
                DOM.setAttribute(td,"colspan",existingCell.colspan);
        }
        col += existingCell.colspan;
    }
}

function tableAtRightOfRange(range) {
    if (!Range.isEmpty(range))
        return null;

    var pos = Position.preferElementPosition(range.start);
    if ((pos.node.nodeType == Node.ELEMENT_NODE) &&
        (pos.offset < pos.node.childNodes.length) &&
        (pos.node.childNodes[pos.offset]._type == ElementTypes.HTML_TABLE)) {
        var element = pos.node.childNodes[pos.offset];
        var table = analyseStructure(element);
        return table;
    }
    return null;
}

function tableAtLeftOfRange(range) {
    if (!Range.isEmpty(range))
        return null;

    var pos = Position.preferElementPosition(range.start);
    if ((pos.node.nodeType == Node.ELEMENT_NODE) &&
        (pos.offset > 0) &&
        (pos.node.childNodes[pos.offset-1]._type == ElementTypes.HTML_TABLE)) {
        var element = pos.node.childNodes[pos.offset-1];
        var table = analyseStructure(element);
        return table;
    }
    return null;
}

function insertRowAbove(table,row) {
    var cell = Table_get(table,row,0);
    var oldTR = cell.element.parentNode;
    var newTR = DOM.createElement(document,"TR");
    DOM.insertBefore(oldTR.parentNode,newTR,oldTR);
    populateNewRow(table,newTR,row-1,row);
}

function insertRowBelow(table,row) {
    var cell = Table_get(table,row,0);
    var oldTR = cell.element.parentNode;
    var newTR = DOM.createElement(document,"TR");
    DOM.insertBefore(oldTR.parentNode,newTR,oldTR.nextSibling);
    populateNewRow(table,newTR,row+1,row);
}

function insertRowAdjacentToRange(range) {
    var table;

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
function addAdjacentRow() {
    UndoManager.newGroup("Insert row below");
    Selection.preserveWhileExecuting(function() {
        var range = Selection.get();
        var region = regionFromRange(range,true);
        if (region != null)
            insertRowBelow(region.structure,region.bottom);
        else
            insertRowAdjacentToRange(range);
    });
    UndoManager.newGroup();
}

// private
function getColElements(table) {
    var cols = new Array();
    for (var child = table.firstChild; child != null; child = child.nextSibling) {
        switch (child._type) {
        case ElementTypes.HTML_COLGROUP:
            for (var gc = child.firstChild; gc != null; gc = gc.nextSibling) {
                if (gc._type == ElementTypes.HTML_COL)
                    cols.push(gc);
            }
            break;
        case ElementTypes.HTML_COL:
            cols.push(child);
            break;
        }
    }
    return cols;
}

// private
function getColWidthsFromElements(colElements,expectedCount) {
    // FIXME: also handle the case where the width has been set as a CSS property in the
    // style attribute. There's probably not much we can do if the width comes from a style
    // rule elsewhere in the document though.
    var colWidths = new Array();
    for (var i = 0; i < colElements.length; i++) {
        if (colElements[i].hasAttribute("width"))
            colWidths.push(colElements[i].getAttribute("width"));
        else
            colWidths.push("");
    }
    return colWidths;
}

// private
function addMissingColElements(structure,colElements) {
    // If there are fewer COL elements than there are colums, add extra ones, copying the
    // width value from the last one
    // FIXME: handle col elements with colspan > 1, as well as colgroups with width set
    // FIXME: What if there are 0 col elements?
    while (colElements.length < structure.numCols) {
        var newColElement = DOM.createElement(document,"COL");
        var lastColElement = colElements[colElements.length-1];
        DOM.insertBefore(lastColElement.parentNode,newColElement,lastColElement.nextSibling);
        colElements.push(newColElement);
        DOM.setAttribute(newColElement,"width",lastColElement.getAttribute("width"));
    }
}

// private
function fixColPercentages(structure,colElements) {
    var colWidths = getColWidthsFromElements(colElements,structure.numCols);

    var percentages = colWidths.map(getPercentage);
    if (percentages.every(notNull)) {
        var colWidthTotal = 0;
        for (var i = 0; i < percentages.length; i++)
            colWidthTotal += percentages[i];

        for (var i = 0; i < colElements.length; i++) {
            var pct = 100*percentages[i]/colWidthTotal;
            // Store value using at most two decimal places
            pct = Math.round(100*pct)/100;
            DOM.setAttribute(colElements[i],"width",pct+"%");
        }
    }

    function notNull(arg) {
        return (arg != null);
    }

    function getPercentage(str) {
        if (str.match(/^\s*\d+(\.\d+)?\s*%\s*$/))
            return parseInt(str.replace(/\s*%\s*$/,""));
        else
            return null;
    }
}

// private
function addColElement(structure,oldIndex,right) {
    var table = structure.element;

    var colElements = getColElements(table);
    if (colElements.length == 0) {
        // The table doesn't have any COL elements; don't add any
        return;
    }

    addMissingColElements(structure,colElements);

    var prevColElement = colElements[oldIndex];
    var newColElement = DOM.createElement(document,"COL");
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
function deleteColElements(structure,left,right) {
    var table = structure.element;

    var colElements = getColElements(table);
    if (colElements.length == 0) {
        // The table doesn't have any COL elements
        return;
    }

    addMissingColElements(structure,colElements);

    for (var col = left; col <= right; col++)
        DOM.deleteNode(colElements[col]);
    colElements.splice(left,right-left+1);

    fixColPercentages(structure,colElements);
}

// private
function addColumnCells(structure,oldIndex,right) {
    for (var row = 0; row < structure.numRows; row++) {
        var cell = Table_get(structure,row,oldIndex);
        var oldTD = cell.element;
        if (cell.row == row) {

            if (((right && (oldIndex+1 < cell.col + cell.colspan)) ||
                (!right && (oldIndex-1 >= cell.col))) &&
                (cell.colspan > 1)) {
                Cell_setColspan(cell,cell.colspan+1);
            }
            else {
                var newTD = createEmptyTableCell(oldTD.nodeName); // check-ok
                if (right)
                    DOM.insertBefore(cell.element.parentNode,newTD,oldTD.nextSibling);
                else
                    DOM.insertBefore(cell.element.parentNode,newTD,oldTD);
                if (cell.rowspan != 1)
                    DOM.setAttribute(newTD,"rowspan",cell.rowspan);
            }
        }
    }
}

function insertColumnAdjacentToRange(range) {
    var table;

    table = tableAtLeftOfRange(range);
    if (table != null) {
        var right = table.numCols-1;
        addColElement(table,right,right+1);
        addColumnCells(table,right,true);
        return;
    }

    table = tableAtRightOfRange(range);
    if (table != null) {
        var left = 0;
        addColElement(table,left,left-1);
        addColumnCells(table,left,false);
        return;
    }
}

// public
function addAdjacentColumn() {
    UndoManager.newGroup("Insert column at right");
    Selection.preserveWhileExecuting(function() {
        var range = Selection.get();
        var region = regionFromRange(range,true);
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

function columnHasContent(table,col) {
    for (var row = 0; row < table.numRows; row++) {
        var cell = Table_get(table,row,col);
        if ((cell != null) && (cell.col == col) && Util.nodeHasContent(cell.element))
            return true;
    }
    return false;
}

function rowHasContent(table,row) {
    for (var col = 0; col < table.numCols; col++) {
        var cell = Table_get(table,row,col);
        if ((cell != null) && (cell.row == row) && Util.nodeHasContent(cell.element))
            return true;
    }
    return false;
}

function selectRegion(table,top,bottom,left,right) {
    left = clampCol(table,left);
    right = clampCol(table,right);
    top = clampRow(table,top);
    bottom = clampRow(table,bottom);

    var tlCell = Table_get(table,top,left);
    var brCell = Table_get(table,bottom,right);
    if ((tlCell != null) && (brCell != null)) {
        var tlPos = new Position.Position(tlCell.element,0);
        tlPos = Position.closestMatchForwards(tlPos,Position.okForMovement);

        var brPos = new Position.Position(brCell.element,brCell.element.childNodes.length);
        brPos = Position.closestMatchBackwards(brPos,Position.okForMovement);

        Selection.set(tlPos.node,tlPos.offset,brPos.node,brPos.offset);
    }
}

function clampCol(table,col) {
    if (col > table.numCols-1)
        col = table.numCols-1;
    if (col < 0)
        col = 0;
    return col;
}

function clampRow(table,row) {
    if (row > table.numRows-1)
        row = table.numRows-1;
    if (row < 0)
        row = 0;
    return row;
}

function removeRowAdjacentToRange(range) {
    var table;

    table = tableAtLeftOfRange(range);
    if ((table != null) && (table.numRows >= 2)) {
        UndoManager.newGroup("Delete one row");
        var row = table.numRows-1;
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

function removeAdjacentRow() {
    var range = Selection.get();
    var region = regionFromRange(range,true);

    if (region == null) {
        removeRowAdjacentToRange(range);
        return;
    }

    if (region.structure.numRows <= 1)
        return;

    UndoManager.newGroup("Delete one row");

    var table = region.structure;
    var left = region.left;
    var right = region.right;
    var top = region.top;
    var bottom = region.bottom;

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
        var multiple = (top != bottom);

        if (multiple) {
            selectRegion(table,top,bottom-1,left,right);
        }
        else {
            var newRow = clampRow(table,bottom);
            var newCell = Table_get(table,newRow,left);
            if (newCell != null) {
                var pos = new Position.Position(newCell.element,0);
                pos = Position.closestMatchForwards(pos,Position.okForMovement);
                Selection.set(pos.node,pos.offset,pos.node,pos.offset);
            }
        }
    }

    UndoManager.newGroup();
}

function removeColumnAdjacentToRange(range) {
    var table;

    table = tableAtLeftOfRange(range);
    if ((table != null) && (table.numCols >= 2)) {
        UndoManager.newGroup("Delete one column");
        var col = table.numCols-1;
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

function removeAdjacentColumn() {
    var range = Selection.get();
    var region = regionFromRange(range,true);

    if (region == null) {
        removeColumnAdjacentToRange(range);
        return;
    }

    if (region.structure.numCols <= 1)
        return;

    UndoManager.newGroup("Delete one column");

    var table = region.structure;
    var left = region.left;
    var right = region.right;
    var top = region.top;
    var bottom = region.bottom;

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
        var multiple = (left != right);

        if (multiple) {
            selectRegion(table,top,bottom,left,right-1);
        }
        else {
            var newCol = clampCol(table,right);
            var newCell = Table_get(table,top,newCol);
            if (newCell != null) {
                var pos = new Position.Position(newCell.element,0);
                pos = Position.closestMatchForwards(pos,Position.okForMovement);
                Selection.set(pos.node,pos.offset,pos.node,pos.offset);
            }
        }
    }

    UndoManager.newGroup();
}

// private
function deleteTable(structure) {
    DOM.deleteNode(structure.element);
}

// private
function deleteRows(structure,top,bottom) {
    var trElements = new Array();
    getTRs(structure.element,trElements);

    for (var row = top; row <= bottom; row++)
        DOM.deleteNode(trElements[row]);
}

// private
function getTRs(node,result) {
    if (node._type == ElementTypes.HTML_TR) {
        result.push(node);
    }
    else {
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            getTRs(child,result);
    }
}

// private
function deleteColumns(structure,left,right) {
    var nodesToDelete = new Collections.NodeSet();
    for (var row = 0; row < structure.numRows; row++) {
        for (var col = left; col <= right; col++) {
            var cell = Table_get(structure,row,col);
            nodesToDelete.add(cell.element);
        }
    }
    nodesToDelete.forEach(DOM.deleteNode);
    deleteColElements(structure,left,right);
}

// private
function deleteCellContents(region) {
    var structure = region.structure;
    for (var row = region.top; row <= region.bottom; row++) {
        for (var col = region.left; col <= region.right; col++) {
            var cell = Table_get(structure,row,col);
            DOM.deleteAllChildren(cell.element);
        }
    }
}

// public
function deleteRegion(region) {
    var structure = region.structure;

    var coversEntireWidth = (region.left == 0) && (region.right == structure.numCols-1);
    var coversEntireHeight = (region.top == 0) && (region.bottom == structure.numRows-1);

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
function clearCells() {
}

// public
function mergeCells() {
    Selection.preserveWhileExecuting(function() {
        var region = regionFromRange(Selection.get());
        if (region == null)
            return;

        var structure = region.structure;

        // FIXME: handle the case of missing cells
        // (or even better, add cells where there are some missing)

        for (var row = region.top; row <= region.bottom; row++) {
            for (var col = region.left; col <= region.right; col++) {
                var cell = Table_get(structure,row,col);
                var cellFirstRow = cell.row;
                var cellLastRow = cell.row + cell.rowspan - 1;
                var cellFirstCol = cell.col;
                var cellLastCol = cell.col + cell.colspan - 1;

                if ((cellFirstRow < region.top) || (cellLastRow > region.bottom) ||
                    (cellFirstCol < region.left) || (cellLastCol > region.right)) {
                    Util.debug("Can't merge this table: cell at "+row+","+col+
                               " goes outside bounds of selection");
                    return;
                }
            }
        }

        var mergedCell = Table_get(structure,region.top,region.left);

        for (var row = region.top; row <= region.bottom; row++) {
            for (var col = region.left; col <= region.right; col++) {
                var cell = Table_get(structure,row,col);
                // parentNode will be null if we've already done this cell
                if ((cell != mergedCell) && (cell.element.parentNode != null)) {
                    while (cell.element.firstChild != null)
                        DOM.appendChild(mergedCell.element,cell.element.firstChild);
                    DOM.deleteNode(cell.element);
                }
            }
        }

        var totalRows = region.bottom - region.top + 1;
        var totalCols = region.right - region.left + 1;
        if (totalRows == 1)
            DOM.removeAttribute(mergedCell.element,"rowspan");
        else
            DOM.setAttribute(mergedCell.element,"rowspan",totalRows);
        if (totalCols == 1)
            DOM.removeAttribute(mergedCell.element,"colspan");
        else
            DOM.setAttribute(mergedCell.element,"colspan",totalCols);
    });
}

// public
function splitSelection() {
    Selection.preserveWhileExecuting(function() {
        var range = Selection.get();
        Range.trackWhileExecuting(range,function() {
            var region = regionFromRange(range,true);
            if (region != null)
                TableRegion_splitCells(region);
        });
    });
}

// public
function TableRegion_splitCells(region) {
    var structure = region.structure;
    var trElements = new Array();
    getTRs(structure.element,trElements);

    for (var row = region.top; row <= region.bottom; row++) {
        for (var col = region.left; col <= region.right; col++) {
            var cell = Table_get(structure,row,col);
            if ((cell.rowspan > 1) || (cell.colspan > 1)) {

                var original = cell.element;

                for (var r = cell.top; r <= cell.bottom; r++) {
                    for (var c = cell.left; c <= cell.right; c++) {
                        if ((r == cell.top) && (c == cell.left))
                            continue;
                        var newTD = createEmptyTableCell(original.nodeName); // check-ok
                        var nextElement = null;

                        var nextCol = cell.right+1;
                        while (nextCol < structure.numCols) {
                            var nextCell = Table_get(structure,r,nextCol);
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
function cloneRegion(region) {
    var cellNodesDone = new Collections.NodeSet();
    var table = DOM.shallowCopyElement(region.structure.element);
    for (var row = region.top; row <= region.bottom; row++) {
        var tr = DOM.createElement(document,"TR");
        DOM.appendChild(table,tr);
        for (var col = region.left; col <= region.right; col++) {
            var cell = Table_get(region.structure,row,col);
            if (!cellNodesDone.contains(cell.element)) {
                DOM.appendChild(tr,DOM.cloneNode(cell.element,true));
                cellNodesDone.add(cell.element);
            }
        }
    }
    return table;
}

// private
function pasteCells(fromTableElement,toRegion) {
    // FIXME
    var fromStructure = analyseStructure(fromTableElement);
}

// public
function Table_fix(table) {
    var changed = false;

    var tbody = null;
    for (var child = table.element.firstChild; child != null; child = child.nextSibling) {
        if (child._type == ElementTypes.HTML_TBODY)
            tbody = child;
    }

    if (tbody == null)
        return table; // FIXME: handle presence of THEAD and TFOOT, and also a missing TBODY

    var trs = new Array();
    for (var child = tbody.firstChild; child != null; child = child.nextSibling) {
        if (child._type == ElementTypes.HTML_TR)
            trs.push(child);
    }

    while (trs.length < table.numRows) {
        var tr = DOM.createElement(document,"TR");
        DOM.appendChild(tbody,tr);
        trs.push(tr);
    }

    for (var row = 0; row < table.numRows; row++) {
        for (var col = 0; col < table.numCols; col++) {
            var cell = Table_get(table,row,col);
            if (cell == null) {
                var td = createEmptyTableCell("TD");
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
function Table_fixColumnWidths(structure) {
    var colElements = getColElements(structure.element);
    if (colElements.length == 0)
        return;
    addMissingColElements(structure,colElements);

    var widths = getColWidths(structure);
    fixWidths(widths,structure.numCols);
    colElements = getColElements(structure.element);
    for (var i = 0; i < widths.length; i++)
        DOM.setAttribute(colElements[i],"width",widths[i]+"%");
}

// public
function analyseStructure(element) {
    // FIXME: we should probably be preserving the selection here, since we are modifying
    // the DOM (though I think it's unlikely it would cause problems, becausing the fixup
    // logic only adds elements). However this method is called (indirectly) from within
    // Selection.update(), which causes unbounded recursion due to the subsequent Selecton_set()
    // that occurs.
    var initial = new Table(element);
    var fixed = Table_fix(initial);
    return fixed;
}

// public
function findContainingCell(node) {
    for (var ancestor = node; ancestor != null; ancestor = ancestor.parentNode) {
        if (Types.isTableCell(ancestor))
            return ancestor;
    }
    return null;
}

// public
function findContainingTable(node) {
    for (var ancestor = node; ancestor != null; ancestor = ancestor.parentNode) {
        if (ancestor._type == ElementTypes.HTML_TABLE)
            return ancestor;
    }
    return null;
}

function TableRegion(structure,top,bottom,left,right) {
    this.structure = structure;
    this.top = top;
    this.bottom = bottom;
    this.left = left;
    this.right = right;
}

TableRegion.prototype.toString = function() {
    return "("+this.top+","+this.left+") - ("+this.bottom+","+this.right+")";
}

// public
function regionFromRange(range,allowSameCell?) {
    var region = null;

    if (range == null)
        return null;

    var start = Position.closestActualNode(range.start,true);
    var end = Position.closestActualNode(range.end,true);

    var startTD = findContainingCell(start);
    var endTD = findContainingCell(end);

    if (!Types.isTableCell(start) || !Types.isTableCell(end)) {
        if (!allowSameCell) {
            if (startTD == endTD) // not in cell, or both in same cell
                return null;
        }
    }

    if ((startTD == null) || (endTD == null))
        return null;

    var startTable = findContainingTable(startTD);
    var endTable = findContainingTable(endTD);

    if (startTable != endTable)
        return null;

    var structure = analyseStructure(startTable);

    var startInfo = structure.cellsByElement.get(startTD);
    var endInfo = structure.cellsByElement.get(endTD);

    var startTopRow = startInfo.row;
    var startBottomRow = startInfo.row + startInfo.rowspan - 1;
    var startLeftCol = startInfo.col;
    var startRightCol = startInfo.col + startInfo.colspan - 1;

    var endTopRow = endInfo.row;
    var endBottomRow = endInfo.row + endInfo.rowspan - 1;
    var endLeftCol = endInfo.col;
    var endRightCol = endInfo.col + endInfo.colspan - 1;

    var top = (startTopRow < endTopRow) ? startTopRow : endTopRow;
    var bottom = (startBottomRow > endBottomRow) ? startBottomRow : endBottomRow;
    var left = (startLeftCol < endLeftCol) ? startLeftCol : endLeftCol;
    var right = (startRightCol > endRightCol) ? startRightCol : endRightCol;

    var region = new TableRegion(structure,top,bottom,left,right);
    adjustRegionForSpannedCells(region);
    return region;
}

// private
function adjustRegionForSpannedCells(region) {
    var structure = region.structure;
    var boundariesOk;
    var columnsOk;
    do {
        boundariesOk = true;
        for (var row = region.top; row <= region.bottom; row++) {
            var cell = Table_get(structure,row,region.left);
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

        for (var col = region.left; col <= region.right; col++) {
            var cell = Table_get(structure,region.top,col);
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

function getSelectedTableId() {
    var element = Cursor.getAdjacentNodeWithType(ElementTypes.HTML_TABLE);
    return element ? element.getAttribute("id") : null;
}

function getProperties(itemId) {
    var element = document.getElementById(itemId);
    if ((element == null) || (element._type != ElementTypes.HTML_TABLE))
        return null;
    var structure = analyseStructure(element);
    var width = element.style.width;
    return { width: width, rows: structure.numRows, cols: structure.numCols };
}

function setProperties(itemId,width) {
    var table = document.getElementById(itemId);
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
function getColWidths(structure) {
    var colElements = getColElements(structure.element);
    var colWidths = new Array();

    for (var i = 0; i < structure.numCols; i++) {
        var value = null;

        if (i < colElements.length) {
            var widthStr = DOM.getAttribute(colElements[i],"width");
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

    function parsePercentage(str) {
        if (str.match(/^\s*\d+(\.\d+)?\s*%\s*$/))
            return parseFloat(str.replace(/\s*%\s*$/,""));
        else
            return null;
    }
}

function fixWidths(colWidths,numCols) {
    var totalWidth = 0;
    var numValidCols = 0;
    for (var i = 0; i < numCols; i++) {
        if (colWidths[i] != null) {
            totalWidth += colWidths[i];
            numValidCols++;
        }
    }

    var averageWidth = (numValidCols > 0) ? totalWidth/numValidCols : 1.0;
    for (var i = 0; i < numCols; i++) {
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
        for (var i = 0; i < numCols; i++) {
            colWidths[i] = 100.0*colWidths[i]/totalWidth;
        }
    }
}

// public
function setColWidths(itemId,widths) {
    var element = document.getElementById(itemId);
    if (element == null)
        return null;

    var structure = analyseStructure(element);

    fixWidths(widths,structure.numCols);

    var colElements = getColElements(element);
    for (var i = 0; i < widths.length; i++)
        DOM.setAttribute(colElements[i],"width",widths[i]+"%");

    Selection.update();
}

// public
function getGeometry(itemId) {
    var element = document.getElementById(itemId);
    if ((element == null) || (element.parentNode == null))
        return null;

    var structure = analyseStructure(element);

    var result = new Object();

    // Calculate the rect based on the cells, not the whole table element;
    // we want to ignore the caption
    var topLeftCell = Table_get(structure,0,0);
    var bottomRightCell = Table_get(structure,structure.numRows-1,structure.numCols-1);

    if (topLeftCell == null)
        throw new Error("No top left cell");
    if (bottomRightCell == null)
        throw new Error("No bottom right cell");

    var topLeftRect = topLeftCell.element.getBoundingClientRect();
    var bottomRightRect = bottomRightCell.element.getBoundingClientRect();

    var left = topLeftRect.left + window.scrollX;
    var right = bottomRightRect.right + window.scrollX;
    var top = topLeftRect.top + window.scrollY;
    var bottom = bottomRightRect.bottom + window.scrollY;

    result.contentRect = { x: left, y: top, width: right - left, height: bottom - top };
    result.fullRect = Util.xywhAbsElementRect(element);
    result.parentRect = Util.xywhAbsElementRect(element.parentNode);

    result.columnWidths = getColWidths(structure);

    var caption = Traversal.firstChildOfType(element,ElementTypes.HTML_CAPTION);
    result.hasCaption = (caption != null);

    return result;

}

exports.Table_get = Table_get;
exports.Table_set = Table_set;
exports.Table_setRegion = Table_setRegion;
exports.insertTable = insertTable;
exports.addAdjacentRow = addAdjacentRow;
exports.addAdjacentColumn = addAdjacentColumn;
exports.removeAdjacentRow = removeAdjacentRow;
exports.removeAdjacentColumn = removeAdjacentColumn;
exports.deleteRegion = deleteRegion;
exports.clearCells = clearCells;
exports.mergeCells = mergeCells;
exports.splitSelection = splitSelection;
exports.TableRegion_splitCells = TableRegion_splitCells;
exports.cloneRegion = cloneRegion;
exports.Table_fix = Table_fix;
exports.Table_fixColumnWidths = Table_fixColumnWidths;
exports.analyseStructure = analyseStructure;
exports.findContainingCell = findContainingCell;
exports.findContainingTable = findContainingTable;
exports.regionFromRange = regionFromRange;
exports.getSelectedTableId = getSelectedTableId;
exports.getProperties = getProperties;
exports.setProperties = setProperties;
exports.getColWidths = getColWidths;
exports.setColWidths = setColWidths;
exports.getGeometry = getGeometry;

});
