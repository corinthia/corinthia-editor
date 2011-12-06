// Represents a tcPr child of a tc element
function DOCXCellProperties(element)
{
    this.cellDel = null; // Table Cell Deletion
    this.cellIns = null; // Table Cell Insertion
    this.cellMerge = null; // Vertically Merged/Split Table Cells
    this.cnfStyle = null; // Table Cell Conditional Formatting
    this.gridSpan = null; // Grid Columns Spanned by Current Table Cell
    this.headers = null; // Header Cells Associated With Table Cell
    this.hideMark = null; // Ignore End Of Cell Marker In Row Height Calculation
    this.hMerge = null; // Horizontally Merged Cell
    this.noWrap = null; // Don't Wrap Cell Content
    this.shd = null; // Table Cell Shading
    this.tcBorders = null; // Table Cell Borders
    this.tcFitText = null; // Fit Text Within Cell
    this.tcMar = null; // Single Table Cell Margins
    this.tcPrChange = null; // Revision Information for Table Cell Properties
    this.tcW = null; // Preferred Table Cell Width
    this.textDirection = null; // Table Cell Text Flow Direction
    this.vAlign = null; // Table Cell Vertical Alignment
    this.vMerge = null; // Vertically Merged Cell

    for (var child = element.firstChild; child != null; child = child.nextSibling) {
        if (child.namespaceURI == WORD_NAMESPACE) {
            if (child.localName == "cellDel")
                this.cellDel = null;
            else if (child.localName == "cellIns")
                this.cellIns = null;
            else if (child.localName == "cellMerge")
                this.cellMerge = null;
            else if (child.localName == "cnfStyle")
                this.cnfStyle = null;
            else if (child.localName == "gridSpan")
                this.gridSpan = parseInt(child.getAttributeNS(WORD_NAMESPACE,"val"));
            else if (child.localName == "headers")
                this.headers = null;
            else if (child.localName == "hideMark")
                this.hideMark = null;
            else if (child.localName == "hMerge")
                this.hMerge = null;
            else if (child.localName == "noWrap")
                this.noWrap = null;
            else if (child.localName == "shd")
                this.shd = child.getAttributeNS(WORD_NAMESPACE,"fill");
            else if (child.localName == "tcBorders")
                this.tcBorders = new DOCXBorderProperties(child);
            else if (child.localName == "tcFitText")
                this.tcFitText = null;
            else if (child.localName == "tcMar")
                this.tcMar = null;
            else if (child.localName == "tcPrChange")
                this.tcPrChange = null;
            else if (child.localName == "tcW")
                this.tcW = new DOCXTableWidth(child);
            else if (child.localName == "textDirection")
                this.textDirection = null;
            else if (child.localName == "vAlign")
                this.vAlign = child.getAttributeNS(WORD_NAMESPACE,"val");
            else if (child.localName == "vMerge") {
                if (child.getAttributeNS(WORD_NAMESPACE,"val") == "restart")
                    this.vMerge = "restart";
                else
                    this.vMerge = "continue";
            }
        }
    }
}

DOCXCellProperties.prototype.applyCSSProperties = function(cssProperties)
{
    if ((this.shd != null) && (this.shd != "auto"))
        cssProperties["background-color"] = DOCXUtil.htmlColor(this.shd);
    if (this.tcBorders != null)
        this.tcBorders.applyCSSProperties(cssProperties);
    if (this.vAlign == "top")
        cssProperties["vertical-align"] = "top";
    else if (this.vAlign == "center")
        cssProperties["vertical-align"] = "middle";
    else if (this.vAlign == "bottom")
        cssProperties["vertical-align"] = "bottom";
}
