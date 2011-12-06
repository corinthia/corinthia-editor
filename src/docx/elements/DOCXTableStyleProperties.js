// Represents a tblStylePr
function DOCXTableStyleProperties(element)
{
    this.pPr = null;
    this.rPr = null;
    this.tcPr = null;

    for (var child = element.firstChild; child != null; child = child.nextSibling) {
        if (child.namespaceURI == WORD_NAMESPACE) {
            if (child.localName == "pPr")
                this.pPr = new DOCXParagraphProperties(child);
            else if (child.localName == "rPr")
                this.rPr = new DOCXRunProperties(child);
            else if (child.localName == "tcPr")
                this.tcPr = new DOCXCellProperties(child);
        }
    }
}

DOCXTableStyleProperties.prototype.applyCSSProperties = function(cssProperties)
{
    if (this.pPr != null)
        this.pPr.applyCSSProperties(cssProperties);
    if (this.rPr != null)
        this.rPr.applyCSSProperties(cssProperties);
    if (this.tcPr != null)
        this.tcPr.applyCSSProperties(cssProperties);
}

DOCXTableStyleProperties.prototype.applyCellCSSProperties = function(cssProperties)
{
    if (this.tcPr != null)
        this.tcPr.applyCSSProperties(cssProperties);
}
