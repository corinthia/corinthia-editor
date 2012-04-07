(function() {

    function insertTable(rows,cols,numbered,caption)
    {
        var table = DOM.createElement(document,"TABLE");

        // Probably the most sensible defaults for now
        table.setAttribute("border","1");
        table.setAttribute("width","100%");

        // Caption comes first
        if ((caption != null) && (caption != "")) {
            var tableCaption = DOM.createElement(document,"CAPTION");
            tableCaption.appendChild(DOM.createTextNode(document,caption));
            DOM.appendChild(table,tableCaption);
        }

        // Then the rows and columns
        for (var r = 0; r < rows; r++) {
            var tr = DOM.createElement(document,"TR");
            DOM.appendChild(table,tr);
            for (var c = 0; c < cols; c++) {
                var td = DOM.createElement(document,"TD");
                var p = DOM.createElement(document,"P");
                var br = DOM.createElement(document,"BR");
                DOM.appendChild(tr,td);
                DOM.appendChild(td,p);
                DOM.appendChild(p,br);
            }
        }

        Clipboard.pasteNodes([table]);
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

    window.Tables = new (function Tables(){});
    Tables.insertTable = trace(insertTable);
    Tables.insertRowsAbove = trace(insertRowsAbove);
    Tables.insertRowsBelow = trace(insertRowsBelow);
    Tables.insertColumnsLeft = trace(insertColumnsLeft);
    Tables.insertColumnsRight = trace(insertColumnsRight);
    Tables.deleteRows = trace(deleteRows);
    Tables.deleteColumns = trace(deleteColumns);
    Tables.clearCells = trace(clearCells);
    Tables.mergeCells = trace(mergeCells);
    Tables.splitCell = trace(splitCell);

})();
