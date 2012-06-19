function showSelectedTableRegion()
{
    var region = Tables_regionFromRange(Selection_get());
    for (var row = region.top; row <= region.bottom; row++) {
        for (var col = region.left; col <= region.right; col++) {
            var cell = region.structure.get(row,col);
            DOM_setStyleProperties(cell.element,{"background-color": "silver"});
        }
    }
}

function getSelectedTableRegion()
{
    return Tables_regionFromRange(Selection_get());
}
