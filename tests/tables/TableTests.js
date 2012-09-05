function showSelectedTableRegion()
{
    var region = Tables_regionFromRange(Selection_get());
    for (var row = region.top; row <= region.bottom; row++) {
        for (var col = region.left; col <= region.right; col++) {
            var cell = Table_get(region.structure,row,col);
            DOM_setStyleProperties(cell.element,{"background-color": "silver"});
        }
    }
}

function getSelectedTableRegion()
{
    return Tables_regionFromRange(Selection_get());
}

function showTableStructure()
{
    var tableElement = document.getElementsByTagName("TABLE")[0];
    var table = Tables_analyseStructure(tableElement);
    var lines = new Array();
    lines.push(PrettyPrinter.getHTML(document.documentElement));

    for (var row = 0; row < table.numRows; row++) {
        for (var col = 0; col < table.numCols; col++) {
            var cell = Table_get(table,row,col);
            if (cell == null) {
                lines.push("Cell at ("+row+","+col+") = "+null);
            }
            else {
                lines.push("Cell at ("+row+","+col+") = "+
                           cell.rowspan+"x"+cell.colspan+" "+
                           JSON.stringify(getNodeText(cell.element)));
            }
        }
    }

    return lines.join("\n");
}
