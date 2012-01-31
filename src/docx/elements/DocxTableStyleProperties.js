// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

// Represents a tblStylePr
function DocxTableStyleProperties(element)
{
    this.pPr = null;
    this.rPr = null;
    this.tcPr = null;

    for (var child = element.firstChild; child != null; child = child.nextSibling) {
        if (child.namespaceURI == WORD_NAMESPACE) {
            if (child.localName == "pPr")
                this.pPr = new DocxParagraphProperties(child);
            else if (child.localName == "rPr")
                this.rPr = new DocxRunProperties(child);
            else if (child.localName == "tcPr")
                this.tcPr = new DocxCellProperties(child);
        }
    }
}

DocxTableStyleProperties.prototype.applyCSSProperties = function(cssProperties)
{
    if (this.pPr != null)
        this.pPr.applyCSSProperties(cssProperties);
    if (this.rPr != null)
        this.rPr.applyCSSProperties(cssProperties);
    if (this.tcPr != null)
        this.tcPr.applyCSSProperties(cssProperties);
}

DocxTableStyleProperties.prototype.applyCellCSSProperties = function(cssProperties)
{
    if (this.tcPr != null)
        this.tcPr.applyCSSProperties(cssProperties);
}
