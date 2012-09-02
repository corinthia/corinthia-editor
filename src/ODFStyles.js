var ODFAutomaticStyles_add;
var ODFAutomaticStyles_get;

var ODFStyle_create;
var ODFStyle_print;
var ODFStyle_getCSSText;

var ODFStyleSheet_getCSSText;

var OfficeFontFaceDecls_parse;
var OfficeStyles_parse;
var OfficeAutomaticStyles_parse;
var OfficeMasterStyles_parse;
var OfficeDocumentStyles_parse;

(function() {

    var automaticStyles = new Object();
    var odfFontFaceDecls = new Object();
    var odfStyles = new Object();



    ODFAutomaticStyles_add = trace(function _ODFAutomaticStyles_add(name,family,node)
    {
        if (automaticStyles[family] == null)
            automaticStyles[family] = new Object();
        automaticStyles[family][name] = ODFStyle_create(name,family,node);
    });

    ODFAutomaticStyles_get = trace(function ODFAutomaticStyles_get(name,family)
    {
        if (automaticStyles[family] == null)
            return null;
        return automaticStyles[family][name];
    });

    // fo:border
    // fo:border-left
    // fo:border-right
    // fo:border-top
    // fo:border-bottom
    // value = as for CSS
    function AttrFOBorder_toCSS(style,node,prefix)
    {
        var value = DOM_getAttributeNS(node,FO_NAMESPACE,prefix);
        if (value == null)
            return;

        var temp = DOM_createElement(document,"P");
        temp.style[prefix] = value;

        for (var i = 0; i < temp.style.length; i++) {
            var propName = temp.style[i];
            var propValue = temp.style.getPropertyValue(propName);
//            debug(prefix+": copying from temp: "+propName+" = "+propValue);

            // FIXME: we currently fix the width at 1px, because often the actual
            // values are really small and webkit won't render them
            if (propName.match(/-width$/))
                propValue = "1px";

            if (propName.match(/-image$/))
                continue; // I think this differs between safari and chrome

            style.cssProperties[propName] = propValue;
        }
    }

    // fo:padding
    // fo:padding-bottom
    // fo:padding-left
    // fo:padding-right
    // fo:padding-top
    // value = <nonNegativeLength>
    function AttrFOPadding_toCSS(style,node,prefix)
    {
        var value = DOM_getAttributeNS(node,FO_NAMESPACE,prefix);
        if (value == null)
            return;

        if (prefix == "padding") {
            style.cssProperties["padding-left"] = value;
            style.cssProperties["padding-right"] = value;
            style.cssProperties["padding-top"] = value;
            style.cssProperties["padding-bottom"] = value;
        }
        else {
            style.cssProperties[prefix] = value;
        }
    }

    // fo:margin
    // fo:margin-bottom
    // fo:margin-left
    // fo:margin-right
    // fo:margin-top
    // value = <nonNegativeLength> | <percent>
    function AttrFOMargin_toCSS(style,node,prefix)
    {
        var value = DOM_getAttributeNS(node,FO_NAMESPACE,prefix);
        if (value == null)
            return;

        if (prefix == "margin") {
            style.cssProperties["margin-left"] = value;
            style.cssProperties["margin-right"] = value;
            style.cssProperties["margin-top"] = value;
            style.cssProperties["margin-bottom"] = value;
        }
        else {
            style.cssProperties[prefix] = value;
        }
    }

    // fo:background-color
    // value = transparent | #rrggbb
    function AttrFOBackgroundColor_toCSS(style,node)
    {
        var backgroundColor = DOM_getAttributeNS(node,FO_NAMESPACE,"background-color");
        if (backgroundColor != null)
            style.cssProperties["background-color"] = backgroundColor;
    }

    // fo:color
    function AttrFOColor_toCSS(style,node)
    {
        var color = DOM_getAttributeNS(node,FO_NAMESPACE,"color");
        if ((color != null) && (color != ""))
            style.cssProperties["color"] = color;
    }

    // fo:font-family
    function AttrFOFontFamily_toCSS(style,node)
    {
        var fontFamily = DOM_getAttributeNS(node,FO_NAMESPACE,"font-family");
        if (fontFamily != null)
            style.cssProperties["font-family"] = fontFamily;
    }

    // fo:font-weight
    function AttrFOFontWeight_toCSS(style,node)
    {
        var fontWeight = DOM_getAttributeNS(node,FO_NAMESPACE,"font-weight");
        if (fontWeight == "bold")
            style.cssProperties["font-weight"] = "bold";
    }

    // fo:font-style
    function AttrFOFontStyle_toCSS(style,node)
    {
        var fontStyle = DOM_getAttributeNS(node,FO_NAMESPACE,"font-style");
        if (fontStyle == "italic")
            style.cssProperties["font-style"] = "italic";
    }

    // fo:font-size
    function AttrFOFontSize_toCSS(style,node)
    {
        var fontSize = DOM_getAttributeNS(node,FO_NAMESPACE,"font-size");
        if ((fontSize != null) && fontSize.match(/[0-9\.]+pt/))
            style.cssProperties["font-size"] = fontSize;
    }

    // fo:font-variant
    // value = normal | small-caps
    function AttrFOFontVariant_toCSS(style,node)
    {
        var fontVariant = DOM_getAttributeNS(node,FO_NAMESPACE,"font-variant");
        if (fontVariant != null)
            style.cssProperties["font-variant"] = fontVariant;
    }

    // fo:text-transform
    // value = capitalize | uppercase | lowercase | none
    function AttrFOTextTransform_toCSS(style,node)
    {
        var textTransform = DOM_getAttributeNS(node,FO_NAMESPACE,"text-transform");
        if (textTransform != null)
            style.cssProperties["textTransform"] = textTransform;
    }

    // fo:line-height
    // value = <length> | <percentage> | normal
    function AttrFOLineHeight_toCSS(style,node)
    {
        var value = DOM_getAttributeNS(node,FO_NAMESPACE,"line-heght");
        if (value != null)
            style.cssProperties["line-height"] = value;
    }

    // fo:letter-spacing
    // value = normal | <length>
    function AttrFOLetterSpacing_toCSS(style,node)
    {
        var letterSpacing = DOM_getAttributeNS(node,FO_NAMESPACE,"letter-spacing");
        if (letterSpacing != null)
            style.cssProperties["letter-spacing"] = letterSpacing;
    }

    // fo:text-align
    function AttrFOTextAlign_toCSS(style,node)
    {
        var textAlign = DOM_getAttributeNS(node,FO_NAMESPACE,"text-align");
        if (textAlign != null)
            style.cssProperties["text-align"] = textAlign;
    }

    function addTextDecoration(style,name)
    {
        if (style.cssProperties["text-decoration"] == null)
            style.cssProperties["text-decoration"] = name;
        else
            style.cssProperties["text-decoration"] += " "+name;
    }

    // style: text-underline-style
    function AttrStyleTextUnderlineStyle_toCSS(style,node)
    {
        var underline = DOM_getAttributeNS(node,STYLE_NAMESPACE,"text-underline-style");
        if ((underline != null) && (underline != "none"))
            addTextDecoration(style,"underline");
    }

    // style:text-overline-style
    function AttrStyleTextOverlineStyle_toCSS(style,node)
    {
        var overline = DOM_getAttributeNS(node,STYLE_NAMESPACE,"text-overline-style");
        if ((overline != null) && (overline != "none"))
            addTextDecoration(style,"overline");
    }

    // style:text-line-through-style
    function AttrStyleTextLineThroughStyle_toCSS(style,node)
    {
        var lineThrough = DOM_getAttributeNS(node,STYLE_NAMESPACE,"text-line-through-style");
        if ((lineThrough != null) && (lineThrough != "none"))
            addTextDecoration(style,"line-through");
    }

    function StyleGraphicProperties_toCSS(style,node)
    {
        if (node == null)
            return;
    }

    function StyleHeaderFooterProperties_toCSS(style,node)
    {
        if (node == null)
            return;
        AttrFOBackgroundColor_toCSS(style,node);
    }

    function StylePageLayoutProperties_toCSS(style,node)
    {
        if (node == null)
            return;
        AttrFOBackgroundColor_toCSS(style,node);
    }

    function StyleSectionProperties_toCSS(style,node)
    {
        if (node == null)
            return;
        AttrFOBackgroundColor_toCSS(style,node);
    }

    function StyleTextProperties_toCSS(style,node)
    {
        if (node == null)
            return;

        // FIXME: style:font-name

        AttrFOBackgroundColor_toCSS(style,node);
        AttrFOColor_toCSS(style,node);
        AttrFOFontFamily_toCSS(style,node);
        AttrFOFontWeight_toCSS(style,node);
        AttrFOFontStyle_toCSS(style,node);
        AttrFOFontSize_toCSS(style,node);
        AttrFOFontVariant_toCSS(style,node);
        AttrFOTextTransform_toCSS(style,node);
        AttrFOLetterSpacing_toCSS(style,node);
        AttrStyleTextUnderlineStyle_toCSS(style,node);
        AttrStyleTextOverlineStyle_toCSS(style,node);
        AttrStyleTextLineThroughStyle_toCSS(style,node);
    }

    function StyleParagraphProperties_toCSS(style,node)
    {
        if (node == null)
            return;

        AttrFOBorder_toCSS(style,node,"border");
        AttrFOBorder_toCSS(style,node,"border-left");
        AttrFOBorder_toCSS(style,node,"border-right");
        AttrFOBorder_toCSS(style,node,"border-top");
        AttrFOBorder_toCSS(style,node,"border-bottom");
        AttrFOPadding_toCSS(style,node,"padding");
        AttrFOPadding_toCSS(style,node,"padding-left");
        AttrFOPadding_toCSS(style,node,"padding-right");
        AttrFOPadding_toCSS(style,node,"padding-top");
        AttrFOPadding_toCSS(style,node,"padding-bottom");
        AttrFOMargin_toCSS(style,node,"margin");
        AttrFOMargin_toCSS(style,node,"margin-left");
        AttrFOMargin_toCSS(style,node,"margin-right");
        AttrFOMargin_toCSS(style,node,"margin-top");
        AttrFOMargin_toCSS(style,node,"margin-bottom");
        AttrFOBackgroundColor_toCSS(style,node);
        AttrFOTextAlign_toCSS(style,node);
    }

    function StyleTableProperties_toCSS(style,node)
    {
        AttrFOBackgroundColor_toCSS(style,node);
    }

    function StyleTableColumnProperties_toCSS(style,node)
    {
    }

    function StyleTableRowProperties_toCSS(style,node)
    {
        AttrFOBackgroundColor_toCSS(style,node);
    }

    function StyleTableCellProperties_toCSS(style,node)
    {
        AttrFOBackgroundColor_toCSS(style,node);
    }

    ODFStyle_create = trace(function _ODFStyle_create(name,family,node)
    {
        return new ODFStyle(name,family,node);
    });

    function ODFStyle(name,family,node)
    {
        if (name == null)
            throw new Error("ODFStyle: name is null");
        if (family == null)
            throw new Error("ODFStyle: family is null");
        if (node == null)
            throw new Error("ODFStyle: node is null");

        var style = this;
        this.name = name;
        this.family = family;
        this.node = node;
        this.cssProperties = new Object();
        this.selector = null;

        if (family == "text") {
            this.selector = "span."+this.name;
            StyleTextProperties_toCSS(style,node._child_style_text_properties);
        }
        else if (family == "paragraph") {
            this.selector = "p."+this.name;
            StyleParagraphProperties_toCSS(style,node._child_style_paragraph_properties);
            StyleTextProperties_toCSS(style,node._child_style_text_properties);
        }
        else if (family == "section") {
            // Unsupported
        }
        else if (family == "ruby") {
            // Unsupported
        }
        else if (family == "table") {
            this.selector = "table."+this.name;
            StyleTableProperties_toCSS(style,node._child_style_table_properties);
        }
        else if (family == "table-column") {
            this.selector = "col."+this.name;
            StyleTableColumnProperties_toCSS(style,node._child_style_table_column_properties);
        }
        else if (family == "table-row") {
            this.selector = "tr."+this.name;
            StyleTableRowProperties_toCSS(style,node._child_style_table_row_properties);
        }
        else if (family == "table-cell") {
            this.selector = "td."+this.name;
            StyleTableCellProperties_toCSS(style,node._child_style_table_cell_properties);
            StyleParagraphProperties_toCSS(style,node._child_style_paragraph_properties);
            StyleTextProperties_toCSS(style,node._child_style_text_properties);
        }
        else if (family == "graphic") {
            // Unsupported
        }
        else if (family == "presentation") {
            // Unsupported
        }
        else if (family == "drawing-page") {
            // Unsupported
        }
        else if (family == "chart") {
            // Unsupported
        }
    }

    ODFStyle_print = trace(function _ODFStyle_print(indent)
    {
        var names = Object.getOwnPropertyNames(this.cssProperties).sort();
        debug(indent+"Style "+this.name+" ("+this.family+"); selector "+this.selector);
        for (var i = 0; i < names.length; i++) {
            debug(indent+"    "+names[i]+" = "+this.cssProperties[names[i]]);
        }
    });

    ODFStyle_getCSSText = trace(function _ODFStyle_getCSSText(style)
    {
        debug("getting CSS text for "+style.selector);
        return style.selector+" {\n"+Styles_getPropertiesText(style.cssProperties)+"}\n";
    });

    ODFStyleSheet_getCSSText = trace(function _ODFStyleSheet_getCSSText()
    {
        var strings = new Array();
        var names = Object.getOwnPropertyNames(odfStyles).sort();
        for (var i = 0; i < names.length; i++) {
            var style = odfStyles[names[i]];
            strings.push(ODFStyle_getCSSText(style));
        }
        return strings.join("");
    });

























    function StyleFontFace(name,node)
    {
        this.name = name;
        this.node = node;
        this.family = DOM_getAttributeNS(node,SVG_NAMESPACE,"font-family");
        this.familyGeneric = DOM_getAttributeNS(node,SVG_NAMESPACE,"font-family-generic");
        this.pitch = DOM_getAttributeNS(node,SVG_NAMESPACE,"font-pitch");
        this.adornments = DOM_getAttributeNS(node,SVG_NAMESPACE,"font-adornments");
//        debug("Found font face:");
//        debug("    family = "+this.family);
//        debug("    familyGeneric = "+this.familyGeneric);
//        debug("    pitch = "+this.pitch);
//        debug("    adornments = "+this.adornments);
    }

    // style:font-face
    var StyleFontFace_parse = trace(function _StyleFontFace_parse(con)
    {
        var name = DOM_getAttributeNS(con,STYLE_NAMESPACE,"name");
        // style:name is the only required attribute. If the font face doesn't have one, skip it
        if (name == "")
            return;
        odfFontFaceDecls[name] = new StyleFontFace(name,con);
    });















    // office:font-face-decls
    OfficeFontFaceDecls_parse = trace(function _OfficeFontFaceDecls_parse(con)
    {
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            debug("OfficeFontFaceDecls_parse: child "+nodeString(child));
            if (child._is_style_font_face) {
                StyleFontFace_parse(child);
            }
        }
    });

    // office:styles
    OfficeStyles_parse = trace(function _OfficeStyles_parse(con)
    {
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            debug("OfficeStyles_parse: child "+nodeString(child));
            if (child._is_style_style) {
                var name = DOM_getAttributeNS(child,STYLE_NAMESPACE,"name");
                var family = DOM_getAttributeNS(child,STYLE_NAMESPACE,"family");
                if ((name != null) && (family != null)) {
                    debug("found style "+name+", family "+family);
                    odfStyles[name] = ODFStyle_create(name,family,child);
                }
            }
        }
    });

    // office:automatic-styles
    OfficeAutomaticStyles_parse = trace(function _OfficeAutomaticStyles_parse(con)
    {
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            debug("OfficeAutomaticStyles_parse: child "+nodeString(child));
        }
    });

    // office:master-styles
    OfficeMasterStyles_parse = trace(function _OfficeMasterStyles_parse(con)
    {
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            debug("OfficeMasterStyles_parse: child "+nodeString(child));
        }
    });

    // office:document-styles
    OfficeDocumentStyles_parse = trace(function _OfficeDocumentStyles_parse(root)
    {
        if ((root.namespaceURI != OFFICE_NAMESPACE) || (root.localName != "document-styles"))
            throw new ODFInvalidError("Invalid root element in styles.xml");

        if (root._child_office_font_face_decls != null)
            OfficeFontFaceDecls_parse(root._child_office_font_face_decls);

        if (root._child_office_styles != null)
            OfficeStyles_parse(root._child_office_styles);

        if (root._child_office_automatic_styles != null)
            OfficeAutomaticStyles_parse(root._child_office_automatic_styles);

        if (root._child_office_master_styles != null)
            OfficeMasterStyles_parse(root._child_office_master_styles);
    });

})();
