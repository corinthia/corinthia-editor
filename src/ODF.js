var ODF_updateFromHTML;
var ODF_contentXML;
var ODF_metaXML;
var ODF_settingsXML;
var ODF_stylesXML;
var ODF_initODF;

(function() {

    var odf = new Object();

    var OFFICE_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:office:1.0";
    var STYLE_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:style:1.0";
    var TEXT_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
    var TABLE_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:table:1.0";
    var FO_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0";
    var nextODFId = 0;
    var automaticStyles = null;

    function ODFStyle(name,family,node)
    {
        var style = this;
        this.name = name;
        this.family = family;
        this.node = node;
        this.cssProperties = new Object();

        var tpr = node._child_style_text_properties;
        if (tpr != null) {
            var fontWeight = tpr.getAttributeNS(FO_NAMESPACE,"font-weight");
            var fontStyle = tpr.getAttributeNS(FO_NAMESPACE,"font-style");
            var textUnderLineStyle =
                tpr.getAttributeNS(STYLE_NAMESPACE,"text-underline-style");
            var fontSize = tpr.getAttributeNS(FO_NAMESPACE,"font-size");
            var color = tpr.getAttributeNS(FO_NAMESPACE,"color");
            var backgroundColor =
                tpr.getAttributeNS(FO_NAMESPACE,"background-color");

            if (fontWeight == "bold")
                this.cssProperties["font-weight"] = "bold";
            if (fontStyle == "italic")
                this.cssProperties["font-style"] = "italic";
            if (textUnderLineStyle == "solid")
                this.cssProperties["text-decoration"] = "underline";
            if ((fontSize != null) && fontSize.match(/[0-9\.]+pt/))
                this.cssProperties["font-size"] = fontSize;
            if ((color != null) && (color != ""))
                this.cssProperties["color"] = color;
            if ((backgroundColor != null) && (backgroundColor != ""))
                this.cssProperties["background-color"] = backgroundColor;
        }

        var ppr = node._child_style_paragraph_properties;
        if (ppr != null) {
            var textAlign = ppr.getAttributeNS(FO_NAMESPACE,"text-align");

            var shadow = ppr.getAttributeNS(FO_NAMESPACE,"shadow");

            if ((textAlign != null) && (textAlign != ""))
                this.cssProperties["text-align"] = textAlign;


            processBorder("border");
            processBorder("border-left");
            processBorder("border-right");
            processBorder("border-top");
            processBorder("border-bottom");

            function processBorder(prefix)
            {
                var value = ppr.getAttributeNS(FO_NAMESPACE,prefix);
                if ((value != null) && (value != "")) {
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
            }
        }


        var names = Object.getOwnPropertyNames(this.cssProperties).sort();
        debug("Style "+this.name+" ("+this.family+")");
        for (var i = 0; i < names.length; i++) {
            debug("    "+names[i]+" = "+this.cssProperties[names[i]]);
        }
    }

    // text:span
    var TextSpan_get = trace(function _TextSpan_get(con)
    {
        var span = DOM_createElement(document,"SPAN");
        span._source = con;
        DOM_setAttribute(span,"id","odf"+nextODFId++);

        var styleName = con.getAttributeNS(TEXT_NAMESPACE,"style-name");
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
            var levelStr = con.getAttributeNS(TEXT_NAMESPACE,"outline-level");
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

        var styleName = con.getAttributeNS(TEXT_NAMESPACE,"style-name");
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

    function assignShorthandProperties(node)
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
    }

    function updateAutomaticStyles()
    {
        automaticStyles = new Object();
        var root = odf.content.documentElement;
        for (var child = root.firstChild; child != null; child = child.nextSibling) {
            if (child._is_office_automatic_styles) {
                for (gc = child.firstChild; gc != null; gc = gc.nextSibling) {
                    if (gc._is_style_style) {
                        var name = gc.getAttributeNS(STYLE_NAMESPACE,"name");
                        var family = gc.getAttributeNS(STYLE_NAMESPACE,"family");
                        if ((name != null) && (family != null))
                            automaticStyles[name] = new ODFStyle(name,family,gc);
                    }
                }
            }
        }
    }

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
        odf.content = readFun(baseDir+"content.xml");
        odf.meta = readFun(baseDir+"meta.xml");
        odf.settings = readFun(baseDir+"settings.xml");
        odf.styles = readFun(baseDir+"styles.xml");

        if (odf.content == null)
            throw new Error("Cannot read content.xml")
        if (odf.meta == null)
            throw new Error("Cannot read meta.xml")
        if (odf.settings == null)
            throw new Error("Cannot read settings.xml")
        if (odf.styles == null)
            throw new Error("Cannot read styles.xml")

        assignShorthandProperties(odf.content.documentElement);
        assignShorthandProperties(odf.meta.documentElement);
        assignShorthandProperties(odf.settings.documentElement);
        assignShorthandProperties(odf.styles.documentElement);
        updateAutomaticStyles();

//        DOM_appendChild(document.body,DOM_createTextNode(document,"ODF document"));

        convertToHTML();
    });

})();
