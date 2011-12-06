// Represents a tblGrid child of a tbl element
function DOCXTableGrid(element)
{
    this.cols = new Array(); // contains numbers, units: twentieths of a point
    for (var child = element.firstChild; child != null; child = child.nextSibling) {
        if (isWordElement(child,"gridCol") && child.hasAttributeNS(WORD_NAMESPACE,"w")) {
            this.cols.push(parseInt(child.getAttributeNS(WORD_NAMESPACE,"w")));
        }
    }
}
