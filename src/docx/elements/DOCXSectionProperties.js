function DOCXSectionProperties(element)
{
    // Defaults that word uses (A4)
    this.pageWidth = 11900; // 210 mm
    this.pageHeight = 16840; // 297 mm
    this.marginLeft = 1800; // 1.25 in
    this.marginRight = 1800; // 1.25 in
    this.marginTop = 1440; // 1 in
    this.marginBottom = 1440; // 1 in
    this.header = 708; // 1.25 cm
    this.footer = 708; // 1.25 cm
    this.gutter = 0;

    if (element != null) {

        for (var child = element.firstChild; child != null; child = child.nextSibling) {
            if (child.namespaceURI == WORD_NAMESPACE) {
                if (child.localName == "pgSz") {
                    if (child.hasAttributeNS(WORD_NAMESPACE,"w"))
                        this.pageWidth = parseInt(child.getAttributeNS(WORD_NAMESPACE,"w"));
                    if (child.hasAttributeNS(WORD_NAMESPACE,"h"))
                        this.pageHeight = parseInt(child.getAttributeNS(WORD_NAMESPACE,"h"));
                }
                else if (child.localName == "pgMar") {
                    if (child.hasAttributeNS(WORD_NAMESPACE,"left"))
                        this.marginLeft = parseInt(child.getAttributeNS(WORD_NAMESPACE,"left"));
                    if (child.hasAttributeNS(WORD_NAMESPACE,"right"))
                        this.marginRight = parseInt(child.getAttributeNS(WORD_NAMESPACE,"right"));
                    if (child.hasAttributeNS(WORD_NAMESPACE,"top"))
                        this.marginTop = parseInt(child.getAttributeNS(WORD_NAMESPACE,"top"));
                    if (child.hasAttributeNS(WORD_NAMESPACE,"bottom"))
                        this.marginBottom = parseInt(child.getAttributeNS(WORD_NAMESPACE,"bottom"));
                    if (child.hasAttributeNS(WORD_NAMESPACE,"header"))
                        this.header = parseInt(child.getAttributeNS(WORD_NAMESPACE,"header"));
                    if (child.hasAttributeNS(WORD_NAMESPACE,"footer"))
                        this.footer = parseInt(child.getAttributeNS(WORD_NAMESPACE,"footer"));
                    if (child.hasAttributeNS(WORD_NAMESPACE,"gutter"))
                        this.gutter = parseInt(child.getAttributeNS(WORD_NAMESPACE,"gutter"));
                }
            }
        }
    }

    this.contentWidth = this.pageWidth - this.marginLeft - this.marginRight;
    this.contentHeight = this.pageHeight - this.marginTop - this.marginBottom;

    // Make sure these are at least 1, since they are used in divisions
    this.pageWidth = max(1,this.pageWidth);
    this.pageHeight = max(1,this.pageHeight);
    this.contentWidth = max(1,this.contentWidth);
    this.contentHeight = max(1,this.contentHeight);

    function max(a,b)
    {
        return (a > b) ? a : b;
    }
}
