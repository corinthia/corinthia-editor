var ODF_updateFromHTML;
var ODF_contentXML;
var ODF_metaXML;
var ODF_settingsXML;
var ODF_stylesXML;
var ODF_initODF;

(function() {

    var odf = new Object();

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

        DOM_appendChild(document.body,DOM_createTextNode(document,"ODF document"));
    });

})();
