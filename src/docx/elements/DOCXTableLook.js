// Represents a tblLook child of a tblPr element

/*
This is one of the places where some versions of word don't actually follow the spec. According
to the OOXML specification, this element is supposed to have the following attributes, each of
which are boolean values (either true/on/1 or false/off/0). However, word 2007 doesn't set these;
it simply sets a "val" attribute with a bitfield stored as a hex number, the flags of which are
not documented in the spec. Word 2008 stores the bitfield too, but also sets the attributes.
So we turn on the various options if either the appropriate bit or attribute is set.
*/

function DOCXTableLook(element)
{
    this.firstRow = false;
    this.lastRow = false;
    this.firstColumn = false;
    this.lastColumn = false;
    this.noHBand = false;
    this.noVBand = false;

    if (element.hasAttributeNS(WORD_NAMESPACE,"val")) {
        var FIRST_ROW    = 0x0020;
        var LAST_ROW     = 0x0040;
        var FIRST_COLUMN = 0x0080;
        var LAST_COLUMN  = 0x0100;
        var NO_HBAND     = 0x0200;
        var NO_VBAND     = 0x0400;

        var val = parseInt(element.getAttributeNS(WORD_NAMESPACE,"val"),16);
        if (val & FIRST_ROW)
            this.firstRow = true;
        if (val & LAST_ROW)
            this.lastRow = true;
        if (val & FIRST_COLUMN)
            this.firstColumn = true;
        if (val & LAST_COLUMN)
            this.lastColumn = true;
        if (val & NO_HBAND)
            this.noHBand = true;
        if (val & NO_VBAND)
            this.noVBand = true;
    }

    if (element.hasAttributeNS(WORD_NAMESPACE,"firstRow")) {
        var str = element.getAttributeNS(WORD_NAMESPACE,"firstRow");
        this.firstRow = ((str == "true") || (str == "on") || (str == "1"));
    }

    if (element.hasAttributeNS(WORD_NAMESPACE,"lastRow")) {
        var str = element.getAttributeNS(WORD_NAMESPACE,"lastRow");
        this.lastRow = ((str == "true") || (str == "on") || (str == "1"));
    }

    if (element.hasAttributeNS(WORD_NAMESPACE,"firstColumn")) {
        var str = element.getAttributeNS(WORD_NAMESPACE,"firstColumn");
        this.firstColumn = ((str == "true") || (str == "on") || (str == "1"));
    }

    if (element.hasAttributeNS(WORD_NAMESPACE,"lastColumn")) {
        var str = element.getAttributeNS(WORD_NAMESPACE,"lastColumn");
        this.lastColumn = ((str == "true") || (str == "on") || (str == "1"));
    }

    if (element.hasAttributeNS(WORD_NAMESPACE,"noHBand")) {
        var str = element.getAttributeNS(WORD_NAMESPACE,"noHBand");
        this.noHBand = ((str == "true") || (str == "on") || (str == "1"));
    }

    if (element.hasAttributeNS(WORD_NAMESPACE,"noVBand")) {
        var str = element.getAttributeNS(WORD_NAMESPACE,"noVBand");
        this.noVBand = ((str == "true") || (str == "on") || (str == "1"));
    }
}
