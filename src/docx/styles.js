function mergeCSSProperties(cssProperties)
{
    mergeVals("border-left",["border-left-width","border-left-style","border-left-color"]);
    mergeVals("border-right",["border-right-width","border-right-style","border-right-color"]);
    mergeVals("border-top",["border-top-width","border-top-style","border-top-color"]);
    mergeVals("border-bottom",["border-bottom-width","border-bottom-style","border-bottom-color"]);

    mergeIdentical("border",["border-left","border-right","border-top","border-bottom"]);

    function mergeIdentical(combined,names)
    {
        for (var i = 0; i < names.length; i++) {
            if (cssProperties[names[i]] == null)
                return;
            if (cssProperties[names[i]] != cssProperties[names[0]])
                return;
        }
        cssProperties[combined] = cssProperties[names[0]];
        for (var i = 0; i < names.length; i++)
            delete cssProperties[names[i]];
    }

    function mergeVals(combined,names)
    {
        var values = new Array();
        for (var i = 0; i < names.length; i++) {
            if (cssProperties[names[i]] != null) {
                values.push(cssProperties[names[i]]);
                delete cssProperties[names[i]];
            }
        }
        if (values.length > 0) {
            cssProperties[combined] = values.join(" ");
        }
    }
}

function cssPropertiesText(cssProperties)
{
    var props = new Array();
    for (var name in cssProperties)
        props.push(name+": "+cssProperties[name]);
    if (props.length > 0)
        return props.join("; ");
    else
        return null;
}

function cssRuleText(selector,cssProperties)
{
    var names = new Array();
    for (name in cssProperties) {
//        if (name.indexOf("word-") != 0)
            names.push(name);
    }
    names.sort();

    var str = selector+" {\n";
    for (var i = 0; i < names.length; i++) {
        str += "    "+names[i]+": "+cssProperties[names[i]];
        str += ";\n";
    }
    str += "}\n";
    return str;
}

(function() {

    function TableStyleProperties(element)
    {
        this.pPr = null;
        this.rPr = null;
        this.tcPr = null;

        for (var child = element.firstChild; child != null; child = child.nextSibling) {
            if (child.namespaceURI == WORD_NAMESPACE) {
                if (child.localName == "pPr")
                    this.pPr = new DOCXParagraphProperties(child);
                else if (child.localName == "rPr")
                    this.rPr = new DOCXRunProperties(child);
                else if (child.localName == "tcPr")
                    this.tcPr = new DOCXCellProperties(child);
            }
        }
    }

    TableStyleProperties.prototype.applyCSSProperties = function(cssProperties)
    {
        if (this.pPr != null)
            this.pPr.applyCSSProperties(cssProperties);
        if (this.rPr != null)
            this.rPr.applyCSSProperties(cssProperties);
        if (this.tcPr != null)
            this.tcPr.applyCSSProperties(cssProperties);
    }

    TableStyleProperties.prototype.applyCellCSSProperties = function(cssProperties)
    {
        if (this.tcPr != null)
            this.tcPr.applyCSSProperties(cssProperties);
    }

    function Style(styleId,element)
    {
        this.styleId = styleId;
        this.computedCascade = false;
        this.parent = null;
        this.newProperties = null;

        this.name = null;
        this.basedOn = null;
        this.paragraphProperties = null;
        this.runProperties = null;
        this.tableProperties = null;
        this.cellProperties = null;
        this.tableStyleProperties = new Object();
        this.type = null;

        if (element.hasAttributeNS(WORD_NAMESPACE,"type"))
            this.type = element.getAttributeNS(WORD_NAMESPACE,"type");

        for (var child = element.firstChild; child != null; child = child.nextSibling) {
            if (child.namespaceURI == WORD_NAMESPACE) {
                if (child.localName == "name")
                    this.name = child.getAttributeNS(WORD_NAMESPACE,"val");
                else if (child.localName == "basedOn")
                    this.basedOn = child.getAttributeNS(WORD_NAMESPACE,"val");
                else if (child.localName == "pPr")
                    this.paragraphProperties = new DOCXParagraphProperties(child);
                else if (child.localName == "rPr")
                    this.runProperties = new DOCXRunProperties(child);
                else if (child.localName == "tblPr")
                    this.tableProperties = new DOCXTableProperties(child);
                else if (child.localName == "tcPr")
                    this.cellProperties = new DOCXCellProperties(child);
                else if (child.localName == "tblStylePr") {
                    var type = child.getAttributeNS(WORD_NAMESPACE,"type");
                    this.tableStyleProperties[type] = new TableStyleProperties(child);
                }
            }
        }
    }

    Style.prototype.print = function(indent)
    {
        if (this.name != null)
            debug(indent+"Name: "+this.name);
        if (this.basedOn != null)
            debug(indent+"Based on: "+this.basedOn);
        if (this.paragraphProperties != null) {
            debug(indent+"Paragraph properties:");
            this.paragraphProperties.print(indent+"    ");
        }
        if (this.runProperties != null) {
            debug(indent+"Run properties:");
            this.runProperties.print(indent+"    ");
        }
        if (this.tableProperties != null) {
            debug(indent+"Table properties:");
            this.tableProperties.print(indent+"    ");
        }
    }

    Style.prototype.applyCSSProperties = function(cssProperties)
    {
        if (this.parent != null)
            this.parent.applyCSSProperties(cssProperties);
        if (this.paragraphProperties != null)
            this.paragraphProperties.applyCSSProperties(cssProperties);
        if (this.runProperties != null)
            this.runProperties.applyCSSProperties(cssProperties);
        if (this.tableProperties != null)
            this.tableProperties.applyCSSProperties(cssProperties);
        if (this.cellProperties != null)
            this.cellProperties.applyCSSProperties(cssProperties);
    }

    Style.prototype.applyTableStyleCSSProperties = function(type,cssProperties)
    {
        if (this.parent != null)
            this.parent.applyTableStyleCSSProperties(type,cssProperties);
        if (this.tableStyleProperties[type] != null)
            this.tableStyleProperties[type].applyCSSProperties(cssProperties);
    }

    Style.prototype.computeCascadedProperties = function(styleCollection,indent)
    {
        if (this.computedCascade)
            return;
        this.computedCascade = true;

        if (this.basedOn != null) {
            this.parent = styleCollection.styles[this.basedOn];
            if (this.parent == null)
                warning("Style "+this.styleId+" has non-existant parent "+this.basedOn);
            this.parent.computeCascadedProperties(styleCollection,indent+"    ");
        }

        if (this.parent != null) {
        }
    }

    Style.prototype.hasTableStyleType = function(type)
    {
        if (this.tableStyleProperties[type] != null)
            return true;

        if (this.parent != null)
            return this.parent.hasTableStyleType(type);
        else
            return null;
    }

    function StyleCollection(stylesElem)
    {
        this.styles = new Object();

        if (isWordElement(stylesElem,"styles")) {
            for (var child = stylesElem.firstChild; child != null; child = child.nextSibling) {
                if (isWordElement(child,"style")) {
                    var styleId = child.getAttributeNS(WORD_NAMESPACE,"styleId");
                    if (styleId == null) {
                        warning("style element has no styleId");
                        continue;
                    }
                    this.styles[styleId] = new Style(styleId,child);
                }
            }
        }

        this.computeCascadedProperties();
    }

    function extractCellProperties(cssProperties)
    {
        var cellCSSProperties = new Object();
        var haveCellProperties = false;
        var remove = new Array();
        for (name in cssProperties) {
            if (name.indexOf("word-insideH-") == 0) {
                cellCSSProperties["border-top-"+name.substring(13)] = cssProperties[name];
                cellCSSProperties["border-bottom-"+name.substring(13)] = cssProperties[name];
                haveCellProperties = true;
                remove.push(name);
            }
            else if (name.indexOf("word-insideV-") == 0) {
                cellCSSProperties["border-left-"+name.substring(13)] = cssProperties[name];
                cellCSSProperties["border-right-"+name.substring(13)] = cssProperties[name];
                haveCellProperties = true;
                remove.push(name);
            }
        }
        for (var i = 0; i < remove.length; i++)
            delete cssProperties[remove[i]];
        if (haveCellProperties)
            return cellCSSProperties;
        else
            return null;
    }

    StyleCollection.prototype.computeCascadedProperties = function()
    {
        for (var name in this.styles)
            this.styles[name].computeCascadedProperties(this,"");
    }

    StyleCollection.prototype.toCSSStyleSheet = function()
    {
        var cssText = "";

        var styleIds = new Array();
        for (var styleId in this.styles)
            styleIds.push(styleId);
        styleIds.sort();
        for (var s = 0; s < styleIds.length; s++) {
            var styleId = styleIds[s];
            var style = this.styles[styleId];

            var cssProperties = new Object();

            style.applyCSSProperties(cssProperties);


            mergeCSSProperties(cssProperties);
            cssText += "\n\n\n/* "+style.styleId+" ("+style.type+") */\n\n";

            var baseSelector;
            if (style.type == "table")
                baseSelector = "table."+styleId;
            else
                baseSelector = "."+styleId;;

            var cellCSSProperties = extractCellProperties(cssProperties);
            cssText += cssRuleText(baseSelector,cssProperties);

            // Special case: border properties set on a table style also apply to its children
            if (cellCSSProperties != null) {
                mergeCSSProperties(cellCSSProperties);
                cssText += cssRuleText(baseSelector+" > tbody > tr > *",cellCSSProperties);

                if ((style.hasTableStyleType("nwCell") || style.hasTableStyleType("neCell")) &&
                    !style.hasTableStyleType("firstRow"))
                    cssText += cssRuleText(baseSelector+" > thead > tr > *",cellCSSProperties);

                if ((style.hasTableStyleType("swCell") || style.hasTableStyleType("seCell")) &&
                    !style.hasTableStyleType("lastRow"))
                    cssText += cssRuleText(baseSelector+" > tfoot > tr > *",cellCSSProperties);

                cssText += baseSelector+" > tbody > tr > td:first-of-type { border-left: none }\n"
                cssText += baseSelector+" > tbody > tr > td:last-of-type { border-right: none }\n"
                cssText += baseSelector+" > tbody > tr:first-of-type > td { border-top: none }\n"
                cssText += baseSelector+" > tbody > tr:last-of-type > td { border-bottom: none }\n"
            }

            // Banded rows and columns
            var baseHBand = baseSelector+"[hband=\"true\"]";
            var baseVBand = baseSelector+"[vband=\"true\"]";
            cssText +=
            tableStyleCSS2(style,                                                        // style
                           "band1Horz",                                                  // type
                           baseHBand+" > tbody > tr:nth-child(odd)",                     // selector
                           baseHBand+" > tbody > tr:nth-child(odd) > td",                // cell
                           null,                                                         // top
                           null,                                                         // bottom
                           baseHBand+" > tbody > tr:nth-child(odd) > td:first-child",    // left
                           baseHBand+" > tbody > tr:nth-child(odd) > td:last-child",     // right
                           false,                                                 // allowInsideH
                           true);                                                 // allowInsideV

            cssText +=
            tableStyleCSS2(style,                                                        // style
                           "band2Horz",                                                  // type
                           baseHBand+" > tbody > tr:nth-child(even)",                    // selector
                           baseHBand+" > tbody > tr:nth-child(even) > td",               // cell
                           null,                                                         // top
                           null,                                                         // bottom
                           baseHBand+" > tbody > tr:nth-child(even) > td:first-child",   // left
                           baseHBand+" > tbody > tr:nth-child(even) > td:last-child",    // right
                           false,                                                 // allowInsideH
                           true) ;                                                // allowInsideV


            cssText +=
            tableStyleCSS2(style,                                                     // style
                           "band1Vert",                                               // type
                           baseVBand+" > tbody > tr > td:nth-of-type(odd)",           // selector
                           null,                                                      // cell
                           baseVBand+" > tbody > tr:first-child > td:nth-of-type(odd)",// top
                           baseVBand+" > tbody > tr:last-child > td:nth-of-type(odd)",// bottom
                           null,                                                      // left
                           null,                                                      // right
                           "visible-only",                                        // allowInsideH
                           false);                                                // allowInsideV

            cssText +=
            tableStyleCSS2(style,                                                     // style
                           "band2Vert",                                               // type
                           baseVBand+" > tbody > tr > td:nth-of-type(even)",          // selector
                           null,                                                      // cell
                           baseVBand+" > tbody > tr:first-child > td:nth-of-type(even)",// top
                           baseVBand+" > tbody > tr:last-child > td:nth-of-type(even)",// bottom
                           null,                                                      // left
                           null,                                                      // right
                           "visible-only",                                        // allowInsideH
                           false);                                                // allowInsideV

            // Edges
            cssText +=
            tableStyleCSS2(style,                                                     // style
                           "firstRow",                                                // type
                           baseSelector+" > thead",                                   // selector
                           baseSelector+" > thead > tr > *",                         // cell
                           null,                                                      // top
                           null,                                                      // bottom
                           baseSelector+" > thead > tr > *:first-child",             // left
                           baseSelector+" > thead > tr > *:last-child",              // right
                           false,                                                 // allowInsideH
                           true);                                                 // allowInsideV

            cssText +=
            tableStyleCSS2(style,                                                     // style
                           "lastRow",                                                 // type
                           baseSelector+" > tfoot",                                   // selector
                           baseSelector+" > tfoot > tr > *",                         // cell
                           null,                                                      // top
                           null,                                                      // bottom
                           baseSelector+" > tfoot > tr > *:first-child",             // left
                           baseSelector+" > tfoot > tr > *:last-child",              // right
                           false,                                                 // allowInsideH
                           true);                                                 // allowInsideV

            cssText +=
            tableStyleCSS2(style,                                                     // style
                           "firstCol",                                                // type
                           baseSelector+" > tbody > tr > th:first-child",             // selector
                           null,                                                      // cell
                           baseSelector+" > tbody > tr:first-child > th:first-child", // top
                           baseSelector+" > tbody > tr:last-child > th:first-child",  // bottom
                           null,                                                      // left
                           null,                                                      // right
                           "visible-only",                                        // allowInsideH
                           false);                                                // allowInsideV

            cssText +=
            tableStyleCSS2(style,                                                     // style
                           "lastCol",                                                 // type
                           baseSelector+" > tbody > tr > th:last-child",              // selector
                           null,                                                      // cell
                           baseSelector+" > tbody > tr:first-child > th:last-child",  // top
                           baseSelector+" > tbody > tr:last-child > th:last-child",   // bottom
                           null,                                                      // left
                           null,                                                      // right
                           "visible-only",                                        // allowInsideH
                           false);                                                // allowInsideV

            // Corners

            cssText +=
            tableStyleCSS2(style,                                                     // style
                           "nwCell",                                                  // type
                           baseSelector+" > thead > tr > th:first-child",             // selector
                           null,                                                      // cell
                           null,                                                      // top
                           null,                                                      // bottom
                           null,                                                      // left
                           null,                                                      // right
                           false,                                                 // allowInsideH
                           false);                                                // allowInsideV

            cssText +=
            tableStyleCSS2(style,                                                     // style
                           "neCell",                                                  // type
                           baseSelector+" > thead > tr > th:last-child",              // selector
                           null,                                                      // cell
                           null,                                                      // top
                           null,                                                      // bottom
                           null,                                                      // left
                           null,                                                      // right
                           false,                                                 // allowInsideH
                           false);                                                // allowInsideV

            cssText +=
            tableStyleCSS2(style,                                                     // style
                           "swCell",                                                  // type
                           baseSelector+" > tfoot > tr > th:first-child",             // selector
                           null,                                                      // cell
                           null,                                                      // top
                           null,                                                      // bottom
                           null,                                                      // left
                           null,                                                      // right
                           false,                                                 // allowInsideH
                           false);                                                // allowInsideV

            cssText +=
            tableStyleCSS2(style,                                                     // style
                           "seCell",                                                  // type
                           baseSelector+" > tfoot > tr > th:last-child",              // selector
                           null,                                                      // cell
                           null,                                                      // top
                           null,                                                      // bottom
                           null,                                                      // left
                           null,                                                      // right
                           false,                                                 // allowInsideH
                           false);                                                // allowInsideV
        }

        cssText += "\n";
        cssText += "/* Mimic word's behaviour for table cells */\n";
        cssText += "th, td {\n    vertical-align: top;\n}\n";
        cssText += "table + table {\n    margin-top: 1em;\n}\n";
        cssText += "table {\n    border-collapse: collapse;\n}\n";
//        cssText += "table {\n    border-spacing: 0;\n}\n";

        cssText += "td > p:first-child {\n    margin-top: 0;\n}\n";
        cssText += "td > p:last-child {\n    margin-bottom: 0;\n}\n";
        cssText += "th > p:first-child {\n    margin-top: 0;\n}\n";
        cssText += "th > p:last-child {\n    margin-bottom: 0;\n}\n";

        cssText += "\n";
        cssText += "/* Cancel out special formatting for table headers in default stylesheet */\n";
        cssText += "th { font-weight: normal; text-align: left; }\n";

        return cssText;
    }

    function copyProp(from,fromName,to,toName)
    {
        if (from[fromName] != null) {
            if (toName == null)
                toName = fromName;
            to[toName] = from[fromName];
        }
    }

    function deleteProp(from,fromName)
    {
        delete from[fromName];
    }

    function moveProp(from,fromName,to,toName)
    {
        copyProp(from,fromName,to,toName);
        deleteProp(from,fromName);
    }

    function emptyProp(properties)
    {
        for (var name in properties)
            return false;
        return true;
    }

    function copyAll(from,to)
    {
        for (name in from)
            to[name] = from[name];
    }

    tableStyleCSS2 = function(style,type,selector,cell,top,bottom,left,right,
                              allowInsideH,allowInsideV)
    {
        // FIXME: need to deal with inheritance here
        if (style.hasTableStyleType(type)) {
            var cssProperties = new Object();
            style.applyTableStyleCSSProperties(type,cssProperties);
            return tableStyleCSS3(cssProperties,selector,cell,top,bottom,left,right,
                                  allowInsideH,allowInsideV);
        }
        else {
            return "";
        }
    }

    // FIXME: use this for regular table cells too?
    tableStyleCSS3 = function(cssProperties,selector,cell,top,bottom,left,right,
                              allowInsideH,allowInsideV)
    {
        var cssText = "";

        var topProperties = new Object();
        var bottomProperties = new Object();
        var leftProperties = new Object();
        var rightProperties = new Object();
        var cellProperties = new Object();

        moveProp(cssProperties,"border-top-width",topProperties);
        moveProp(cssProperties,"border-top-style",topProperties);
        moveProp(cssProperties,"border-top-color",topProperties);

        moveProp(cssProperties,"border-bottom-width",bottomProperties);
        moveProp(cssProperties,"border-bottom-style",bottomProperties);
        moveProp(cssProperties,"border-bottom-color",bottomProperties);

        moveProp(cssProperties,"border-left-width",leftProperties);
        moveProp(cssProperties,"border-left-style",leftProperties);
        moveProp(cssProperties,"border-left-color",leftProperties);

        moveProp(cssProperties,"border-right-width",rightProperties);
        moveProp(cssProperties,"border-right-style",rightProperties);
        moveProp(cssProperties,"border-right-color",rightProperties);

        if (!allowInsideH ||
            (allowInsideH == "visible-only") && (cssProperties["word-insideH-style"] == "hidden")) {
            delete cssProperties["word-insideH-width"];
            delete cssProperties["word-insideH-style"];
            delete cssProperties["word-insideH-color"];
        }

        if (!allowInsideV ||
            (allowInsideV == "visible-only") && (cssProperties["word-insideV-style"] == "hidden")) {
            delete cssProperties["word-insideV-width"];
            delete cssProperties["word-insideV-style"];
            delete cssProperties["word-insideV-color"];
        }

        copyProp(cssProperties,"word-insideH-width",cellProperties,"border-top-width");
        copyProp(cssProperties,"word-insideH-style",cellProperties,"border-top-style");
        copyProp(cssProperties,"word-insideH-color",cellProperties,"border-top-color");

        copyProp(cssProperties,"word-insideH-width",cellProperties,"border-bottom-width");
        copyProp(cssProperties,"word-insideH-style",cellProperties,"border-bottom-style");
        copyProp(cssProperties,"word-insideH-color",cellProperties,"border-bottom-color");

        deleteProp(cssProperties,"word-insideH-width");
        deleteProp(cssProperties,"word-insideH-style");
        deleteProp(cssProperties,"word-insideH-color");

        copyProp(cssProperties,"word-insideV-width",cellProperties,"border-left-width");
        copyProp(cssProperties,"word-insideV-style",cellProperties,"border-left-style");
        copyProp(cssProperties,"word-insideV-color",cellProperties,"border-left-color");

        copyProp(cssProperties,"word-insideV-width",cellProperties,"border-right-width");
        copyProp(cssProperties,"word-insideV-style",cellProperties,"border-right-style");
        copyProp(cssProperties,"word-insideV-color",cellProperties,"border-right-color");

        deleteProp(cssProperties,"word-insideV-width");
        deleteProp(cssProperties,"word-insideV-style");
        deleteProp(cssProperties,"word-insideV-color");

/* FIXME? I think these should apply to the children of the cell
        moveProp(cssProperties,"margin-top",cellProperties);
        moveProp(cssProperties,"margin-bottom",cellProperties);
        moveProp(cssProperties,"margin-left",cellProperties);
        moveProp(cssProperties,"margin-right",cellProperties);
*/

        if (top == null)
            copyAll(topProperties,cssProperties);
        if (bottom == null)
            copyAll(bottomProperties,cssProperties);
        if (left == null)
            copyAll(leftProperties,cssProperties);
        if (right == null)
            copyAll(rightProperties,cssProperties);
        if (cell == null)
            copyAll(cellProperties,cssProperties);

        mergeCSSProperties(cssProperties);
        mergeCSSProperties(topProperties);
        mergeCSSProperties(bottomProperties);
        mergeCSSProperties(leftProperties);
        mergeCSSProperties(rightProperties);
        mergeCSSProperties(cellProperties);

        cssText += cssRuleText(selector,cssProperties);

        if ((top != null) && !emptyProp(topProperties))
            cssText += cssRuleText(top,topProperties);

        if ((bottom != null) && !emptyProp(bottomProperties))
            cssText += cssRuleText(bottom,bottomProperties);

        if ((left != null) && !emptyProp(leftProperties))
            cssText += cssRuleText(left,leftProperties);

        if ((right != null) && !emptyProp(rightProperties))
            cssText += cssRuleText(right,rightProperties);

        if ((cell != null) && !emptyProp(cellProperties))
            cssText += cssRuleText(cell,cellProperties);

        return cssText;
    }

    function processStyles(filename)
    {
        var stylesFilename = filename+"/word/styles.xml";
        var xml = filesystem.readXML(stylesFilename);

        if (xml == null)
            throw new Error("Could not load "+stylesFilename);

        return new StyleCollection(xml.documentElement);
    }

    window.processStyles = processStyles;
})();
