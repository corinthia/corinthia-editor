// Copyright (c) 2012 UX Productivity Pty Ltd. All rights reserved.

var Tables_insertTable;
var Tables_insertRowAbove;
var Tables_insertRowBelow;
var Tables_insertColumnLeft;
var Tables_insertColumnRight;
var Tables_deleteRows;
var Tables_deleteColumns;
var Tables_clearCells;
var Tables_mergeCells;
var Tables_splitCell;
var Tables_analyseStructure;
var Tables_findContainingCell;
var Tables_findContainingTable;
var Tables_getTableRegionFromRange;

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
    }

    Cell.prototype.setRowspan = function(rowspan)
    {
        if (rowspan < 1)
            rowspan = 1;
        this.rowspan = rowspan;
        if (rowspan == 1)
            this.element.removeAttribute("rowspan");
        else
            this.element.setAttribute("rowspan",rowspan);
    }

    Cell.prototype.setColspan = function(colspan)
    {
        if (colspan < 1)
            colspan = 1;
        this.colspan = colspan;
        if (colspan == 1)
            this.element.removeAttribute("colspan");
        else
            this.element.setAttribute("colspan",colspan);
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
            var cell = new Cell(node,this.row,this.col);
            this.cellsByElement.put(node,cell);

            while (this.get(this.row,this.col) != null)
                this.col++;

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
    function insertTable(rows,cols,width,numbered,caption)
    {
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
            table.style.width = width;

        // Caption comes first
        if (haveCaption) {
            var tableCaption = DOM_createElement(document,"CAPTION");
            tableCaption.appendChild(DOM_createTextNode(document,caption));
            DOM_appendChild(table,tableCaption);
        }

        // Set equal column widths
        var colWidth = Math.round(100/cols)+"%";
        for (var c = 0; c < cols; c++) {
            var col = DOM_createElement(document,"COL");
            col.setAttribute("style","width: "+colWidth);
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
        pos = Cursor_closestPositionForwards(pos);
        Selection_setEmptySelectionAt(pos.node,pos.offset);
    }

    function createEmptyTableCell(elementName)
    {
        var br = DOM_createElement(document,"BR");
        var p = DOM_createElement(document,"P");
        var td = DOM_createElement(document,elementName);
        DOM_appendChild(p,br);
        DOM_appendChild(td,p);
        return td;
    }

    function addEmptyTableCell(newTR,elementName)
    {
        var td = createEmptyTableCell(elementName);
        DOM_appendChild(newTR,td);
        return td;
    }

    function populateNewRow(structure,newTR,newRow,oldRow)
    {
        var col = 0;
        while (col < structure.numCols) {
            var existingCell = structure.get(oldRow,col);
            if (((newRow > oldRow) && (newRow < existingCell.row + existingCell.rowspan)) ||
                ((newRow < oldRow) && (newRow >= existingCell.row))) {
                existingCell.setRowspan(existingCell.rowspan+1);
            }
            else {
                var td = addEmptyTableCell(newTR,existingCell.element.nodeName);
                if (existingCell.colspan != 1)
                    td.setAttribute("colspan",existingCell.colspan);
            }
            col += existingCell.colspan;
        }
    }

    // public
    function insertRowAbove()
    {
        var region = Tables_getTableRegionFromRange(Selection_getSelectionRange());
        if (region != null) {
            var cell = region.structure.get(region.topRow,region.leftCol);
            var oldTR = cell.element.parentNode;
            var newTR = DOM_createElement(document,"TR");
            DOM_insertBefore(oldTR.parentNode,newTR,oldTR);
            populateNewRow(region.structure,newTR,region.topRow-1,region.topRow);
        }
    }

    // public
    function insertRowBelow()
    {
        var region = Tables_getTableRegionFromRange(Selection_getSelectionRange());
        if (region != null) {
            var cell = region.structure.get(region.bottomRow,region.leftCol);
            var oldTR = cell.element.parentNode;
            var newTR = DOM_createElement(document,"TR");
            DOM_insertBefore(oldTR.parentNode,newTR,oldTR.nextSibling);
            populateNewRow(region.structure,newTR,region.bottomRow+1,region.bottomRow);
        }
    }

    function getColElements(table)
    {
        var cols = new Array();
        for (child = table.firstChild; child != null; child = child.nextSibling) {
            if (DOM_upperName(child) == "COLGROUP") {
                for (var gc = child.firstChild; gc != null; gc = gc.nextSibling) {
                    if (DOM_upperName(gc) == "COL")
                        cols.push(gc);
                }
            }
        }
        return cols;
    }

    function getColWidths(cols,expectedCount)
    {
        // FIXME
        return defaultColValues();

        function defaultColValues()
        {
            var array = new Array();
            for (var i = 0; i < expectedCount; i++)
                array.push(100/expectedCount);
            return array;
        }
    }

    function addCol(structure,oldIndex,right)
    {
        // FIXME: this currently assumes columns are always set, and will break if they aren't
        // FIXME: modify the test cases so that each column uses a different percentage, so we
        // can test that the width adjustment logic is working correctly.
        var table = structure.element;
        var cols = getColElements(table);
        var colElements = getColElements(table);
        var colWidths = getColWidths(colElements,structure.numCols);

        var prevColElement = colElements[oldIndex];
        var prevColWidth = colWidths[oldIndex];
        var newColWidth = prevColWidth;
        var newColElement = DOM_createElement(document,"COL");
        newColElement.setAttribute("width",prevColElement.getAttribute("width"));
//        newColElement.setAttribute("new","true");
        if (right)
            DOM_insertBefore(prevColElement.parentNode,newColElement,prevColElement.nextSibling);
        else
            DOM_insertBefore(prevColElement.parentNode,newColElement,prevColElement);

        if (right) {
            colElements.splice(oldIndex+1,0,newColElement);
            colWidths.splice(oldIndex+1,0,newColWidth);
        }
        else {
            colElements.splice(oldIndex+1,0,newColElement);
            colWidths.splice(oldIndex+1,0,newColWidth);
        }

//        for (var i = 0; i < colElements.length; i++) {
//            debug("colElements["+i+"] = "+colElements[i].outerHTML);
//        }


        var colWidthTotal = 0;
        for (var i = 0; i < colWidths.length; i++)
            colWidthTotal += colWidths[i];

        for (var i = 0; i < colElements.length; i++) {
            var pct = 100*colWidths[i]/colWidthTotal;
            colElements[i].setAttribute("width",pct+"%");
        }
    }

    function addColumnCells(structure,oldIndex,right)
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
                    var newTD = createEmptyTableCell(oldTD.nodeName);
                    if (right)
                        DOM_insertBefore(cell.element.parentNode,newTD,oldTD.nextSibling);
                    else
                        DOM_insertBefore(cell.element.parentNode,newTD,oldTD);
                    if (cell.rowspan != 1)
                        newTD.setAttribute("rowspan",cell.rowspan);
                }
            }
        }
    }

    // public
    function insertColumnLeft()
    {
        var region = Tables_getTableRegionFromRange(Selection_getSelectionRange());
        if (region != null) {
            addCol(region.structure,region.leftCol,region.leftCol-1);
            addColumnCells(region.structure,region.leftCol,false);
        }
    }

    // public
    function insertColumnRight()
    {
        var region = Tables_getTableRegionFromRange(Selection_getSelectionRange());
        if (region != null) {
            addCol(region.structure,region.rightCol,region.rightCol+1);
            addColumnCells(region.structure,region.rightCol,true);
        }
    }

    // public
    function deleteRows()
    {
    }

    // public
    function deleteColumns()
    {
    }

    // public
    function clearCells()
    {
    }

    // public
    function mergeCells()
    {
        debug("mergeCells()");
        var region = Tables_getTableRegionFromRange(Selection_getSelectionRange());
        if (region == null)
            return;

        var structure = region.structure;

        // FIXME: handle the case of missing cells
        // (or even better, add cells where there are some missing)

        for (var row = region.topRow; row <= region.bottomRow; row++) {
            for (var col = region.leftCol; col <= region.rightCol; col++) {
                var cell = structure.get(row,col);
                var cellFirstRow = cell.row;
                var cellLastRow = cell.row + cell.rowspan - 1;
                var cellFirstCol = cell.col;
                var cellLastCol = cell.col + cell.colspan - 1;

                if ((cellFirstRow < region.topRow) || (cellLastRow > region.bottomRow) ||
                    (cellFirstCol < region.leftCol) || (cellLastCol > region.rightCol)) {
                    debug("Can't merge this table: cell at "+row+","+col+" goes outside bounds "+
                          "of selection");
                    return;
                }
            }
        }

        var mergedCell = structure.get(region.topRow,region.leftCol);

        for (var row = region.topRow; row <= region.bottomRow; row++) {
            for (var col = region.leftCol; col <= region.rightCol; col++) {
                var cell = structure.get(row,col);
                // parentNode will be null if we've already done this cell
                if ((cell != mergedCell) && (cell.element.parentNode != null)) {
                    while (cell.element.firstChild != null)
                        DOM_appendChild(mergedCell.element,cell.element.firstChild);

//                    DOM_deleteAllChildren(cell.element); // FIXME: temp

                    DOM_deleteNode(cell.element);
                }
            }
        }

        var totalRows = region.bottomRow - region.topRow + 1;
        var totalCols = region.rightCol - region.leftCol + 1;
        if (totalRows == 1)
            mergedCell.element.removeAttribute("rowspan");
        else
            mergedCell.element.setAttribute("rowspan",totalRows);
        if (totalCols == 1)
            mergedCell.element.removeAttribute("colspan");
        else
            mergedCell.element.setAttribute("colspan",totalCols);
    }

    // public
    function splitCell()
    {
        debug("splitCell()");
    }

    // public
    function analyseStructure(element)
    {
        return new Table(element);
    }

    // public
    function findContainingCell(node)
    {
        for (var ancestor = node; ancestor != null; ancestor = ancestor.parentNode) {
            if (isTableCell(ancestor))
                return ancestor;
        }
        return null;
    }

    // public
    function findContainingTable(node)
    {
        for (var ancestor = node; ancestor != null; ancestor = ancestor.parentNode) {
            if (isTableNode(ancestor))
                return ancestor;
        }
        return null;
    }

    function TableRegion(structure,topRow,bottomRow,leftCol,rightCol)
    {
        this.structure = structure;
        this.topRow = topRow;
        this.bottomRow = bottomRow;
        this.leftCol = leftCol;
        this.rightCol = rightCol;
    }

    // public
    function getTableRegionFromRange(range)
    {
        var region = null;

        if (range == null)
            return null;

        var start = range.start.closestActualNode(true);
        var end = range.end.closestActualNode(true);

        var startTD = Tables_findContainingCell(start);
        var endTD = Tables_findContainingCell(end);

        if (!isTableCell(start) || !isTableCell(end)) {
            if (startTD == endTD) // not in cell, or both in same cell
                return null;
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

        var topRow = (startInfo.row < endInfo.row) ? startInfo.row : endInfo.row;
        var bottomRow = (startInfo.row > endInfo.row) ? startInfo.row : endInfo.row;
        var leftCol = (startInfo.col < endInfo.col) ? startInfo.col : endInfo.col;
        var rightCol = (startInfo.col > endInfo.col) ? startInfo.col : endInfo.col;
        return new TableRegion(structure,topRow,bottomRow,leftCol,rightCol);
    }

    Tables_insertTable = trace(insertTable);
    Tables_insertRowAbove = trace(insertRowAbove);
    Tables_insertRowBelow = trace(insertRowBelow);
    Tables_insertColumnLeft = trace(insertColumnLeft);
    Tables_insertColumnRight = trace(insertColumnRight);
    Tables_deleteRows = trace(deleteRows);
    Tables_deleteColumns = trace(deleteColumns);
    Tables_clearCells = trace(clearCells);
    Tables_mergeCells = trace(mergeCells);
    Tables_splitCell = trace(splitCell);
    Tables_analyseStructure = trace(analyseStructure);
    Tables_findContainingCell = trace(findContainingCell);
    Tables_findContainingTable = trace(findContainingTable);
    Tables_getTableRegionFromRange = trace(getTableRegionFromRange);

})();
