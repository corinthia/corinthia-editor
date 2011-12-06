// pBdr, tblBorders, and tcBorders
function DOCXBorderProperties(element)
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
                this.left = new DOCXIndividualBorder(child,"border-left");
            else if ((child.localName == "right") || (child.localName == "end"))
                this.right = new DOCXIndividualBorder(child,"border-right");
            else if (child.localName == "top")
                this.top = new DOCXIndividualBorder(child,"border-top");
            else if (child.localName == "bottom")
                this.bottom = new DOCXIndividualBorder(child,"border-bottom");
            else if (child.localName == "bar")
                this.bar = new DOCXIndividualBorder(child,null);
            else if (child.localName == "between")
                this.between = new DOCXIndividualBorder(child,null);
            else if (child.localName == "insideH")
                this.insideH = new DOCXIndividualBorder(child,"word-insideH");
            else if (child.localName == "insideV")
                this.insideV = new DOCXIndividualBorder(child,"word-insideV");
        }
    }
}

DOCXBorderProperties.prototype.applyCSSProperties = function(cssProperties)
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

DOCXBorderProperties.prototype.print = function(indent)
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
