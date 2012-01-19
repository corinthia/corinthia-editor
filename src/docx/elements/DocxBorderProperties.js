// Copyright (c) 2011-2012 UX Productivity. All rights reserved.

// pBdr, tblBorders, and tcBorders
function DocxBorderProperties(element)
{
    this.left = null;
    this.right = null;
    this.top = null;
    this.bottom = null;
    this.bar = null; // pBdr only
    this.between = null; // pBdr only
    this.insideH = null; // tblBorders only
    this.insideV = null; // tblBorders only

    for (var child = element.firstChild; child != null; child = child.nextSibling) {
        if (child.namespaceURI == WORD_NAMESPACE) {
            // Note: the spec mentions "start" and "end" elements, but word actually uses
            // left and right elements.
            if ((child.localName == "left") || (child.localName == "start"))
                this.left = new DocxIndividualBorder(child,"border-left");
            else if ((child.localName == "right") || (child.localName == "end"))
                this.right = new DocxIndividualBorder(child,"border-right");
            else if (child.localName == "top")
                this.top = new DocxIndividualBorder(child,"border-top");
            else if (child.localName == "bottom")
                this.bottom = new DocxIndividualBorder(child,"border-bottom");
            else if (child.localName == "bar")
                this.bar = new DocxIndividualBorder(child,null);
            else if (child.localName == "between")
                this.between = new DocxIndividualBorder(child,null);
            else if (child.localName == "insideH")
                this.insideH = new DocxIndividualBorder(child,"word-insideH");
            else if (child.localName == "insideV")
                this.insideV = new DocxIndividualBorder(child,"word-insideV");
        }
    }
}

DocxBorderProperties.prototype.applyCSSProperties = function(cssProperties)
{
    if (this.left != null)
        this.left.applyCSSProperties(cssProperties);
    if (this.right != null)
        this.right.applyCSSProperties(cssProperties);
    if (this.top != null)
        this.top.applyCSSProperties(cssProperties);
    if (this.bottom != null)
        this.bottom.applyCSSProperties(cssProperties);

    if (this.insideH != null)
        this.insideH.applyCSSProperties(cssProperties);
    if (this.insideV != null)
        this.insideV.applyCSSProperties(cssProperties);
}

DocxBorderProperties.prototype.print = function(indent)
{
    if (this.left != null) {
        debug(indent+"Left border:");
        this.left.print(indent+"    ");
    }
    if (this.right != null) {
        debug(indent+"Right border:");
        this.right.print(indent+"    ");
    }
    if (this.top != null) {
        debug(indent+"Top border:");
        this.top.print(indent+"    ");
    }
    if (this.bottom != null) {
        debug(indent+"Bottom border:");
        this.bottom.print(indent+"    ");
    }
}
