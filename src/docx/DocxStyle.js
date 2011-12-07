function DocxStyle(styleId,element)
{
    this.styleId = styleId;
    this.computedCascade = false;
    this.parent = null;
    this.newProperties = null;

    this.name = null;
    this.basedOn = null;
    this.paragraphProperties = null;
    this.runProperties = null;
    this.tableProperties = null;
    this.cellProperties = null;
    this.tableStyleProperties = new Object();
    this.type = null;

    if (element.hasAttributeNS(WORD_NAMESPACE,"type"))
        this.type = element.getAttributeNS(WORD_NAMESPACE,"type");

    for (var child = element.firstChild; child != null; child = child.nextSibling) {
        if (child.namespaceURI == WORD_NAMESPACE) {
            if (child.localName == "name")
                this.name = child.getAttributeNS(WORD_NAMESPACE,"val");
            else if (child.localName == "basedOn")
                this.basedOn = child.getAttributeNS(WORD_NAMESPACE,"val");
            else if (child.localName == "pPr")
                this.paragraphProperties = new DocxParagraphProperties(child);
            else if (child.localName == "rPr")
                this.runProperties = new DocxRunProperties(child);
            else if (child.localName == "tblPr")
                this.tableProperties = new DocxTableProperties(child);
            else if (child.localName == "tcPr")
                this.cellProperties = new DocxCellProperties(child);
            else if (child.localName == "tblStylePr") {
                var type = child.getAttributeNS(WORD_NAMESPACE,"type");
                this.tableStyleProperties[type] = new DocxTableStyleProperties(child);
            }
        }
    }
}

DocxStyle.prototype.print = function(indent)
{
    if (this.name != null)
        debug(indent+"Name: "+this.name);
    if (this.basedOn != null)
        debug(indent+"Based on: "+this.basedOn);
    if (this.paragraphProperties != null) {
        debug(indent+"Paragraph properties:");
        this.paragraphProperties.print(indent+"    ");
    }
    if (this.runProperties != null) {
        debug(indent+"Run properties:");
        this.runProperties.print(indent+"    ");
    }
    if (this.tableProperties != null) {
        debug(indent+"Table properties:");
        this.tableProperties.print(indent+"    ");
    }
}

DocxStyle.prototype.applyCSSProperties = function(cssProperties)
{
    if (this.parent != null)
        this.parent.applyCSSProperties(cssProperties);
    if (this.paragraphProperties != null)
        this.paragraphProperties.applyCSSProperties(cssProperties);
    if (this.runProperties != null)
        this.runProperties.applyCSSProperties(cssProperties);
    if (this.tableProperties != null)
        this.tableProperties.applyCSSProperties(cssProperties);
    if (this.cellProperties != null)
        this.cellProperties.applyCSSProperties(cssProperties);
}

DocxStyle.prototype.applyTableStyleCSSProperties = function(type,cssProperties)
{
    if (this.parent != null)
        this.parent.applyTableStyleCSSProperties(type,cssProperties);
    if (this.tableStyleProperties[type] != null)
        this.tableStyleProperties[type].applyCSSProperties(cssProperties);
}

DocxStyle.prototype.computeCascadedProperties = function(styleCollection,indent)
{
    if (this.computedCascade)
        return;
    this.computedCascade = true;

    if (this.basedOn != null) {
        this.parent = styleCollection.styles[this.basedOn];
        if (this.parent == null)
            warning("Style "+this.styleId+" has non-existant parent "+this.basedOn);
        this.parent.computeCascadedProperties(styleCollection,indent+"    ");
    }

    if (this.parent != null) {
    }
}

DocxStyle.prototype.hasTableStyleType = function(type)
{
    if (this.tableStyleProperties[type] != null)
        return true;

    if (this.parent != null)
        return this.parent.hasTableStyleType(type);
    else
        return null;
}
