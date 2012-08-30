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
