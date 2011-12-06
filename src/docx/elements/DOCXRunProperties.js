function DOCXRunProperties(element)
{
    this.b = false; // Bold
    this.bdr = null; // Text border
    this.caps = null; // All caps
    this.color = null; // Run content color
    this.del = null; // Deleted aragraph
    this.em = null; // Emphasis mark
    this.highlight = null; // Text hilighting
    this.i = false; // Italics
    this.ins = null; // Inserted paragraph
    this.position = null; // Vertically raised or lowered text
    this.rFonts = null; // Run fonts
    this.rStyle = null; // Referenced character style
    this.shd = null; // Run shading
    this.smallCaps = false; // Small caps
    this.spacing = null; // Character spacing adjustment
    this.strike = false; // Single strikethrough
    this.sz = null; // Font size (half-point values)
    this.u = false; // Underline
    this.vanish = null; // Hidden text
    this.vertAlign = null; // Subscript/superscript text
    this.w = null; // Expanded/compressed text

    if (element == null)
        return;

    for (var child = element.firstChild; child != null; child = child.nextSibling) {
        if (child.namespaceURI == WORD_NAMESPACE) {
            if (child.localName == "b")
                this.b = true;
            else if (child.localName == "bdr")
                this.bdr = null;
            else if (child.localName == "caps")
                this.caps = null;
            else if (child.localName == "color")
                this.color = child.getAttributeNS(WORD_NAMESPACE,"val");
            else if (child.localName == "del")
                this.del = null;
            else if (child.localName == "em")
                this.em = null;
            else if (child.localName == "highlight")
                this.highlight = null;
            else if (child.localName == "i")
                this.i = true;
            else if (child.localName == "ins")
                this.ins = null;
            else if (child.localName == "position")
                this.position = null;
            else if (child.localName == "rFonts")
                this.rFonts = child.getAttributeNS(WORD_NAMESPACE,"ascii");
            else if (child.localName == "rStyle")
                this.rStyle = child.getAttributeNS(WORD_NAMESPACE,"val");
            else if (child.localName == "shd")
                this.shd = child.getAttributeNS(WORD_NAMESPACE,"fill");
            else if (child.localName == "smallCaps")
                this.smallCaps = true;
            else if (child.localName == "spacing")
                this.spacing = null;
            else if (child.localName == "strike")
                this.strike = true;
            else if (child.localName == "sz")
                this.sz = child.getAttributeNS(WORD_NAMESPACE,"val");
            else if (child.localName == "u")
                this.u = true;
            else if (child.localName == "vanish")
                this.vanish = null;
            else if (child.localName == "vertAlign")
                this.vertAlign = child.getAttributeNS(WORD_NAMESPACE,"val");
            else if (child.localName == "w")
                this.w = null;
        }
    }
}

DOCXRunProperties.prototype.print = function(indent)
{
    if (this.b != null)
        debug(indent+"Bold: "+this.b);
    if (this.bdr != null) {}
    if (this.caps != null) {}
    if (this.color != null)
        debug(indent+"Color: "+this.color);
    if (this.del != null) {}
    if (this.em != null) {}
    if (this.highlight != null) {}
    if (this.i != null)
        debug(indent+"Italic: "+this.i);
    if (this.ins != null) {}
    if (this.position != null) {}
    if (this.rFonts != null) {}
    if (this.rStyle != null) {}
    if (this.shd != null) {}
    if (this.smallCaps != null) {}
    if (this.spacing != null) {}
    if (this.strike != null) {}
    if (this.u != null)
        debug(indent+"Underline: "+this.u);
    if (this.vanish != null) {}
    if (this.vertAlign != null)
        debug(indent+"Vertical align: "+this.vertAlign);
    if (this.w != null) {}
}

// Applies only those properties that, if declared in-place on a specific run, must go in the
// "style" attribute, as opposed to individual HTML elements. For example we include things
// like font-family and color here, but bold and italic result in <B> and <I> elements being
// added to the output document.
DOCXRunProperties.prototype.applyStyleCSSProperties = function(cssProperties)
{
    if (this.strike)
        cssProperties["text-decoration"] = "line-through";
    if (this.color != null)
        cssProperties["color"] = DOCXUtil.htmlColor(this.color);
    if (this.sz != null)
        cssProperties["font-size"] = this.sz/2+"pt";
    if (this.rFonts != null) {
        if (this.rFonts.indexOf(" ") >= 0)
            cssProperties["font-family"] = "\""+this.rFonts+"\"";
        else
            cssProperties["font-family"] = this.rFonts;
    }
}

DOCXRunProperties.prototype.fromCSSStyleDeclaration = function(style,node)
{
    function cssListContains(list,ident)
    {
        for (var i = 0; i < list.length; i++) {
            if ((list[i].primitiveType == CSSPrimitiveValue.CSS_IDENT) &&
                (list[i].getStringValue() == ident))
                return true;
        }
        return false;
    }

    for (var i = 0; i < style.length; i++) {
        var name = style.item(i);
        if ((name == "color") && (this.color == null)) {
            var color = style.getPropertyCSSValue("color");
            var c = null;
            if (color.primitiveType == CSSPrimitiveValue.CSS_IDENT) {
                c = CSS_COLORS_BY_NAME[color.getStringValue()];
            }
            else if (color.primitiveType == CSSPrimitiveValue.CSS_RGBCOLOR) {
                var rgbColor = color.getRGBColorValue();
                c = { r: parseInt(rgbColor.red.cssText),
                      g: parseInt(rgbColor.green.cssText),
                      b: parseInt(rgbColor.blue.cssText) };
            }
            if (c != null) {
                var hexChars = "0123456789ABCDEF";
                this.color = hexChars[Math.floor(c.r/16)] +
                    hexChars[c.r%16] +
                    hexChars[Math.floor(c.g/16)] +
                    hexChars[c.g%16] +
                    hexChars[Math.floor(c.b/16)] +
                    hexChars[c.b%16];
            }
        }
        else if (name == "text-decoration") {
            var textDecoration = style.getPropertyCSSValue("text-decoration");
            if (cssListContains(textDecoration,"line-through"))
                this.strike = true;
            if (cssListContains(textDecoration,"underline"))
                this.u = true;
        }
        else if (name == "font-weight") {
            var fontWeight = style.getPropertyCSSValue("font-weight");

            if ((fontWeight.primitiveType == CSSPrimitiveValue.CSS_IDENT) &&
                (fontWeight.getStringValue() == "bold")) {
                this.b = true;
            }
        }
        else if (name == "font-style") {
            var fontStyle = style.getPropertyCSSValue("font-style");
            if ((fontStyle.primitiveType == CSSPrimitiveValue.CSS_IDENT) &&
                ((fontStyle.getStringValue() == "italic") ||
                 (fontStyle.getStringValue() == "oblique"))) {
                this.i = true;
            }
        }
        else if ((name == "font-size") && (this.sz == null)) {
            var POINTS_PER_PC = 12;
            var POINTS_PER_PX = 0.75;
            var POINTS_PER_IN = 72;
            var POINTS_PER_CM = POINTS_PER_IN/2.54;
            var POINTS_PER_MM = POINTS_PER_CM/10;

            var fontSize = style.getPropertyCSSValue("font-size");

            if (fontSize.primitiveType == CSSPrimitiveValue.CSS_PT)
                this.sz = Math.round(2 * parseFloat(fontSize.cssText));
            else if (fontSize.primitiveType == CSSPrimitiveValue.CSS_PC)
                this.sz = Math.round(2 * parseFloat(fontSize.cssText) * POINTS_PER_PC);
            else if (fontSize.primitiveType == CSSPrimitiveValue.CSS_PX)
                this.sz = Math.round(2 * parseFloat(fontSize.cssText) * POINTS_PER_PX);
            else if (fontSize.primitiveType == CSSPrimitiveValue.CSS_IN)
                this.sz = Math.round(2 * parseFloat(fontSize.cssText) * POINTS_PER_IN);
            else if (fontSize.primitiveType == CSSPrimitiveValue.CSS_CM)
                this.sz = Math.round(2 * parseFloat(fontSize.cssText) * POINTS_PER_CM);
            else if (fontSize.primitiveType == CSSPrimitiveValue.CSS_MM)
                this.sz = Math.round(2 * parseFloat(fontSize.cssText) * POINTS_PER_MM);
            else if (((fontSize.primitiveType == CSSPrimitiveValue.CSS_EMS) ||
                      (fontSize.primitiveType == CSSPrimitiveValue.CSS_EXS)) &&
                     (node != null)) {
                this.sz = getComputedSize();
            }
            else if (fontSize.primitiveType == CSSPrimitiveValue.CSS_IDENT) {
                var table = [ 3, 6, 9, 12, 15, 18, 21 ];
                var str = fontSize.getStringValue();
                if (str == "xx-small")
                    this.sz = 2 * table[0];
                else if (str == "x-small")
                    this.sz = 2 * table[1];
                else if (str == "small")
                    this.sz = 2 * table[2];
                else if (str == "medium")
                    this.sz = 2 * table[3];
                else if (str == "large")
                    this.sz = 2 * table[4];
                else if (str == "x-large")
                    this.sz = 2 * table[5];
                else if (str == "xx-large")
                    this.sz = 2 * table[6];
                else if ((str == "larger") || (str == "smaller")) {
                    this.sz = getComputedSize();
                }
            }
            else if (fontSize.primitiveType == CSSPrimitiveValue.CSS_PERCENTAGE) {
                this.sz = getComputedSize();
            }

            function getComputedSize()
            {
                var view = node.ownerDocument.defaultView;
                var computed = view.getComputedStyle(node,null);
                var compFontSize = computed.getPropertyCSSValue("font-size");
                return Math.round(2 * parseFloat(compFontSize.cssText) * POINTS_PER_PX);
            }
        }
        else if ((name == "font-family") && (this.rFonts == null)) {
            var fontFamily = style.getPropertyCSSValue("font-family");
            if (fontFamily.length > 0) {
                var family = fontFamily[0];
                if (family.primitiveType == CSSPrimitiveValue.CSS_IDENT) {
                    var str = family.getStringValue();
                    if (str == "serif")
                        this.rFonts = "Times";
                    else if (str == "sans-serif")
                        this.rFonts = "Helvetica";
                    else if (str == "cursive")
                        this.rFonts = "Comic Sans MS";
                    else if (str == "fantasy")
                        this.rFonts = "Algerian";
                    else if (str == "monospace")
                        this.rFonts = "Courier";
                }
                else if (family.primitiveType == CSSPrimitiveValue.CSS_STRING) {
                    this.rFonts = family.cssText;
                }
            }
        }
    }
}

DOCXRunProperties.prototype.fromHTML = function(node)
{
    for (; node != null; node = node.parentNode) {
        if ((node.nodeType == Node.ELEMENT_NODE) && (node.hasAttribute("style"))) {
            this.fromCSSStyleDeclaration(node.style,node);
        }

        if ((node.nodeName == "B") || (node.nodeName == "STRONG")) {
            this.b = true;
        }
        else if ((node.nodeName == "I") || (node.nodeName == "EM")) {
            this.i = true;
        }
        else if (node.nodeName == "U") {
            this.u = true;
        }
        // FIXME: need to add style definitions for the following when they are present
        else if (node.nodeName == "TT") {
            this.rStyle = "HTMLTypewriter";
        }
        else if (node.nodeName == "CITE") {
            this.rStyle = "HTMLCite";
        }
        else if (node.nodeName == "DFN") {
            this.rStyle = "HTMLDefinition";
        }
        else if (node.nodeName == "CODE") {
            this.rStyle = "HTMLCode";
        }
        else if (node.nodeName == "SAMP") {
            this.rStyle = "HTMLSample";
        }
        else if (node.nodeName == "KBD") {
            this.rStyle = "HTMLKeyboard";
        }
        else if (node.nodeName == "VAR") {
            this.rStyle = "HTMLVariable";
        }
        else if (node.nodeName == "ACRONYM") {
            this.rStyle = "HTMLAcronym";
        }
    }
}

DOCXRunProperties.prototype.toXML = function(doc)
{
    var rPr = doc.createElementNS(WORD_NAMESPACE,"w:rPr");
    if (this.b) {
        var element = doc.createElementNS(WORD_NAMESPACE,"w:b");
        rPr.appendChild(element);
    }
    if (this.i) {
        var element = doc.createElementNS(WORD_NAMESPACE,"w:i");
        rPr.appendChild(element);
    }
    if (this.u) {
        var element = doc.createElementNS(WORD_NAMESPACE,"w:u");
        element.setAttributeNS(WORD_NAMESPACE,"w:val","single");
        rPr.appendChild(element);
    }
    if (this.strike) {
        var element = doc.createElementNS(WORD_NAMESPACE,"w:strike");
        rPr.appendChild(element);
    }
    if (this.color != null) {
        var element = doc.createElementNS(WORD_NAMESPACE,"w:color");
        element.setAttributeNS(WORD_NAMESPACE,"w:val",this.color);
        rPr.appendChild(element);
    }
    if (this.sz != null) {
        var element = doc.createElementNS(WORD_NAMESPACE,"w:sz");
        element.setAttributeNS(WORD_NAMESPACE,"w:val",this.sz);
        rPr.appendChild(element);

        element = doc.createElementNS(WORD_NAMESPACE,"w:szCs");
        element.setAttributeNS(WORD_NAMESPACE,"w:val",this.sz);
        rPr.appendChild(element);
    }
    if (this.rFonts != null) {
        var element = doc.createElementNS(WORD_NAMESPACE,"w:rFonts");
        element.setAttributeNS(WORD_NAMESPACE,"w:ascii",this.rFonts);
        element.setAttributeNS(WORD_NAMESPACE,"w:hAnsi",this.rFonts);
        rPr.appendChild(element);
    }

    if (rPr.firstChild == null)
        return null;
    else
        return rPr;
}

DOCXRunProperties.prototype.applyCSSProperties = function(cssProperties)
{
    if (this.b)
        cssProperties["font-weight"] = "bold";
    if (this.i)
        cssProperties["font-style"] = "italic";
    if (this.smallCaps)
        cssProperties["font-variant"] = "small-caps";

    if (this.color != null)
        cssProperties["color"] = DOCXUtil.htmlColor(this.color);
    if (this.shd != null)
        cssProperties["background-color"] = DOCXUtil.htmlColor(this.shd);

    if (this.strike) {
        if (cssProperties["text-decoration"] != null)
            cssProperties["text-decoration"] += " line-through";
        else
            cssProperties["text-decoration"] = "line-through";
    }
    if (this.u) {
        if (cssProperties["text-decoration"] != null)
            cssProperties["text-decoration"] += " underline";
        else
            cssProperties["text-decoration"] = "underline";
    }
    this.applyStyleCSSProperties(cssProperties);
}
