(function() {
    function processStyles(filename)
    {
        var stylesFilename = filename+"/word/styles.xml";
        var xml = filesystem.readXML(stylesFilename);

        if (xml == null)
            throw new Error("Could not load "+stylesFilename);

        return new DOCXStyleCollection(xml.documentElement);
    }

    window.processStyles = processStyles;
})();
