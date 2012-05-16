function showTableRegion(region)
{
    for (var row = region.top; row <= region.bottom; row++) {
        for (var col = region.left; col <= region.right; col++) {
            var cell = region.structure.get(row,col);
            DOM_setStyleProperties(cell.element,{"background-color": "silver"});
        }
    }
}
