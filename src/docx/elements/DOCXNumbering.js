// http://msdn.microsoft.com/en-us/library/ee922775.aspx

// Represents a numbering element at the root of numbering.xml, if present
function DOCXNumbering(element)
{
    this.nums = new Array();
    if (DOCXUtil.isWordElement(element,"numbering")) {

        // Find all the abstractNum elements
        var abstractNums = new Array();
        for (var child = element.firstChild; child != null; child = child.nextSibling) {
            if (DOCXUtil.isWordElement(child,"abstractNum")) {
                var abstractNumId = child.getAttributeNS(WORD_NAMESPACE,"abstractNumId");
                if (abstractNumId == null) {
                    warning("abstractNum element has no abstractNumId attribute");
                    continue;
                }
                abstractNums[abstractNumId] = new DOCXAbstractNum(child);
            }
        }

        // Find all the num elements
        for (var child = element.firstChild; child != null; child = child.nextSibling) {
            if (DOCXUtil.isWordElement(child,"num")) {
                var numId = child.getAttributeNS(WORD_NAMESPACE,"numId");
                if (numId == null) {
                    warning("num element has no numId attribute");
                    continue;
                }
                var abstractNumId = childVal(child,WORD_NAMESPACE,"abstractNumId");
                if (abstractNumId == null) {
                    warning("num element has no abstractNumId");
                    continue;
                }
                var abstractNum = abstractNums[abstractNumId];
                if (abstractNum == null) {
                    warning("Cannot find abstractNum with id "+abstractNumId);
                    continue;
                }
                this.nums[numId] = abstractNum;
            }
        }

        // FIXME: remove all use of this
        function childVal(node,namespaceURI,localName)
        {
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                if ((child.namespaceURI == namespaceURI) && (child.localName == localName)) {
                    return child.getAttributeNS(namespaceURI,"val");
                }
            }
            return null;
        }
    }
}
