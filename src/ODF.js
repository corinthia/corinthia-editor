var ODF_updateFromHTML;
var ODF_contentXML;
var ODF_metaXML;
var ODF_settingsXML;
var ODF_stylesXML;
var ODF_initODF;

function ODFInvalidError(msg)
{
    this.msg = msg;
    this.custom = true;
}

ODFInvalidError.prototype.toString = function() {
    return this.msg;
};

(function() {

    var odf = new Object();

    var odfFontFaceDecls = null;
    var odfStyles = null;
    var odfAutomaticStyles = null;
    var odfMasterStyles = null;

    var OFFICE_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:office:1.0";
    var STYLE_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:style:1.0";
    var TEXT_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
    var TABLE_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:table:1.0";
    var FO_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0";
    var SVG_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0";

    var nextODFId = 0;
    var automaticStyles = null;

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
            debug(prefix+": copying from temp: "+propName+" = "+propValue);

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

    // fo:line-height
    // value = <length> | <percentage> | normal
    function AttrFOLineHeight_toCSS(style,node)
    {
        var value = DOM_getAttributeNS(node,FO_NAMESPACE,"line-heght");
        if (value != null)
            style.cssProperties["line-height"] = value;
    }

    // fo:text-align
    // fo:text-align-last
    // fo:text-indent
    // fo:widows
    // fo:join-border


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

        // The <style:text-properties> element has the following attributes:
        // fo:background-color 20.175
        // fo:color 20.180
        // fo:country 20.181
        // fo:font-family 20.182
        // fo:font-size 20.183
        // fo:font-style 20.184
        // fo:font-variant 20.185
        // fo:font-weight 20.186
        // fo:hyphenate 20.188
        // fo:hyphenation-push-char-count 20.191
        // fo:hyphenation-remain-char-count 20.192
        // fo:language 20.195
        // fo:letter-spacing 20.196
        // fo:script 20.215
        // fo:text-shadow 20.219
        // fo:text-transform 20.220
        // style:country-asian 20.248
        // style:country-complex 20.249
        // style:font-charset 20.260
        // style:font-charset-asian 20.261
        // style:font-charset-complex 20.262
        // style:font-family-asian 20.263
        // style:font-family-complex 20.264
        // style:font-family-generic 20.265
        // style:font-family-generic-asian 20.266
        // style:font-family-generic-complex 20.267
        // style:font-name 20.269
        // style:font-name-asian 20.270
        // style:font-name-complex 20.271
        // style:font-pitch 20.272
        // style:font-pitch-asian 20.273
        // style:font-pitch-complex 20.274
        // style:font-relief 20.275
        // style:font-size-asian 20.276
        // style:font-size-complex 20.277
        // style:font-size-rel 20.278
        // style:font-size-rel-asian 20.279
        // style:font-size-rel-complex 20.280
        // style:font-style-asian 20.281
        // style:font-style-complex 20.282
        // style:font-style-name 20.283
        // style:font-style-name-asian 20.284
        // style:font-style-name-complex 20.285
        // style:font-weight-asian 20.286
        // style:font-weight-complex 20.287
        // style:language-asian 20.294
        // style:language-complex 20.295
        // style:letter-kerning 20.308
        // style:rfc-language-tag 20.335
        // style:rfc-language-tag-asian 20.336
        // style:rfc-language-tag-complex 20.337
        // style:script-asian 20.346
        // style:script-complex 20.347
        // style:script-type 20.348
        // style:text-blinking 20.356
        // style:text-combine 20.357
        // style:text-combine-end-char 20.359
        // style:text-combine-start-char 20.358
        // style:text-emphasize 20.360
        // style:text-line-through-color 20.361
        // style:text-line-through-mode 20.362
        // style:text-line-through-style 20.363
        // style:text-line-through-text 20.364
        // style:text-line-through-text-style 20.365
        // style:text-line-through-type 20.366
        // style:text-line- through-width 20.367
        // style:text-outline 20.368
        // style:text-overline-color 20.369
        // style:text-overline-mode 20.370
        // style:text-overline-style 20.371
        // style:text-overline-type 20.372
        // style:text-overline-width 20.373
        // style:text-position 20.374
        // style:text-rotation-angle 20.375
        // style:text-rotation-scale 20.376
        // style:text-scale 20.377
        // style:text-underline-color 20.378
        // style:text-underline-mode 20.379
        // style:text-underline-style 20.380,
        // style:text-underline-type 20.381
        // style:text-underline-width 20.382
        // style:use-window-font-color 20.385
        // text:condition 20.416
        // text:display 20.417.

        AttrFOBackgroundColor_toCSS(style,node);

        var fontWeight = DOM_getAttributeNS(node,FO_NAMESPACE,"font-weight");
        var fontStyle = DOM_getAttributeNS(node,FO_NAMESPACE,"font-style");
        var fontSize = DOM_getAttributeNS(node,FO_NAMESPACE,"font-size");
        var color = DOM_getAttributeNS(node,FO_NAMESPACE,"color");


        if (fontWeight == "bold")
            style.cssProperties["font-weight"] = "bold";
        if (fontStyle == "italic")
            style.cssProperties["font-style"] = "italic";
//        if (underline == "solid")
//            style.cssProperties["text-decoration"] = "underline";
        if ((fontSize != null) && fontSize.match(/[0-9\.]+pt/))
            style.cssProperties["font-size"] = fontSize;
        if ((color != null) && (color != ""))
            style.cssProperties["color"] = color;



        var underline = DOM_getAttributeNS(node,STYLE_NAMESPACE,"text-underline-style");
        var overline = DOM_getAttributeNS(node,STYLE_NAMESPACE,"text-overline-style");
        var lineThrough = DOM_getAttributeNS(node,STYLE_NAMESPACE,"text-line-through-style");
        var textDecorationArray = new Array();
        if ((underline != null) && (underline != "none"))
            textDecorationArray.push("underline");
        if ((overline != null) && (overline != "none"))
            textDecorationArray.push("overline");
        if ((lineThrough != null) && (lineThrough != "none"))
            textDecorationArray.push("line-through");
        var textDecoration = textDecorationArray.join(" ");
        if (textDecoration != "")
            style.cssProperties["text-decoration"] = textDecoration;
    }

    function StyleParagraphProperties_toCSS(style,node)
    {
        if (node == null)
            return;

        // The <style:paragraph-properties> element has the following attributes:
        // fo:background-color
        // fo:border
        // fo:border-bottom
        // fo:border-left
        // fo:border-right
        // fo:border-top
        // fo:break-after
        // fo:break-before
        // fo:hyphenation-keep
        // fo:hyphenation-ladder-count
        // fo:keep-together
        // fo:keep-with-next
        // fo:line-height
        // fo:margin
        // fo:margin-bottom
        // fo:margin-left
        // fo:margin-right
        // fo:margin-top
        // fo:orphans
        // fo:padding
        // fo:padding-bottom
        // fo:padding-left
        // fo:padding-right
        // fo:padding-top
        // fo:text-align
        // fo:text-align-last
        // fo:text-indent
        // fo:widows
        // style:auto-text-indent
        // style:background-transparency
        // style:border-line-width
        // style:border-line-width-bottom
        // style:border-line-width-left
        // style:border-line-width-right
        // style:border-line-width-top
        // style:font-independent-line-spacing
        // style:join-border
        // style:justify-single-word
        // style:line-break
        // style:line-height-at-least
        // style:line-spacing
        // style:page-number
        // style:punctuation-wrap
        // style:register-true
        // style:shadow
        // style:snap-to-layout-grid
        // style:tab-stop-distance
        // style:text-autospace
        // style:vertical-align
        // style:writing-mode
        // style:writing-mode-automatic
        // text:line-number
        // text:number-lines

        // The <style:paragraph-properties> element has the following child elements:
        // <style:background-image>
        // <style:drop-cap>
        // <style:tab-stops>

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

        var textAlign = DOM_getAttributeNS(node,FO_NAMESPACE,"text-align");
        var shadow = DOM_getAttributeNS(node,FO_NAMESPACE,"shadow");

        if ((textAlign != null) && (textAlign != ""))
            style.cssProperties["text-align"] = textAlign;

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

    }

    ODFStyle.prototype.print = function(indent)
    {
        var names = Object.getOwnPropertyNames(this.cssProperties).sort();
        debug(indent+"Style "+this.name+" ("+this.family+"); selector "+this.selector);
        for (var i = 0; i < names.length; i++) {
            debug(indent+"    "+names[i]+" = "+this.cssProperties[names[i]]);
        }
    }

    // text:span
    var TextSpan_get = trace(function _TextSpan_get(con)
    {
        var span = DOM_createElement(document,"SPAN");
        span._source = con;
        DOM_setAttribute(span,"id","odf"+nextODFId++);

        var styleName = DOM_getAttributeNS(con,TEXT_NAMESPACE,"style-name");
        var style = automaticStyles[styleName];
        if (style != null)
            DOM_setStyleProperties(span,style.cssProperties);

        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child.nodeType == Node.TEXT_NODE) {
                var text = DOM_createTextNode(document,child.nodeValue);
                text._source = child;
                DOM_appendChild(span,text);
            }
        }
        return span;
    });

    // text:p and text:h
    var TextPH_get = trace(function _TextPH_get(con)
    {
        var p = null;
        if (con._is_text_h) {
            var levelStr = DOM_getAttributeNS(con,TEXT_NAMESPACE,"outline-level");
            var level = 1;
            if (levelStr != null) {
                levelStr = levelStr.trim();
                if (levelStr.match(/[123456]/))
                    level = levelStr;
            }
            p = DOM_createElement(document,"H"+level);
        }
        else {
            p = DOM_createElement(document,"P");
        }
        DOM_setAttribute(p,"id","odf"+nextODFId++);

        var styleName = DOM_getAttributeNS(con,TEXT_NAMESPACE,"style-name");
        var style = automaticStyles[styleName];
        if (style != null)
            DOM_setStyleProperties(p,style.cssProperties);

        p._source = con;
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child.nodeType == Node.TEXT_NODE) {
                var span = DOM_createElement(document,"SPAN");
                DOM_setAttribute(span,"id","odf"+nextODFId++);
                var text = DOM_createTextNode(document,child.nodeValue);
                text._source = child;
                DOM_appendChild(span,text);
                DOM_appendChild(p,span);
            }
            else if (child._is_text_span) {
                DOM_appendChild(p,TextSpan_get(child));
            }
        }
        return p;
    });

    // office:text
    var OfficeText_get = trace(function _OfficeText_get(con)
    {
        var body = DOM_createElement(document,"BODY");
        body._source = con;
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child._is_text_p || child._is_text_h) {
                DOM_appendChild(body,TextPH_get(child));
            }
        }
        return body;
    });

    // office:body
    var OfficeBody_get = trace(function _OfficeBody_get(con)
    {
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child._is_office_text) {
                return OfficeText_get(child);
            }
        }
        throw new Error("office:text element not found");
    });

    // office:document-content
    var OfficeDocumentContent_get = trace(function _OfficeDocumentContent_get(con)
    {
        debug("OfficeDocumentContent_get: con = "+nodeString(con));
        var abs = DOM_createElement(document,"HTML");
        abs._source = con;
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child._is_office_body) {
                DOM_appendChild(abs,OfficeBody_get(child));
            }
        }
        return abs;
    });

    var convertToHTML = trace(function convertToHTML()
    {
        var html = OfficeDocumentContent_get(odf.content.documentElement);;

        var body = html.firstChild;
        var next;
        for (var child = body.firstChild; child != null; child = next) {
            next = child.nextSibling;
            DOM_appendChild(document.body,child);
        }


//        debug("------------------- convertToHTML BEGIN ----------------------");
//        printTree(document.documentElement);
//        debug("------------------- convertToHTML END ----------------------");

        return true;
    });








    ODF_updateFromHTML = trace(function updateFromHTML()
    {
        return true;
    });

    function serialize(xmlDocument)
    {
        if (xmlDocument == null)
            return null;
        else
            return new XMLSerializer().serializeToString(xmlDocument);
    }

    ODF_contentXML = trace(function contentXML()
    {
        return serialize(odf.content);
    });

    ODF_metaXML = trace(function metaXML()
    {
        return serialize(odf.meta);
    });

    ODF_settingsXML = trace(function settingsXML()
    {
        return serialize(odf.settings);
    });

    ODF_stylesXML = trace(function stylesXML()
    {
        return serialize(odf.styles);
    });

    var namespaceMapping = new Object();
    namespaceMapping[OFFICE_NAMESPACE] = "office";
    namespaceMapping[STYLE_NAMESPACE] = "style";
    namespaceMapping[TEXT_NAMESPACE] = "text";
    namespaceMapping[TABLE_NAMESPACE] = "table";

    var assignShorthandProperties = trace(function _assignShorthandProperties(node)
    {
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            assignShorthandProperties(child);
        }
        if (node.nodeType == Node.ELEMENT_NODE) {
            var prefix = namespaceMapping[node.namespaceURI];
            if (prefix != null) {
                var name = prefix+"_"+node.localName.replace(/-/g,"_");
                node["_is_"+name] = true;
                if (node.parentNode != null)
                    node.parentNode["_child_"+name] = node;
            }
        }
    });

    var updateAutomaticStyles = trace(function _updateAutomaticStyles()
    {
        automaticStyles = new Object();
        var root = odf.content.documentElement;
        for (var child = root.firstChild; child != null; child = child.nextSibling) {
            if (child._is_office_automatic_styles) {
                for (gc = child.firstChild; gc != null; gc = gc.nextSibling) {
                    if (gc._is_style_style) {
                        var name = DOM_getAttributeNS(gc,STYLE_NAMESPACE,"name");
                        var family = DOM_getAttributeNS(gc,STYLE_NAMESPACE,"family");
                        if ((name != null) && (family != null))
                            automaticStyles[name] = new ODFStyle(name,family,gc);
                    }
                }
            }
        }
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
    var OfficeFontFaceDecls_parse = trace(function _OfficeFontFaceDecls_parse(con)
    {
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            debug("OfficeFontFaceDecls_parse: child "+nodeString(child));
            if (child._is_style_font_face) {
                StyleFontFace_parse(child);
            }
        }
    });

    // office:styles
    var OfficeStyles_parse = trace(function _OfficeStyles_parse(con)
    {
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            debug("OfficeStyles_parse: child "+nodeString(child));
            if (child._is_style_style) {
                var name = DOM_getAttributeNS(child,STYLE_NAMESPACE,"name");
                var family = DOM_getAttributeNS(child,STYLE_NAMESPACE,"family");
                if ((name != null) && (family != null))
                    odfStyles[name] = new ODFStyle(name,family,child);
            }
        }
    });

    // office:automatic-styles
    var OfficeAutomaticStyles_parse = trace(function _OfficeAutomaticStyles_parse(con)
    {
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            debug("OfficeAutomaticStyles_parse: child "+nodeString(child));
        }
    });

    // office:master-styles
    var OfficeMasterStyles_parse = trace(function _OfficeMasterStyles_parse(con)
    {
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            debug("OfficeMasterStyles_parse: child "+nodeString(child));
        }
    });

    // office:document-styles
    var OfficeDocumentStyles_parse = trace(function _OfficeDocumentStyles_parse()
    {
        odfFontFaceDecls = new Object();
        odfStyles = new Object();
        odfAutomaticStyles = new Object();
        odfMasterStyles = new Object();

        var root = odf.styles.documentElement;
        debug("parseStyles: root = "+nodeString(root));
        debug("parseStyles: root.nodeName = "+root.nodeName);
        debug("parseStyles: root.namespaceURI = "+root.namespaceURI);
        debug("parseStyles: root.prefix = "+root.prefix);
        debug("parseStyles: root.localName = "+root.localName);

        if ((root.namespaceURI != OFFICE_NAMESPACE) ||
            (root.localName != "document-styles"))
            throw new ODFInvalidError("Invalid root element in styles.xml");

        for (var child = root.firstChild; child != null; child = child.nextSibling) {
            if (child._is_office_font_face_decls) {
                OfficeFontFaceDecls_parse(child);
            }
            else if (child._is_office_styles) {
                OfficeStyles_parse(child);
            }
            else if (child._is_office_automatic_styles) {
                OfficeAutomaticStyles_parse(child);
            }
            else if (child._is_office_master_styles) {
                OfficeMasterStyles_parse(child);
            }
        }


        debug("---------------------- OfficeDocumentStyles_parse BEGIN --------------------------");
        debug("odfStyles =");
        var names = Object.getOwnPropertyNames(odfStyles).sort();
        for (var i = 0; i < names.length; i++) {
            var style = odfStyles[names[i]];
            style.print("    ");
        }
        debug("---------------------- OfficeDocumentStyles_parse END --------------------------");
    });

    var loadDoc = trace(function _loadDoc(readFun,baseDir,filename)
    {
        var doc = readFun(baseDir+filename);
        if (doc == null)
            throw new ODFInvalidError("Cannot read "+filename);
        assignShorthandProperties(doc.documentElement);
        return doc;
    });

    ODF_initODF = trace(function initODF(filename)
    {
        odf = new Object();

        var baseDir;
        var readFun;
        if (filename == null) {
            baseDir = "";
            readFun = readFileApp;
        }
        else {
            baseDir = filename+"/";
            readFun = readFileTest;
        }
        odf.content = loadDoc(readFun,baseDir,"content.xml");
        odf.meta = loadDoc(readFun,baseDir,"meta.xml");
        odf.settings = loadDoc(readFun,baseDir,"settings.xml");
        odf.styles = loadDoc(readFun,baseDir,"styles.xml");

        OfficeDocumentStyles_parse();
        updateAutomaticStyles();

        convertToHTML();
    });

})();
