// Represents an abstractNum chlid of a numbering element
function DocxAbstractNum(element)
{
    this.levels = new Array();

    var abstractNumId = element.getAttributeNS(WORD_NAMESPACE,"abstractNumId");
    for (var child = element.firstChild; child != null; child = child.nextSibling) {
        if (DocxUtil.isWordElement(child,"lvl")) {
            var ilvl = child.getAttributeNS(WORD_NAMESPACE,"ilvl");
            if (ilvl == null) {
                warning("lvl element has no ilvl attribute");
                continue;
            }
            this.levels[ilvl] = new DocxLevel(abstractNumId,child);
        }
    }
}
