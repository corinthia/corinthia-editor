// pPr element
function DOCXParagraphProperties(element)
{
    this.framePtr = null; // Text frame properties
    this.ind = null; // Paragraph indentation
    this.jc = null; // Paragraph alignment
    this.numPr = null; // Numbering definition instance reference
    this.outlineLvl = null; // outline level
    this.pBdr = null; // Paragraph borders
    this.pStyle = null; // Referenced paragraph style
    this.rPr = null; // Run properties for the paragraph mark
    this.srctPr = null; // Section properties
    this.shd = null; // Paragraph shading
    this.spacing = null; // Spacing between lines and above/below paragraph
    this.textAlignment = null; // Vertical character alignment on line

    for (var child = element.firstChild; child != null; child = child.nextSibling) {
        if (child.namespaceURI == WORD_NAMESPACE) {
            if (child.localName == "framePtr")
                this.framePtr = null;
            else if (child.localName == "ind")
                this.ind = new DOCXIndentation(child);
            else if (child.localName == "jc")
                this.jc = child.getAttributeNS(WORD_NAMESPACE,"val");
            else if (child.localName == "numPr") {
                var numPr = new DOCXNumPr(child);
                if (numPr.ilvl == null) {
                    warning("numPr element contains no ilvl child");
                    continue;
                }
                if (numPr.numId == null) {
                    warning("numPr element contains no numId child");
                    continue;
                }
                if ((word == null) || (DOCXDocument.instance.numbering == null)) {
                    continue;
                }
                if (DOCXDocument.instance.numbering[numPr.numId] == null) {
                    warning("no such numbering style "+numPr.numId);
                    continue;
                }
                if (DOCXDocument.instance.numbering[numPr.numId].levels[numPr.ilvl] == null) {
                    warning("no level "+numPr.ilvl+" for numbering style "+numPr.numId);
                    continue;
                }
                this.numPr = DOCXDocument.instance.numbering[numPr.numId].levels[numPr.ilvl];
            }
            else if (child.localName == "outlineLvl")
                this.outlineLvl = child.getAttributeNS(WORD_NAMESPACE,"outlineLvl");
            else if (child.localName == "pBdr") {
                this.pBdr = new DOCXBorderProperties(child);
            }
            else if (child.localName == "pStyle")
                this.pStyle = child.getAttributeNS(WORD_NAMESPACE,"val");
            else if (child.localName == "rPr")
                this.rPr = null;
            else if (child.localName == "sectpr")
                this.sectPr = null;
            else if (child.localName == "shd")
                this.shd = child.getAttributeNS(WORD_NAMESPACE,"fill");
            else if (child.localName == "spacing")
                this.spacing = new DOCXSpacing(child);
            else if (child.localName == "textAlignment")
                this.textAlignment = null;
        }
    }
}

DOCXParagraphProperties.prototype.applyCSSProperties = function(cssProperties)
{
    if (this.pBdr != null)
        this.pBdr.applyCSSProperties(cssProperties);
    if (this.jc != null) {
        if (this.jc == "left")
            cssProperties["text-align"] = "left";
        else if (this.jc == "right")
            cssProperties["text-align"] = "right";
        else if (this.jc == "center")
            cssProperties["text-align"] = "center";
        else
            cssProperties["text-align"] = "justify";
    }
    if (this.jc == "left")
        cssProperties["text-align"] = "left";
    if ((this.shd != null) && (this.shd != "auto"))
        cssProperties["background-color"] = DOCXUtil.htmlColor(this.shd);
    if (this.ind != null)
        this.ind.applyCSSProperties(cssProperties);
    if (this.spacing != null)
        this.spacing.applyCSSProperties(cssProperties);
}

DOCXParagraphProperties.prototype.print = function(indent)
{
    if (this.framePtr != null) {}
    if (this.ind != null) {}
    if (this.jc != null) {}
    if (this.numPtr != null) {}
    if (this.outlineLvl != null) {}
    if (this.pBdr != null)
        this.pBdr.print(indent);
    if (this.pStyle != null)
        debug(indent+"Style: "+this.pStyle);
    if (this.rPr != null) {}
    if (this.srctPr != null) {}
    if (this.shd != null) {}
    if (this.spacing != null) {}
    if (this.textAlignment != null) {}
}
