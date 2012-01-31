// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

// Represents a lvl chlid of an abstractNum element
function DocxLevel(abstractNumId,element)
{
    this.abstractNumId = abstractNumId;
    this.ilvl = element.getAttributeNS(WORD_NAMESPACE,"ilvl");
    this.start = null;
    this.numFmt = null;
    this.lvlText = null;
    this.lvlJc = null;

    for (var child = element.firstChild; child != null; child = child.nextSibling) {
        if (child.namespaceURI == WORD_NAMESPACE) {
            if (child.localName == "start")
                this.start = child.getAttributeNS(WORD_NAMESPACE,"val");
            else if (child.localName == "numFmt")
                this.numFmt = child.getAttributeNS(WORD_NAMESPACE,"val");
            else if (child.localName == "lvlText")
                this.lvlText = child.getAttributeNS(WORD_NAMESPACE,"val");
            else if (child.localName == "lvlJc")
                this.lvlJc = child.getAttributeNS(WORD_NAMESPACE,"val");
        }
    }
}
