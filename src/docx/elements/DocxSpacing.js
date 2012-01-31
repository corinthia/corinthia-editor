// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

function DocxSpacing(element)
{
    if (element.hasAttributeNS(WORD_NAMESPACE,"before"))
        this.before = parseInt(element.getAttributeNS(WORD_NAMESPACE,"before"));
    else
        this.before = null;

    if (element.hasAttributeNS(WORD_NAMESPACE,"after"))
        this.after = parseInt(element.getAttributeNS(WORD_NAMESPACE,"after"));
    else
        this.after = null;

    if (element.hasAttributeNS(WORD_NAMESPACE,"line"))
        this.line = parseInt(element.getAttributeNS(WORD_NAMESPACE,"line"));
    else
        this.line = null;
}

DocxSpacing.prototype.applyCSSProperties = function(cssProperties)
{
    if (this.before != null)
        cssProperties["margin-top"] = this.before/20 + "pt";
    if (this.after != null)
        cssProperties["margin-bottom"] = this.after/20 + "pt";
    if (this.line != null)
        cssProperties["line-height"] = this.line/20 + "pt";
}
