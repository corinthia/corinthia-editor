(function() {

    function insertTable(rows,cols)
    {
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
