// Copyright (c) 2012 UX Productivity Pty Ltd. All rights reserved.

var Tables_insertTable;
var Tables_insertRowAbove;
var Tables_insertRowBelow;
var Tables_insertColumnLeft;
var Tables_insertColumnRight;
var Tables_deleteRegion;
var Tables_clearCells;
var Tables_mergeCells;
var Tables_splitSelection;
var Tables_cloneRegion;
var Tables_analyseStructure;
var Tables_findContainingCell;
var Tables_findContainingTable;
var Tables_regionFromRange;
var Tables_getSelectedTableId;
var Tables_getProperties;
var Tables_setProperties;

(function() {

    function Cell(element,row,col)
    {
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

    Cell.prototype.setRowspan = function(rowspan)
    {
        if (rowspan < 1)
            rowspan = 1;
        this.rowspan = rowspan;
        this.bottom = this.top + this.rowspan - 1;
        if (rowspan == 1)
            DOM_removeAttribute(this.element,"rowspan");
        else
            DOM_setAttribute(this.element,"rowspan",rowspan);
    }

    Cell.prototype.setColspan = function(colspan)
    {
        if (colspan < 1)
            colspan = 1;
        this.colspan = colspan;
        this.right = this.left + this.colspan - 1;
        if (colspan == 1)
            DOM_removeAttribute(this.element,"colspan");
        else
            DOM_setAttribute(this.element,"colspan",colspan);
    }

    function Table(element)
    {
        this.element = element;
        this.row = 0;
        this.col = 0;
        this.cells = new Array();
        this.numRows = 0;
        this.numCols = 0;
        this.translated = false;
        this.cellsByElement = new NodeMap();
        this.processTable(element);
    }

    Table.prototype.set = function(row,col,cell)
    {
        if (this.numRows < row+1)
            this.numRows = row+1;
        if (this.numCols < col+1)
            this.numCols = col+1;
        if (this.cells[row] == null)
            this.cells[row] = new Array();
        this.cells[row][col] = cell;
    }

    Table.prototype.get = function(row,col)
    {
        if (this.cells[row] == null)
            return null;
        return this.cells[row][col];
    }

    Table.prototype.processTable = function(node)
    {
        if ((DOM_upperName(node) == "TD") || (DOM_upperName(node) == "TH")) {
            while (this.get(this.row,this.col) != null)
                this.col++;

            var cell = new Cell(node,this.row,this.col);
            this.cellsByElement.put(node,cell);

            for (var r = 0; r < cell.rowspan; r++) {
                for (var c = 0; c < cell.colspan; c++) {
                    this.set(this.row+r,this.col+c,cell);
                }
            }
            this.col += cell.colspan;
        }
        else if (DOM_upperName(node) == "TR") {
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                this.processTable(child);
            this.row++;
            this.col = 0;
        }
        else {
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                this.processTable(child);
        }
    }

    // public
    Tables_insertTable = trace(function insertTable(rows,cols,width,numbered,caption)
    {
        UndoManager_newGroup("Insert table");

        if (rows < 1)
            rows = 1;
        if (cols < 1)
            cols = 1;

        var haveCaption = (caption != null) && (caption != "");

        Styles_addDefaultRuleCategory("td-paragraph-margins");
        Styles_addDefaultRuleCategory("th-paragraph-margins");
        Styles_addDefaultRuleCategory("table-borders");
        if (numbered || haveCaption)
            Styles_addDefaultRuleCategory("table-caption");

        var table = DOM_createElement(document,"TABLE");

        if (width != null)
            DOM_setStyleProperties(table,{"width": width});

        // Caption comes first
        if (haveCaption) {
            var tableCaption = DOM_createElement(document,"CAPTION");
            DOM_appendChild(tableCaption,DOM_createTextNode(document,caption));
            DOM_appendChild(table,tableCaption);
        }

        // Set equal column widths
        var colWidth = Math.round(100/cols)+"%";
        for (var c = 0; c < cols; c++) {
            var col = DOM_createElement(document,"COL");
            DOM_setAttribute(col,"width",colWidth);
            DOM_appendChild(table,col);
        }

        var firstTD = null;

        // Then the rows and columns
        for (var r = 0; r < rows; r++) {
            var tr = DOM_createElement(document,"TR");
            DOM_appendChild(table,tr);
            for (var c = 0; c < cols; c++) {
                var td = DOM_createElement(document,"TD");
                var p = DOM_createElement(document,"P");
                var br = DOM_createElement(document,"BR");
                DOM_appendChild(tr,td);
                DOM_appendChild(td,p);
                DOM_appendChild(p,br);

                if (firstTD == null)
                    firstTD = td;
            }
        }

        Clipboard_pasteNodes([table]);

        // Now that the table has been inserted into the DOM tree, the outline code will
        // have noticed it and added an id attribute, as well as a caption giving the
        // table number.
        Outline_setNumbered(table.getAttribute("id"),numbered);

        // Place the cursor at the start of the first cell on the first row
        var pos = new Position(firstTD,0);
        pos = Position_closestMatchForwards(pos,Position_okForMovement);
        Selection_set(pos.node,pos.offset,pos.node,pos.offset);
        Selection_update();

        PostponedActions_add(UndoManager_newGroup);
    });

    // private
    var createEmptyTableCell = trace(function createEmptyTableCell(elementName)
    {
        var br = DOM_createElement(document,"BR");
        var p = DOM_createElement(document,"P");
        var td = DOM_createElement(document,elementName);
        DOM_appendChild(p,br);
        DOM_appendChild(td,p);
        return td;
    });

    // private
    var addEmptyTableCell = trace(function addEmptyTableCell(newTR,elementName)
    {
        var td = createEmptyTableCell(elementName);
        DOM_appendChild(newTR,td);
        return td;
    });

    // private
    var populateNewRow = trace(function populateNewRow(structure,newTR,newRow,oldRow)
    {
        var col = 0;
        while (col < structure.numCols) {
            var existingCell = structure.get(oldRow,col);
            if (((newRow > oldRow) && (newRow < existingCell.row + existingCell.rowspan)) ||
                ((newRow < oldRow) && (newRow >= existingCell.row))) {
                existingCell.setRowspan(existingCell.rowspan+1);
            }
            else {
                var td = addEmptyTableCell(newTR,existingCell.element.nodeName); // check-ok
                if (existingCell.colspan != 1)
                    DOM_setAttribute(td,"colspan",existingCell.colspan);
            }
            col += existingCell.colspan;
        }
    });

    // public
    Tables_insertRowAbove = trace(function insertRowAbove()
    {
        UndoManager_newGroup("Insert row above");
        Selection_preserveWhileExecuting(function() {
            var region = Tables_regionFromRange(Selection_get(),true);
            if (region != null) {
                var cell = region.structure.get(region.top,region.left);
                var oldTR = cell.element.parentNode;
                var newTR = DOM_createElement(document,"TR");
                DOM_insertBefore(oldTR.parentNode,newTR,oldTR);
                populateNewRow(region.structure,newTR,region.top-1,region.top);
            }
        });
        UndoManager_newGroup();
    });

    // public
    Tables_insertRowBelow = trace(function insertRowBelow()
    {
        UndoManager_newGroup("Insert row below");
        Selection_preserveWhileExecuting(function() {
            var region = Tables_regionFromRange(Selection_get(),true);
            if (region != null) {
                var cell = region.structure.get(region.bottom,region.left);
                var oldTR = cell.element.parentNode;
                var newTR = DOM_createElement(document,"TR");
                DOM_insertBefore(oldTR.parentNode,newTR,oldTR.nextSibling);
                populateNewRow(region.structure,newTR,region.bottom+1,region.bottom);
            }
        });
        UndoManager_newGroup();
    });

    // private
    var getColElements = trace(function getColElements(table)
    {
        var cols = new Array();
        for (child = table.firstChild; child != null; child = child.nextSibling) {
            if (DOM_upperName(child) == "COLGROUP") {
                for (var gc = child.firstChild; gc != null; gc = gc.nextSibling) {
                    if (DOM_upperName(gc) == "COL")
                        cols.push(gc);
                }
            }
            else if (DOM_upperName(child) == "COL") {
                cols.push(child);
            }
        }
        return cols;
    });

    // private
    var getColWidths = trace(function getColWidths(colElements,expectedCount)
    {
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
    });

    // private
    var addMissingColElements = trace(function addMissingColElements(structure,colElements)
    {
        // If there are fewer COL elements than there are colums, add extra ones, copying the
        // width value from the last one
        // FIXME: handle col elements with colspan > 1, as well as colgroups with width set
        while (colElements.length < structure.numCols) {
            var newColElement = DOM_createElement(document,"COL");
            var lastColElement = colElements[colElements.length-1];
            DOM_insertBefore(lastColElement.parentNode,newColElement,lastColElement.nextSibling);
            colElements.push(newColElement);
            DOM_setAttribute(newColElement,"width",lastColElement.getAttribute("width"));
        }
    });

    // private
    var fixColPercentages = trace(function fixColPercentages(structure,colElements)
    {
        var colWidths = getColWidths(colElements,structure.numCols);

        var percentages = colWidths.map(getPercentage);
        if (percentages.every(notNull)) {
            var colWidthTotal = 0;
            for (var i = 0; i < percentages.length; i++)
                colWidthTotal += percentages[i];

            for (var i = 0; i < colElements.length; i++) {
                var pct = 100*percentages[i]/colWidthTotal;
                // Store value using at most two decimal places
                pct = Math.round(100*pct)/100;
                DOM_setAttribute(colElements[i],"width",pct+"%");
            }
        }

        function notNull(arg)
        {
            return (arg != null);
        }

        function getPercentage(str)
        {
            if (str.match(/^\s*\d+(\.\d+)?\s*%\s*$/))
                return parseInt(str.replace(/\s*%\s*$/,""));
            else
                return null;
        }
    });

    // private
    var addColElement = trace(function addColElement(structure,oldIndex,right)
    {
        var table = structure.element;

        var colElements = getColElements(table);
        if (colElements.length == 0) {
            // The table doesn't have any COL elements; don't add any
            return;
        }

        addMissingColElements(structure,colElements);

        var prevColElement = colElements[oldIndex];
        var newColElement = DOM_createElement(document,"COL");
        DOM_setAttribute(newColElement,"width",prevColElement.getAttribute("width"));
        if (right)
            DOM_insertBefore(prevColElement.parentNode,newColElement,prevColElement.nextSibling);
        else
            DOM_insertBefore(prevColElement.parentNode,newColElement,prevColElement);

        if (right) {
            colElements.splice(oldIndex+1,0,newColElement);
        }
        else {
            colElements.splice(oldIndex+1,0,newColElement);
        }

        fixColPercentages(structure,colElements);
    });

    // private
    var deleteColElements = trace(function deleteColElements(structure,left,right)
    {
        var table = structure.element;

        var colElements = getColElements(table);
        if (colElements.length == 0) {
            // The table doesn't have any COL elements
            return;
        }

        addMissingColElements(structure,colElements);

        for (var col = left; col <= right; col++)
            DOM_deleteNode(colElements[col]);
        colElements.splice(left,right-left+1);

        fixColPercentages(structure,colElements);
    });

    // private
    var addColumnCells = trace(function addColumnCells(structure,oldIndex,right)
    {
        for (var row = 0; row < structure.numRows; row++) {
            var cell = structure.get(row,oldIndex);
            var oldTD = cell.element;
            if (cell.row == row) {

                if (((right && (oldIndex+1 < cell.col + cell.colspan)) ||
                    (!right && (oldIndex-1 >= cell.col))) &&
                    (cell.colspan > 1)) {
                    cell.setColspan(cell.colspan+1);
                }
                else {
                    var newTD = createEmptyTableCell(oldTD.nodeName); // check-ok
                    if (right)
                        DOM_insertBefore(cell.element.parentNode,newTD,oldTD.nextSibling);
                    else
                        DOM_insertBefore(cell.element.parentNode,newTD,oldTD);
                    if (cell.rowspan != 1)
                        DOM_setAttribute(newTD,"rowspan",cell.rowspan);
                }
            }
        }
    });

    // public
    Tables_insertColumnLeft = trace(function insertColumnLeft()
    {
        UndoManager_newGroup("Insert column at left");
        Selection_preserveWhileExecuting(function() {
            var region = Tables_regionFromRange(Selection_get(),true);
            if (region != null) {
                addColElement(region.structure,region.left,region.left-1);
                addColumnCells(region.structure,region.left,false);
            }
        });
        UndoManager_newGroup();
    });

    // public
    Tables_insertColumnRight = trace(function insertColumnRight()
    {
        UndoManager_newGroup("Insert column at right");
        Selection_preserveWhileExecuting(function() {
            var region = Tables_regionFromRange(Selection_get(),true);
            if (region != null) {
                addColElement(region.structure,region.right,region.right+1);
                addColumnCells(region.structure,region.right,true);
            }
        });
        UndoManager_newGroup();
    });

    // private
    var deleteTable = trace(function deleteTable(structure)
    {
        DOM_deleteNode(structure.element);
    });

    // private
    var deleteRows = trace(function deleteRows(structure,top,bottom)
    {
        var trElements = new Array();
        getTRs(structure.element,trElements);

        for (var row = top; row <= bottom; row++)
            DOM_deleteNode(trElements[row]);
    });

    // private
    var getTRs = trace(function getTRs(node,result)
    {
        if (DOM_upperName(node) == "TR") {
            result.push(node);
        }
        else {
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                getTRs(child,result);
        }
    });

    // private
    var deleteColumns = trace(function deleteColumns(structure,left,right)
    {
        var nodesToDelete = new NodeSet();
        for (var row = 0; row < structure.numRows; row++) {
            for (var col = left; col <= right; col++) {
                var cell = structure.get(row,col);
                nodesToDelete.add(cell.element);
            }
        }
        nodesToDelete.forEach(DOM_deleteNode);
        deleteColElements(structure,left,right);
    });

    // private
    var deleteCellContents = trace(function deleteCellContents(region)
    {
        var structure = region.structure;
        for (var row = region.top; row <= region.bottom; row++) {
            for (var col = region.left; col <= region.right; col++) {
                var cell = structure.get(row,col);
                DOM_deleteAllChildren(cell.element);
            }
        }
    });

    // public
    Tables_deleteRegion = trace(function deleteRegion(region)
    {
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
    });

    // public
    Tables_clearCells = trace(function clearCells()
    {
    });

    // public
    Tables_mergeCells = trace(function mergeCells()
    {
        Selection_preserveWhileExecuting(function() {
            var region = Tables_regionFromRange(Selection_get());
            if (region == null)
                return;

            var structure = region.structure;

            // FIXME: handle the case of missing cells
            // (or even better, add cells where there are some missing)

            for (var row = region.top; row <= region.bottom; row++) {
                for (var col = region.left; col <= region.right; col++) {
                    var cell = structure.get(row,col);
                    var cellFirstRow = cell.row;
                    var cellLastRow = cell.row + cell.rowspan - 1;
                    var cellFirstCol = cell.col;
                    var cellLastCol = cell.col + cell.colspan - 1;

                    if ((cellFirstRow < region.top) || (cellLastRow > region.bottom) ||
                        (cellFirstCol < region.left) || (cellLastCol > region.right)) {
                        debug("Can't merge this table: cell at "+row+","+col+
                              " goes outside bounds of selection");
                        return;
                    }
                }
            }

            var mergedCell = structure.get(region.top,region.left);

            for (var row = region.top; row <= region.bottom; row++) {
                for (var col = region.left; col <= region.right; col++) {
                    var cell = structure.get(row,col);
                    // parentNode will be null if we've already done this cell
                    if ((cell != mergedCell) && (cell.element.parentNode != null)) {
                        while (cell.element.firstChild != null)
                            DOM_appendChild(mergedCell.element,cell.element.firstChild);
                        DOM_deleteNode(cell.element);
                    }
                }
            }

            var totalRows = region.bottom - region.top + 1;
            var totalCols = region.right - region.left + 1;
            if (totalRows == 1)
                DOM_removeAttribute(mergedCell.element,"rowspan");
            else
                DOM_setAttribute(mergedCell.element,"rowspan",totalRows);
            if (totalCols == 1)
                DOM_removeAttribute(mergedCell.element,"colspan");
            else
                DOM_setAttribute(mergedCell.element,"colspan",totalCols);
        });
    });

    // public
    Tables_splitSelection = trace(function splitSelection()
    {
        Selection_preserveWhileExecuting(function() {
            var range = Selection_get();
            range.trackWhileExecuting(function() {
                var region = Tables_regionFromRange(range,true);
                if (region != null)
                    splitCellsInRegion(region);
            });
        });
    });

    // private
    var splitCellsInRegion = trace(function splitCellsInRegion(region)
    {
        var structure = region.structure;
        var trElements = new Array();
        getTRs(structure.element,trElements);

        for (var row = region.top; row <= region.bottom; row++) {
            for (var col = region.left; col <= region.right; col++) {
                var cell = structure.get(row,col);
                if ((cell.rowspan > 1) || (cell.colspan > 1)) {

                    var original = cell.element;

                    for (var r = cell.top; r <= cell.bottom; r++) {
                        for (var c = cell.left; c <= cell.right; c++) {
                            if ((r == cell.top) && (c == cell.left))
                                continue;
                            var newTD = createEmptyTableCell(original.nodeName); // check-ok
                            var nextCell = structure.get(r,cell.right+1);
                            var nextElement = null;
                            if ((nextCell != null) && (nextCell.row == r))
                                nextElement = nextCell.element;
                            DOM_insertBefore(trElements[r],newTD,nextElement);
                            structure.set(r,c,new Cell(newTD,r,c));
                        }
                    }
                    DOM_removeAttribute(original,"rowspan");
                    DOM_removeAttribute(original,"colspan");
                }
            }
        }
    });

    // public
    Tables_cloneRegion = trace(function cloneRegion(region)
    {
        var cellNodesDone = new NodeSet();
        var table = DOM_shallowCopyElement(region.structure.element);
        for (var row = region.top; row <= region.bottom; row++) {
            var tr = DOM_createElement(document,"TR");
            DOM_appendChild(table,tr);
            for (var col = region.left; col <= region.right; col++) {
                var cell = region.structure.get(row,col);
                if (!cellNodesDone.contains(cell.element)) {
                    DOM_appendChild(tr,DOM_cloneNode(cell.element,true));
                    cellNodesDone.add(cell.element);
                }
            }
        }
        return table;
    });

    // private
    var pasteCells = trace(function pasteCells(fromTableElement,toRegion)
    {
        // FIXME
        var fromStructure = Tables_analyseStructure(fromTableElement);
    });

    // public
    Tables_analyseStructure = trace(function analyseStructure(element)
    {
        return new Table(element);
    });

    // public
    Tables_findContainingCell = trace(function findContainingCell(node)
    {
        for (var ancestor = node; ancestor != null; ancestor = ancestor.parentNode) {
            if (isTableCell(ancestor))
                return ancestor;
        }
        return null;
    });

    // public
    Tables_findContainingTable = trace(function findContainingTable(node)
    {
        for (var ancestor = node; ancestor != null; ancestor = ancestor.parentNode) {
            if (isTableNode(ancestor))
                return ancestor;
        }
        return null;
    });

    function TableRegion(structure,top,bottom,left,right)
    {
        this.structure = structure;
        this.top = top;
        this.bottom = bottom;
        this.left = left;
        this.right = right;
    }

    TableRegion.prototype.toString = function()
    {
        return "("+this.top+","+this.left+") - ("+this.bottom+","+this.right+")";
    }

    // public
    Tables_regionFromRange = trace(function regionFromRange(range,allowSameCell)
    {
        var region = null;

        if (range == null)
            return null;

        var start = range.start.closestActualNode(true);
        var end = range.end.closestActualNode(true);

        var startTD = Tables_findContainingCell(start);
        var endTD = Tables_findContainingCell(end);

        if (!isTableCell(start) || !isTableCell(end)) {
            if (!allowSameCell) {
                if (startTD == endTD) // not in cell, or both in same cell
                    return null;
            }
        }

        if ((startTD == null) || (endTD == null))
            return null;

        var startTable = Tables_findContainingTable(startTD);
        var endTable = Tables_findContainingTable(endTD);

        if (startTable != endTable)
            return null;

        var structure = Tables_analyseStructure(startTable);

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
    });

    // private
    var adjustRegionForSpannedCells = trace(function adjustRegionForSpannedCells(region)
    {
        var structure = region.structure;
        var boundariesOk;
        var columnsOk;
        do {
            boundariesOk = true;
            for (var row = region.top; row <= region.bottom; row++) {
                var cell = structure.get(row,region.left);
                if (region.left > cell.left) {
                    region.left = cell.left;
                    boundariesOk = false;
                }
                cell = structure.get(row,region.right);
                if (region.right < cell.right) {
                    region.right = cell.right;
                    boundariesOk = false;
                }
            }

            for (var col = region.left; col <= region.right; col++) {
                var cell = structure.get(region.top,col);
                if (region.top > cell.top) {
                    region.top = cell.top;
                    boundariesOk = false;
                }
                cell = structure.get(region.bottom,col);
                if (region.bottom < cell.bottom) {
                    region.bottom = cell.bottom;
                    boundariesOk = false;
                }
            }
        } while (!boundariesOk);
    });

    Tables_getSelectedTableId = trace(function getSelectedTableId()
    {
        var element = Cursor_getAdjacentNodeWithName("TABLE");
        return element ? element.getAttribute("id") : null;
    });

    Tables_getProperties = trace(function getProperties(itemId)
    {
        var table = document.getElementById(itemId);
        if (table == null)
            return null;
        var width = table.style.width;
        return { width: width };
    });

    Tables_setProperties = trace(function setProperties(itemId,width)
    {
        var table = document.getElementById(itemId);
        if (table == null)
            return null;
        DOM_setStyleProperties(table,{ width: width });
        Selection_update(); // ensure cursor/selection drawn in correct pos
    });

})();
