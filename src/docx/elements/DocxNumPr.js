// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

function DocxNumPr(element)
{
    this.ilvl = null;
    this.numId = null;

    for (var child = element.firstChild; child != null; child = child.nextSibling) {
        if (child.namespaceURI == WORD_NAMESPACE) {
            if (child.localName == "ilvl")
                this.ilvl = child.getAttributeNS(WORD_NAMESPACE,"val");
            else if (child.localName == "numId")
                this.numId = child.getAttributeNS(WORD_NAMESPACE,"val");
        }
    }
}
