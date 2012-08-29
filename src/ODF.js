var ODF_updateFromHTML;
var ODF_contentXML;
var ODF_metaXML;
var ODF_settingsXML;
var ODF_stylesXML;
var ODF_initODF;

(function() {

    var odf = new Object();
    var documentLens;

    var OFFICE_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:office:1.0";
    var STYLE_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:style:1.0";
    var TEXT_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
    var TABLE_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:table:1.0";
    var nextODFId = 0;

    // Corresponds to text:span
    function TextSpanLens()
    {
    }

    TextSpanLens.prototype.get = trace(function TextSpanLens_get(con)
    {
        var span = DOM_createElement(document,"SPAN");
        DOM_setAttribute(span,"id","odf"+nextODFId++);
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child.nodeType == Node.TEXT_NODE) {
                DOM_appendChild(span,DOM_createTextNode(document,child.nodeValue));
            }
        }
        return span;
    });

    // Corresponds to text:p
    function TextPLens()
    {
        this.spanLens = new TextSpanLens();
    }

    TextPLens.prototype.get = trace(function TextPLens_get(con)
    {
        var p = DOM_createElement(document,"P");
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child.nodeType == Node.TEXT_NODE) {
                var span = DOM_createElement(document,"SPAN");
                DOM_setAttribute(span,"id","odf"+nextODFId++);
                DOM_appendChild(span,DOM_createTextNode(document,child.nodeValue));
                DOM_appendChild(p,span);
            }
            else if (child._is_text_span) {
                DOM_appendChild(p,this.spanLens.get(child));
            }
        }
        return p;
    });

    // Corresponds to office:text
    function OfficeTextLens()
    {
        this.pLens = new TextPLens();
    }

    OfficeTextLens.prototype.get = trace(function OfficeTextLens_get(con)
    {
        var body = DOM_createElement(document,"BODY");
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child._is_text_p || child._is_text_h) {
                DOM_appendChild(body,this.pLens.get(child));
            }
        }
        return body;
    });

    // Corresponds to office:body
    function OfficeBodyLens()
    {
        this.textLens = new OfficeTextLens();
    }

    OfficeBodyLens.prototype.get = trace(function OfficeBodyLens_get(con)
    {
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child._is_office_text) {
                return this.textLens.get(child);
            }
        }
        throw new Error("office:text element not found");
    });

    // Corresponds to office:document-content
    function OfficeDocumentContentLens()
    {
        this.bodyLens = new OfficeBodyLens();
    }

    OfficeDocumentContentLens.prototype.get = trace(function OfficeDocumentContentLens_get(con)
    {
        debug("OfficeDocumentContentLens get: con = "+nodeString(con));
        var abs = DOM_createElement(document,"HTML");
        abs._source = con;
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child._is_office_body) {
                DOM_appendChild(abs,this.bodyLens.get(child));
            }
        }
        return abs;
    });

    var convertToHTML = trace(function convertToHTML()
    {
        debug("convertToHTML: documentLens = "+documentLens);
        var html = documentLens.get(odf.content.documentElement);;

        var body = html.firstChild;
        var next;
        for (var child = body.firstChild; child != null; child = next) {
            next = child.nextSibling;
            DOM_appendChild(document.body,child);
        }


        debug("------------------- convertToHTML BEGIN ----------------------");
        printTree(document.documentElement);
        debug("------------------- convertToHTML END ----------------------");

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

    function assignShorthandProperties(node)
    {
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            assignShorthandProperties(child);
        if (node.nodeType == Node.ELEMENT_NODE) {
            if (node.namespaceURI == OFFICE_NAMESPACE)
                node["_is_office_"+node.localName] = true;
            else if (node.namespaceURI == STYLE_NAMESPACE)
                node["_is_style_"+node.localName] = true;
            else if (node.namespaceURI == TEXT_NAMESPACE)
                node["_is_text_"+node.localName] = true;
            else if (node.namespaceURI == TABLE_NAMESPACE)
                node["_is_table_"+node.localName] = true;
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

//        DOM_appendChild(document.body,DOM_createTextNode(document,"ODF document"));

        documentLens = new OfficeDocumentContentLens();
        convertToHTML();

    });

})();
