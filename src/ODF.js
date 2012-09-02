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





    var odfSourceById = new Object();
    var nextODFId = 0;

    var addSourceMapping = trace(function _addSourceMapping(abs,con)
    {
        var id = "odf"+nextODFId;
        odfSourceById[id] = con;
        DOM_setAttribute(abs,"id",id);
        nextODFId++;
    });

    var lookupSourceMapping = trace(function _lookupSourceMapping(abs)
    {
        if (abs.nodeType != Node.ELEMENT_NODE)
            return null;
        var id = DOM_getAttribute(abs,"id");
        if (id == null)
            return id;
        else
            return odfSourceById[id];
    });

    var OFFICE_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:office:1.0";
    var STYLE_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:style:1.0";
    var TEXT_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
    var TABLE_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:table:1.0";
    var FO_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0";
    var SVG_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0";
    var XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";

    var OFFICE_PREFIX = "office:";
    var STYLE_PREFIX = "style:";
    var TEXT_PREFIX = "text:";
    var TABLE_PREFIX = "table:";
    var FO_PREFIX = "fo:";
    var SVG_PREFIX = "svg:";
    var XLINK_PREFIX = "xlink:";

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

    ODFStyle.prototype.print = function(indent)
    {
        var names = Object.getOwnPropertyNames(this.cssProperties).sort();
        debug(indent+"Style "+this.name+" ("+this.family+"); selector "+this.selector);
        for (var i = 0; i < names.length; i++) {
            debug(indent+"    "+names[i]+" = "+this.cssProperties[names[i]]);
        }
    }

    ODFStyle_getCSSText = trace(function _ODFStyle_getCSSText(style)
    {
        debug("getting CSS text for "+style.selector);
        return style.selector+" {\n"+Styles_getPropertiesText(style.cssProperties)+"}\n";
    });

/*
    var ParagraphContentOrHyperlink_getChild = trace(
        function _ParagraphContentOrHyperlink_getChild(con)
    {
        return ParagraphContent_get(con);
    });
*/

    var TextA_get = trace(function _TextA_get(con)
    {
        var href = DOM_getStringAttributeNS(con,XLINK_NAMESPACE,"href");
        var abs = DOM_createElement(document,"A");
        DOM_setAttribute(abs,"href",href);
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            var childAbs = ParagraphContent_getChild(child);
            if (childAbs != null)
                DOM_appendChild(abs,childAbs);
        }
        return abs;
    });

    var ParagraphContentOrHyperlink_getChild =
        trace(function _ParagraphContentOrHyperlink_getChild(con)
    {
        if (con._is_text_a)
            return TextA_get(con);
        else
            return ParagraphContent_getChild(con);
    });

    var ParagraphContent_getChild = trace(function _ParagraphContent_getChild(con)
    {
        if (con.nodeType == Node.TEXT_NODE)
            return DOM_createTextNode(document,con.nodeValue);
        else if (con._is_text_span)
            return TextSpan_get(con);
        else
            return null;
    });

    // text:span
    var TextSpan_get = trace(function _TextSpan_get(con)
    {
        var span = DOM_createElement(document,"SPAN");
        addSourceMapping(span,con);

        // ODF Spec: in the context of <text:span>, the text:style-name attribute specifies style
        // for span which shall be a style with family of text.
        var styleName = DOM_getAttributeNS(con,TEXT_NAMESPACE,"style-name");
        if (automaticStyles[styleName] != null)
            DOM_setStyleProperties(span,automaticStyles[styleName].cssProperties);
        else
            DOM_setAttribute(span,"class",styleName);

        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            var childAbs = ParagraphContentOrHyperlink_getChild(child);
            if (childAbs != null)
                DOM_appendChild(span,childAbs);
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
        addSourceMapping(p,con);

        var styleName = DOM_getAttributeNS(con,TEXT_NAMESPACE,"style-name");
        if (automaticStyles[styleName] != null)
            DOM_setStyleProperties(p,automaticStyles[styleName].cssProperties);
        else
            DOM_setAttribute(p,"class",styleName);

        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            var childAbs = ParagraphContentOrHyperlink_getChild(child);
            if (childAbs != null)
                DOM_appendChild(p,childAbs);
        }
        return p;
    });

    var TextListItem_get = trace(function _TextListItem_get(con)
    {
        var li = DOM_createElement(document,"LI");
        addSourceMapping(li,con);
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child._is_text_p || child._is_text_h)
                DOM_appendChild(li,TextPH_get(child));
            else if (child._is_text_list)
                DOM_appendChild(li,TextList_get(child));
        }
        return li;
    });

    var TextList_get = trace(function _TextList_get(con)
    {
        // All attributes are optional
        var styleName = DOM_getAttributeNS(con,TEXT_NAMESPACE,"style-name");
        var continueNumbering = DOM_getAttributeNS(con,TEXT_NAMESPACE,"continue-numbering");
        var continueList = DOM_getAttributeNS(con,TEXT_NAMESPACE,"continue-list");

        var ul = DOM_createElement(document,"UL");
        addSourceMapping(ul,con);
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child._is_text_list_item) {
                DOM_appendChild(ul,TextListItem_get(child));
            }
        }
        return ul;
    });

    var TableTableCell_get = trace(function _TableTableCell_get(con)
    {
        var td = DOM_createElement(document,"TD");
        addSourceMapping(td,con);
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            var childAbs = DefTextContentChild_get(child);
            if (childAbs != null)
                DOM_appendChild(td,childAbs);
        }
        return td;
    });

    var TableTableRow_get = trace(function _TableTableRow_get(con)
    {
        var tr = DOM_createElement(document,"TR");
        addSourceMapping(tr,con);
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child._is_table_table_cell)
                DOM_appendChild(tr,TableTableCell_get(child));
        }
        return tr;
    });

    var TableTable_get = trace(function _TableTable_get(con)
    {
        var table = DOM_createElement(document,"TABLE");
        addSourceMapping(table,con);

        var tableTitle = null;
        var tableDesc = null;
        var tableSource = null;

        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child._is_table_title) {
                tableTitle = getNodeText(child);
            }
            else if (child._is_table_desc) {
                tableDesc = getNodeText(child);
            }
            else if (child._is_table_table_row) {
                DOM_appendChild(table,TableTableRow_get(child));
            }
        }
        return table;
    });

    var DefTextContentChild_get = trace(function _DefTextContentChild_get(con)
    {
        if (con._is_text_p || con._is_text_h)
            return TextPH_get(con);
        else if (con._is_text_list)
            return TextList_get(con);
        else if (con._is_table_table)
            return TableTable_get(con);
        else
            return null;
    });

    // office:text
    var OfficeText_get = trace(function _OfficeText_get(con)
    {
        var body = DOM_createElement(document,"BODY");
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            var childAbs = DefTextContentChild_get(child);
            if (childAbs != null)
                DOM_appendChild(body,childAbs);
        }
        return body;
    });

    var OfficeTextChild_isVisible = trace(function _OfficeTextChild_isVisible(con)
    {
        return (con._is_text_p || con._is_text_h);
    });

    var OfficeTextChild_put = trace(function _OfficeTextChild_put(abs,con)
    {
        debug("OfficeTextChild_put "+JSON.stringify(getNodeText(abs)));
        DOM_deleteAllChildren(con);
        DOM_appendChild(con,DOM_createTextNode(odf.content,getNodeText(abs)));
    });

    var OfficeTextChild_create = trace(function _OfficeTextChild_create(abs)
    {
        if (isParagraphNode(abs)) {
            debug("OfficeTextChild_create "+JSON.stringify(getNodeText(abs)));
            var text_p = DOM_createElementNS(odf.content,TEXT_NAMESPACE,TEXT_PREFIX+"p");
            DOM_appendChild(text_p,DOM_createTextNode(odf.content,getNodeText(abs)));
            return text_p;
        }
        else {
            return null;
        }
    });

    var OfficeTextChildLens = {
        isVisible: OfficeTextChild_isVisible,
        put: OfficeTextChild_put,
        create: OfficeTextChild_create,
        getSource: lookupSourceMapping,
    };


    var OfficeText_put = trace(function _OfficeText_put(abs,con)
    {
        debug("OfficeBody_put: abs = "+nodeString(abs));
        debug("OfficeBody_put: con = "+nodeString(con));
        BDT_Container_put(abs,con,OfficeTextChildLens);
    });

    // office:body
    var OfficeBody_get = trace(function _OfficeBody_get(con)
    {
        if (con._child_office_text == null)
            throw new ODFInvalidError("Not an ODF word processing document");
        return OfficeText_get(con._child_office_text);
    });

    var OfficeBody_put = trace(function _OfficeBody_put(abs,con)
    {
        OfficeText_put(abs,con._child_office_text);
    });

    // office:document-content
    var OfficeDocumentContent_get = trace(function _OfficeDocumentContent_get(con)
    {
        if ((con.namespaceURI != OFFICE_NAMESPACE) || (con.localName != "document-content"))
            throw new ODFInvalidError("Invalid root element in content.xml");

        if (con._child_office_body == null)
            throw new ODFInvalidError("No office:body element in content.xml");

        var html = DOM_createElement(document,"HTML");


        var head = DOM_createElement(document,"HEAD");
        var style = DOM_createElement(document,"STYLE");
        var styleContent = getODFStylesText();
        DOM_appendChild(style,DOM_createTextNode(document,styleContent));
        DOM_appendChild(head,style);
        DOM_appendChild(html,head);

        DOM_appendChild(html,OfficeBody_get(con._child_office_body));
        return html;
    });

    var OfficeDocumentContent_put = trace(function _OfficeDocumentContent_update(abs,con)
    {
        var body = null;
        for (var child = abs.firstChild; child != null; child = child.nextSibling) {
            if (DOM_upperName(child) == "BODY") {
                body = child;
                break;
            }
        }

        if (body == null)
            throw new Error("Could not find body element");
        OfficeBody_put(body,con._child_office_body);
    });

    var convertToHTML = trace(function convertToHTML()
    {
        Selection_clear();

        var absHTML = OfficeDocumentContent_get(odf.content.documentElement);;

        var absHead = null;
        var absBody = null;
        for (var child = absHTML.firstChild; child != null; child = child.nextSibling) {
            if (DOM_upperName(child) == "HEAD")
                absHead = child;
            else if (DOM_upperName(child) == "BODY")
                absBody = child;
        }

//        DOM_deleteAllChildren(document.head);
//        DOM_deleteAllChildren(document.body);

        if (absHead != null) {
            while (absHead.firstChild != null)
                DOM_appendChild(document.head,absHead.firstChild);
        }

        if (absBody != null) {
            while (absBody.firstChild != null)
                DOM_appendChild(document.body,absBody.firstChild);
        }

        return true;
    });

    ODF_updateFromHTML = trace(function updateFromHTML()
    {
        OfficeDocumentContent_put(document.documentElement,
                                  odf.content.documentElement);
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
    });

    function getODFStylesText()
    {
        var strings = new Array();
        var names = Object.getOwnPropertyNames(odfStyles).sort();
        for (var i = 0; i < names.length; i++) {
            var style = odfStyles[names[i]];
            strings.push(ODFStyle_getCSSText(style));
        }
        return strings.join("");
    }

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

        Styles_discoverStyles();
        PostponedActions_perform();
    });

})();
