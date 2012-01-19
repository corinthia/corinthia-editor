// Copyright (c) 2011-2012 UX Productivity. All rights reserved.

// Represents a tblGrid child of a tbl element
function DocxTableGrid(element)
{
    this.cols = new Array(); // contains numbers, units: twentieths of a point
    for (var child = element.firstChild; child != null; child = child.nextSibling) {
        if (DocxUtil.isWordElement(child,"gridCol") && child.hasAttributeNS(WORD_NAMESPACE,"w")) {
            this.cols.push(parseInt(child.getAttributeNS(WORD_NAMESPACE,"w")));
        }
    }
}
