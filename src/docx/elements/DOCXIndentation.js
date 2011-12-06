// ind element
function DOCXIndentation(element)
{
    // Both the ECMA and ISO versions of the OOXML spec say that ind has "start" and "end"
    // attributes, but word 2011 uses "left" and "right"

    // Units: twentieths of a point
    if (element.hasAttributeNS(WORD_NAMESPACE,"left"))
        this.left = parseInt(element.getAttributeNS(WORD_NAMESPACE,"left"));
    else if (element.hasAttributeNS(WORD_NAMESPACE,"start"))
        this.left = parseInt(element.getAttributeNS(WORD_NAMESPACE,"start"));
    else
        this.left = null;

    if (element.hasAttributeNS(WORD_NAMESPACE,"right"))
        this.right = parseInt(element.getAttributeNS(WORD_NAMESPACE,"right"));
    else if (element.hasAttributeNS(WORD_NAMESPACE,"end"))
        this.right = parseInt(element.getAttributeNS(WORD_NAMESPACE,"end"));
    else
        this.right = null;

    if (element.hasAttributeNS(WORD_NAMESPACE,"firstLine"))
        this.firstLine = parseInt(element.getAttributeNS(WORD_NAMESPACE,"firstLine"));
    else
        this.firstLine = null;
}

DOCXIndentation.prototype.applyCSSProperties = function(cssProperties)
{
    if (this.left != null)
        cssProperties["margin-left"] = this.left/20 + "pt";
    if (this.right != null)
        cssProperties["margin-right"] = this.right/20 + "pt";
    if (this.firstLine != null)
        cssProperties["text-indent"] = this.firstLine/20 + "pt";
}
