// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

// FIXME: make this a property of DocxTableProperties
var DocxTablePropertiesId = 0;

// Represents a tblPr child of a tbl element
function DocxTableProperties(element)
{
    this.id = DocxTablePropertiesId++;
    this.bidiVisual = null;
    this.jc = null;
    this.shd = null;
    this.tblBorders = null;
    this.tblCaption = null;
    this.tblCellMar = null;
    this.tblCellSpacing = null;
    this.tblDescription = null;
    this.tblInd = null;
    this.tblLayout = null;
    this.tblLook = null;
    this.tblOverlap = null;
    this.tblpPr = null;
    this.tblPrChange = null;
    this.tblStyle = null;
    this.tblStyleColBandSize = null;
    this.tblStyleRowBandSize = null;
    this.tblW = null;

    for (var child = element.firstChild; child != null; child = child.nextSibling) {
        if (child.namespaceURI == WORD_NAMESPACE) {
            if (child.localName == "bidiVisual")
                this.bidiVisual = null;
            else if (child.localName == "jc")
                this.jc = null;
            else if (child.localName == "shd")
                this.shd = null;
            else if (child.localName == "tblBorders")
                this.tblBorders = new DocxBorderProperties(child);
            else if (child.localName == "tblCaption")
                this.tblCaption = null;
            else if (child.localName == "tblCellMar")
                this.tblCellMar = null;
            else if (child.localName == "tblCellSpacing")
                this.tblCellSpacing = null;
            else if (child.localName == "tblDescription")
                this.tblDescription = null;
            else if (child.localName == "tblInd")
                this.tblInd = null;
            else if (child.localName == "tblLayout")
                this.tblLayout = null;
            else if (child.localName == "tblLook")
                this.tblLook = new DocxTableLook(child);
            else if (child.localName == "tblOverlap")
                this.tblOverlap = null;
            else if (child.localName == "tblpPr")
                this.tblpPr = null;
            else if (child.localName == "tblPrChange")
                this.tblPrChange = null;
            else if (child.localName == "tblStyle")
                this.tblStyle = child.getAttributeNS(WORD_NAMESPACE,"val");
            else if (child.localName == "tblStyleColBandSize")
                this.tblStyleColBandSize = null;
            else if (child.localName == "tblStyleRowBandSize")
                this.tblStyleRowBandSize = null;
            else if (child.localName == "tblW")
                this.tblW = new DocxTableWidth(child);
        }
    }
}

DocxTableProperties.prototype.print = function(indent)
{
    if (this.tblBorders != null)
        this.tblBorders.print(indent);
}

DocxTableProperties.prototype.applyCSSProperties = function(cssProperties)
{
    if (this.tblBorders != null)
        this.tblBorders.applyCSSProperties(cssProperties);
}
