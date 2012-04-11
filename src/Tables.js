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

(function() {

    function insertTable(rows,cols,numbered,caption)
    {
        var table = DOM_createElement(document,"TABLE");

        // Probably the most sensible defaults for now
        table.setAttribute("border","1");
        table.setAttribute("width","100%");

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
    }

    function insertRowsAbove(rows)
    {
    }

    function insertRowsBelow(rows)
    {
    }

    function insertColumnsLeft(cols)
    {
    }

    function insertColumnsRight(cols)
    {
    }

    function deleteRows()
    {
    }

    function deleteColumns()
    {
    }

    function clearCells()
    {
    }

    function mergeCells()
    {
    }

    function splitCell()
    {
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

})();
