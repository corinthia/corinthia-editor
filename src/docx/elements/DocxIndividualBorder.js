// Copyright (c) 2011-2012 UX Productivity. All rights reserved.

function DocxIndividualBorder(element,side)
{
    this.color = null;
    this.sz = null;
    this.val = null;
    this.side = side;

    if (element.hasAttributeNS(WORD_NAMESPACE,"color"))
        this.color = element.getAttributeNS(WORD_NAMESPACE,"color");
    if (element.hasAttributeNS(WORD_NAMESPACE,"sz"))
        this.sz = element.getAttributeNS(WORD_NAMESPACE,"sz");
    if (element.hasAttributeNS(WORD_NAMESPACE,"val"))
        this.val = element.getAttributeNS(WORD_NAMESPACE,"val");
}

DocxIndividualBorder.prototype.equals = function(other)
{
    return ((other.color == color) &&
            (other.sz == sz) &&
            (other.val == val));
}

DocxIndividualBorder.prototype.print = function(indent)
{
    if (this.color != null)
        debug(indent+"Color: "+this.color);
    if (this.sz != null)
        debug(indent+"Size: "+this.sz);
    if (this.val != null)
        debug(indent+"Style: "+this.val);
}

DocxIndividualBorder.prototype.applyCSSProperties = function(cssProperties)
{
    if (this.side == null)
        throw new Error("Attempt to apply CSS properties for individual border with no side");

    var prefix = this.side+"-";

    if (this.color != null)
        cssProperties[prefix+"color"] = DocxUtil.htmlColor(this.color);

    if (this.val == "nil")
        cssProperties[prefix+"style"] = "hidden";
    else if (this.val == "single")
        cssProperties[prefix+"style"] = "solid";
    else if (this.val == "dotted")
        cssProperties[prefix+"style"] = "dotted";
    else if (this.val == "dashSmallGap")
        cssProperties[prefix+"style"] = "dashed";
    else if (this.val == "dashed")
        cssProperties[prefix+"style"] = "dashed";
    else if (this.val == "dotDash")
        cssProperties[prefix+"style"] = "dashed";
    else if (this.val == "dotDotDash")
        cssProperties[prefix+"style"] = "dashed";
    else if (this.val == "double")
        cssProperties[prefix+"style"] = "double";
    else if (this.val == "triple")
        cssProperties[prefix+"style"] = "double";
    else if (this.val == "thinThickSmallGap")
        cssProperties[prefix+"style"] = "double";
    else if (this.val == "thickThinSmallGap")
        cssProperties[prefix+"style"] = "double";
    else if (this.val == "thinThickThinSmallGap")
        cssProperties[prefix+"style"] = "double";
    else if (this.val == "thinThickMediumGap")
        cssProperties[prefix+"style"] = "double";
    else if (this.val == "thickThinMediumGap")
        cssProperties[prefix+"style"] = "double";
    else if (this.val == "thinThickThinMediumGap")
        cssProperties[prefix+"style"] = "double";
    else if (this.val == "thinThickLargeGap")
        cssProperties[prefix+"style"] = "double";
    else if (this.val == "thickThinLargeGap")
        cssProperties[prefix+"style"] = "double";
    else if (this.val == "thinThickThinLargeGap")
        cssProperties[prefix+"style"] = "double";
    else if (this.val == "wave")
        cssProperties[prefix+"style"] = "solid";
    else if (this.val == "doubleWave")
        cssProperties[prefix+"style"] = "solid";
    else if (this.val == "dashDotStroked")
        cssProperties[prefix+"style"] = "solid";
    else if (this.val == "threeDEngrave")
        cssProperties[prefix+"style"] = "groove";
    else if (this.val == "threeDEmboss")
        cssProperties[prefix+"style"] = "ridge";
    else if (this.val == "inset")
        cssProperties[prefix+"style"] = "inset";
    else if (this.val == "outset")
        cssProperties[prefix+"style"] = "outset";

    // Ignore small border sizes, as safari won't display them
    // For the "double" border style, we need the size to be at least 3pt for the two
    // lines to be visible on screen
    if (this.sz != null) {
        if ((this.sz < 24) && (cssProperties[prefix+"style"] == "double"))
            cssProperties[prefix+"width"] = "3pt";
        else if (this.sz < 8)
            cssProperties[prefix+"width"] = "1pt";
        else
            cssProperties[prefix+"width"] = (this.sz/8)+"pt";
    }
}
