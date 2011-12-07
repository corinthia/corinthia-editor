// Represents a tblW child of a tblPr element, or a tcW child of a tcPr element
function DocxTableWidth(element)
{
    this.w = parseInt(element.getAttributeNS(WORD_NAMESPACE,"w"));
    this.type = element.getAttributeNS(WORD_NAMESPACE,"type");
}
