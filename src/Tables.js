// Copyright (c) 2012 UX Productivity Pty Ltd. All rights reserved.

var Tables_insertTable;
var Tables_insertRowsAbove;
var Tables_insertRowsBelow;
var Tables_insertColumnsLeft;
var Tables_insertColumnsRight;
var Tables_deleteRows;
var Tables_deleteColumns;
var Tables_clearCells;
var Tables_mergeCells;
var Tables_splitCell;
var Tables_analyseStructure;
var Tables_findContainingCell;
var Tables_findContainingTable;

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

    function Table(element)
    {
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
        debug("insertTable: width = "+width);
        var table = DOM_createElement(document,"TABLE");

        // Probably the most sensible defaults for now
        table.setAttribute("border","1");
//        table.setAttribute("width","100%");
        if (width != null) {
            table.style.width = width;
        }

        // Caption comes first
        if ((caption != null) && (caption != "")) {
            var tableCaption = DOM_createElement(document,"CAPTION");
            tableCaption.appendChild(DOM_createTextNode(document,caption));
            DOM_appendChild(table,tableCaption);
        }

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
            }
        }

        Clipboard_pasteNodes([table]);

        // If, as a result of inserting the table, the cursor is now placed immediately to
        // the right of it, move the cursor forward to the start of the next paragraph
        var selectionRange = Selection_getSelectionRange();
        var pos = selectionRange.start;
        if ((pos.node.nodeType == Node.ELEMENT_NODE) &&
            (pos.node.childNodes[pos.offset-1] == table)) {
            Cursor_moveRight(); // go to the start of the next paragraph
        }
    }

    // public
    function insertRowsAbove(rows)
    {
    }

    // public
    function insertRowsBelow(rows)
    {
    }

    // public
    function insertColumnsLeft(cols)
    {
    }

    // public
    function insertColumnsRight(cols)
    {
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
    }

    // public
    function splitCell()
    {
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

    Tables_insertTable = trace(insertTable);
    Tables_insertRowsAbove = trace(insertRowsAbove);
    Tables_insertRowsBelow = trace(insertRowsBelow);
    Tables_insertColumnsLeft = trace(insertColumnsLeft);
    Tables_insertColumnsRight = trace(insertColumnsRight);
    Tables_deleteRows = trace(deleteRows);
    Tables_deleteColumns = trace(deleteColumns);
    Tables_clearCells = trace(clearCells);
    Tables_mergeCells = trace(mergeCells);
    Tables_splitCell = trace(splitCell);
    Tables_analyseStructure = trace(analyseStructure);
    Tables_findContainingCell = trace(findContainingCell);
    Tables_findContainingTable = trace(findContainingTable);

})();
