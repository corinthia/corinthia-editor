var ODF_updateFromHTML;
var ODF_contentXML;
var ODF_metaXML;
var ODF_settingsXML;
var ODF_stylesXML;
var ODF_initODF;

var ODF_contentDoc;
var ODF_metaDoc;
var ODF_settingsDoc;
var ODF_stylesDoc;

function ODFInvalidError(msg)
{
    this.msg = msg;
    this.custom = true;
}

ODFInvalidError.prototype.toString = function() {
    return this.msg;
};

(function() {

    var convertToHTML = trace(function convertToHTML()
    {
        Selection_clear();

        var absHTML = OfficeDocumentContent_get(ODF_contentDoc.documentElement);;

        var absHead = null;
        var absBody = null;
        for (var child = absHTML.firstChild; child != null; child = child.nextSibling) {
            if (DOM_upperName(child) == "HEAD")
                absHead = child;
            else if (DOM_upperName(child) == "BODY")
                absBody = child;
        }

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
                                  ODF_contentDoc.documentElement);
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
        return serialize(ODF_contentDoc);
    });

    ODF_metaXML = trace(function metaXML()
    {
        return serialize(ODF_metaDoc);
    });

    ODF_settingsXML = trace(function settingsXML()
    {
        return serialize(ODF_settingsDoc);
    });

    ODF_stylesXML = trace(function stylesXML()
    {
        return serialize(ODF_stylesDoc);
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

        ODF_contentDoc = loadDoc(readFun,baseDir,"content.xml");
        ODF_metaDoc = loadDoc(readFun,baseDir,"meta.xml");
        ODF_settingsDoc = loadDoc(readFun,baseDir,"settings.xml");
        ODF_stylesDoc = loadDoc(readFun,baseDir,"styles.xml");


        OfficeDocumentStyles_parseStyles(ODF_stylesDoc.documentElement);
        OfficeDocumentContent_parseStyles(ODF_contentDoc.documentElement);
        convertToHTML();

        Styles_discoverStyles();
        PostponedActions_perform();
    });

})();
