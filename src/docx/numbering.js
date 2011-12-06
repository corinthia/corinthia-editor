// http://msdn.microsoft.com/en-us/library/ee922775.aspx

(function() {

    function Level(abstractNumId,element)
    {
        this.abstractNumId = abstractNumId;
        this.ilvl = element.getAttributeNS(WORD_NAMESPACE,"ilvl");
        this.start = childVal(element,WORD_NAMESPACE,"start");
        this.numFmt = childVal(element,WORD_NAMESPACE,"numFmt");
        this.lvlText = childVal(element,WORD_NAMESPACE,"lvlText");
        this.lvlJc = childVal(element,WORD_NAMESPACE,"lvlJc");
        this.lvlText = childVal(element,WORD_NAMESPACE,"lvlText");
    }

    function AbstractNum(element)
    {
        this.levels = new Array();

        var abstractNumId = element.getAttributeNS(WORD_NAMESPACE,"abstractNumId");
        for (var child = element.firstChild; child != null; child = child.nextSibling) {
            if (isWordElement(child,"lvl")) {
                var ilvl = child.getAttributeNS(WORD_NAMESPACE,"ilvl");
                if (ilvl == null) {
                    warning("lvl element has no ilvl attribute");
                    continue;
                }
                this.levels[ilvl] = new Level(abstractNumId,child);
            }
        }
    }

    function processNumbering(filename)
    {
        var nums = new Array();

        var xml = filesystem.readXML(filename+"/word/numbering.xml");

        if (xml == null) // no numbering information specified
            return;

        var numberingElem = xml.documentElement;
        if (isWordElement(numberingElem,"numbering")) {

            // Find all the abstractNum elements
            var abstractNums = new Array();
            for (var child = numberingElem.firstChild; child != null; child = child.nextSibling) {
                if (isWordElement(child,"abstractNum")) {
                    var abstractNumId = child.getAttributeNS(WORD_NAMESPACE,"abstractNumId");
                    if (abstractNumId == null) {
                        warning("abstractNum element has no abstractNumId attribute");
                        continue;
                    }
                    abstractNums[abstractNumId] = new AbstractNum(child);
                }
            }

            // Find all the num elements
            for (var child = numberingElem.firstChild; child != null; child = child.nextSibling) {
                if (isWordElement(child,"num")) {
                    var numId = child.getAttributeNS(WORD_NAMESPACE,"numId");
                    if (numId == null) {
                        warning("num element has no numId attribute");
                        continue;
                    }
                    var abstractNumId = childVal(child,WORD_NAMESPACE,"abstractNumId");
                    if (abstractNumId == null) {
                        warning("num element has no abstractNumId");
                        continue;
                    }
                    var abstractNum = abstractNums[abstractNumId];
                    if (abstractNum == null) {
                        warning("Cannot find abstractNum with id "+abstractNumId);
                        continue;
                    }
                    nums[numId] = abstractNum;
                }
            }
        }
        return nums;
    }

    window.processNumbering = processNumbering;

})();
