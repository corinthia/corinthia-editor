function DOCXStyleCollection(stylesElem)
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
                this.styles[styleId] = new DOCXStyle(styleId,child);
            }
        }
    }

    this.computeCascadedProperties();
}

DOCXStyleCollection.prototype.extractCellProperties = function(cssProperties)
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

DOCXStyleCollection.prototype.computeCascadedProperties = function()
{
    for (var name in this.styles)
        this.styles[name].computeCascadedProperties(this,"");
}

DOCXStyleCollection.prototype.toCSSStyleSheet = function()
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


        DOCXUtil.mergeCSSProperties(cssProperties);
        cssText += "\n\n\n/* "+style.styleId+" ("+style.type+") */\n\n";

        var baseSelector;
        if (style.type == "table")
            baseSelector = "table."+styleId;
        else
            baseSelector = "."+styleId;;

        var cellCSSProperties = this.extractCellProperties(cssProperties);
        cssText += DOCXUtil.cssRuleText(baseSelector,cssProperties);

        // Special case: border properties set on a table style also apply to its children
        if (cellCSSProperties != null) {
            DOCXUtil.mergeCSSProperties(cellCSSProperties);
            cssText += DOCXUtil.cssRuleText(baseSelector+" > tbody > tr > *",
                                            cellCSSProperties);

            if ((style.hasTableStyleType("nwCell") || style.hasTableStyleType("neCell")) &&
                !style.hasTableStyleType("firstRow"))
                cssText += DOCXUtil.cssRuleText(baseSelector+" > thead > tr > *",
                                                cellCSSProperties);

            if ((style.hasTableStyleType("swCell") || style.hasTableStyleType("seCell")) &&
                !style.hasTableStyleType("lastRow"))
                cssText += DOCXUtil.cssRuleText(baseSelector+" > tfoot > tr > *",
                                                cellCSSProperties);

            cssText += baseSelector+" > tbody > tr > td:first-of-type { border-left: none }\n"
            cssText += baseSelector+" > tbody > tr > td:last-of-type { border-right: none }\n"
            cssText += baseSelector+" > tbody > tr:first-of-type > td { border-top: none }\n"
            cssText += baseSelector+" > tbody > tr:last-of-type > td { border-bottom: none }\n"
        }

        // Banded rows and columns
        var baseHBand = baseSelector+"[hband=\"true\"]";
        var baseVBand = baseSelector+"[vband=\"true\"]";
        cssText +=
        this.tblStyle2(style,                                                        // style
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
        this.tblStyle2(style,                                                        // style
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
        this.tblStyle2(style,                                                     // style
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
        this.tblStyle2(style,                                                     // style
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
        this.tblStyle2(style,                                                     // style
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
        this.tblStyle2(style,                                                     // style
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
        this.tblStyle2(style,                                                     // style
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
        this.tblStyle2(style,                                                     // style
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
        this.tblStyle2(style,                                                     // style
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
        this.tblStyle2(style,                                                     // style
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
        this.tblStyle2(style,                                                     // style
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
        this.tblStyle2(style,                                                     // style
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

DOCXStyleCollection.prototype.tblStyle2 =
    function(style,type,selector,cell,top,bottom,left,right,allowInsideH,allowInsideV)
{
    // FIXME: need to deal with inheritance here
    if (style.hasTableStyleType(type)) {
        var cssProperties = new Object();
        style.applyTableStyleCSSProperties(type,cssProperties);
        return this.tblStyle3(cssProperties,selector,cell,top,bottom,left,right,
                              allowInsideH,allowInsideV);
    }
    else {
        return "";
    }
}

// FIXME: use this for regular table cells too?
DOCXStyleCollection.prototype.tblStyle3 =
    function(cssProperties,selector,cell,top,bottom,left,right,allowInsideH,allowInsideV)
{
    var cssText = "";

    var topProperties = new Object();
    var bottomProperties = new Object();
    var leftProperties = new Object();
    var rightProperties = new Object();
    var cellProperties = new Object();

    this.moveProp(cssProperties,"border-top-width",topProperties);
    this.moveProp(cssProperties,"border-top-style",topProperties);
    this.moveProp(cssProperties,"border-top-color",topProperties);

    this.moveProp(cssProperties,"border-bottom-width",bottomProperties);
    this.moveProp(cssProperties,"border-bottom-style",bottomProperties);
    this.moveProp(cssProperties,"border-bottom-color",bottomProperties);

    this.moveProp(cssProperties,"border-left-width",leftProperties);
    this.moveProp(cssProperties,"border-left-style",leftProperties);
    this.moveProp(cssProperties,"border-left-color",leftProperties);

    this.moveProp(cssProperties,"border-right-width",rightProperties);
    this.moveProp(cssProperties,"border-right-style",rightProperties);
    this.moveProp(cssProperties,"border-right-color",rightProperties);

    if (!allowInsideH ||
        ((allowInsideH == "visible-only") &&
         (cssProperties["word-insideH-style"] == "hidden"))) {
        delete cssProperties["word-insideH-width"];
        delete cssProperties["word-insideH-style"];
        delete cssProperties["word-insideH-color"];
    }

    if (!allowInsideV ||
        ((allowInsideV == "visible-only") &&
         (cssProperties["word-insideV-style"] == "hidden"))) {
        delete cssProperties["word-insideV-width"];
        delete cssProperties["word-insideV-style"];
        delete cssProperties["word-insideV-color"];
    }

    this.copyProp(cssProperties,"word-insideH-width",cellProperties,"border-top-width");
    this.copyProp(cssProperties,"word-insideH-style",cellProperties,"border-top-style");
    this.copyProp(cssProperties,"word-insideH-color",cellProperties,"border-top-color");

    this.copyProp(cssProperties,"word-insideH-width",cellProperties,"border-bottom-width");
    this.copyProp(cssProperties,"word-insideH-style",cellProperties,"border-bottom-style");
    this.copyProp(cssProperties,"word-insideH-color",cellProperties,"border-bottom-color");

    this.deleteProp(cssProperties,"word-insideH-width");
    this.deleteProp(cssProperties,"word-insideH-style");
    this.deleteProp(cssProperties,"word-insideH-color");

    this.copyProp(cssProperties,"word-insideV-width",cellProperties,"border-left-width");
    this.copyProp(cssProperties,"word-insideV-style",cellProperties,"border-left-style");
    this.copyProp(cssProperties,"word-insideV-color",cellProperties,"border-left-color");

    this.copyProp(cssProperties,"word-insideV-width",cellProperties,"border-right-width");
    this.copyProp(cssProperties,"word-insideV-style",cellProperties,"border-right-style");
    this.copyProp(cssProperties,"word-insideV-color",cellProperties,"border-right-color");

    this.deleteProp(cssProperties,"word-insideV-width");
    this.deleteProp(cssProperties,"word-insideV-style");
    this.deleteProp(cssProperties,"word-insideV-color");

    /* FIXME? I think these should apply to the children of the cell
       this.moveProp(cssProperties,"margin-top",cellProperties);
       this.moveProp(cssProperties,"margin-bottom",cellProperties);
       this.moveProp(cssProperties,"margin-left",cellProperties);
       this.moveProp(cssProperties,"margin-right",cellProperties);
    */

    if (top == null)
        this.copyAll(topProperties,cssProperties);
    if (bottom == null)
        this.copyAll(bottomProperties,cssProperties);
    if (left == null)
        this.copyAll(leftProperties,cssProperties);
    if (right == null)
        this.copyAll(rightProperties,cssProperties);
    if (cell == null)
        this.copyAll(cellProperties,cssProperties);

    DOCXUtil.mergeCSSProperties(cssProperties);
    DOCXUtil.mergeCSSProperties(topProperties);
    DOCXUtil.mergeCSSProperties(bottomProperties);
    DOCXUtil.mergeCSSProperties(leftProperties);
    DOCXUtil.mergeCSSProperties(rightProperties);
    DOCXUtil.mergeCSSProperties(cellProperties);

    cssText += DOCXUtil.cssRuleText(selector,cssProperties);

    if ((top != null) && !this.emptyProp(topProperties))
        cssText += DOCXUtil.cssRuleText(top,topProperties);

    if ((bottom != null) && !this.emptyProp(bottomProperties))
        cssText += DOCXUtil.cssRuleText(bottom,bottomProperties);

    if ((left != null) && !this.emptyProp(leftProperties))
        cssText += DOCXUtil.cssRuleText(left,leftProperties);

    if ((right != null) && !this.emptyProp(rightProperties))
        cssText += DOCXUtil.cssRuleText(right,rightProperties);

    if ((cell != null) && !this.emptyProp(cellProperties))
        cssText += DOCXUtil.cssRuleText(cell,cellProperties);

    return cssText;
}

DOCXStyleCollection.prototype.copyProp = function(from,fromName,to,toName)
{
    if (from[fromName] != null) {
        if (toName == null)
            toName = fromName;
        to[toName] = from[fromName];
    }
}

DOCXStyleCollection.prototype.deleteProp = function(from,fromName)
{
    delete from[fromName];
}

DOCXStyleCollection.prototype.moveProp = function(from,fromName,to,toName)
{
    this.copyProp(from,fromName,to,toName);
    this.deleteProp(from,fromName);
}

DOCXStyleCollection.prototype.emptyProp = function(properties)
{
    for (var name in properties)
        return false;
    return true;
}

DOCXStyleCollection.prototype.copyAll = function(from,to)
{
    for (name in from)
        to[name] = from[name];
}
