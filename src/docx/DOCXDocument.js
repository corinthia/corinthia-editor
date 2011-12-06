// FIXME: don't delete empty paragraphs that separate two tables
// (or set the table margins appropriately?)

// FIXME: after translation, remove all attributes starting with "word-"

function DOCXDocument(filename)
{
    this.filename = filename;
}

DOCXDocument.prototype.toHTML = function() {
    var filename = this.filename;

    function percentage(numerator,denominator)
    {
        if (denominator <= 0)
            return "0%";
        var ratio = Math.min(1,numerator/denominator);
        return Math.round(1000*ratio)/10 + "%";
    }

    function addStyleSheet()
    {
        var head = document.documentElement.firstChild;
        while ((head != null) && (head.nodeName != "HEAD"))
            head = head.nextSibling;
        if (head == null) {
            head = document.createElement("HEAD");
            document.documentElement.insertBefore(head,document.documentElement.firstChild);
        }

        var style = document.createElement("STYLE");
        style.setAttribute("type","text/css");
        head.appendChild(style);

        var text = document.createTextNode(word.styles.toCSSStyleSheet());
        style.appendChild(text);
    }

    function styleHasTableStyleType(style,type)
    {
        while (style != null) {
            if (style.tableStyleProperties[type] != null)
                return true;
            style = style.parent;
        }
        return false;
    }

    function recurse(node,htmlParent,containingBlockWidth)
    {
        if (node.nodeType == Node.TEXT_NODE) {
            var text = document.createTextNode(node.nodeValue);
            htmlParent.appendChild(text);
            return;
        }
        else if (node.namespaceURI != WORD_NAMESPACE) {
            return;
        }
        else if (node.localName == "p") {
            var htmlElementName = "P";
            var cssProperties = new Object();

            var pPr = firstChildElement(node);
            var properties = null;
            if ((pPr != null) && isWordElement(pPr,"pPr")) {
                properties = new DOCXParagraphProperties(pPr);
            }

            if (properties != null) {
                if (properties.pStyle == "Heading1")
                    htmlElementName = "H1";
                else if (properties.pStyle == "Heading2")
                    htmlElementName = "H2";
                else if (properties.pStyle == "Heading3")
                    htmlElementName = "H3";
                else if (properties.pStyle == "Heading4")
                    htmlElementName = "H4";
                else if (properties.pStyle == "Heading5")
                    htmlElementName = "H5";
                else if (properties.pStyle == "Heading6")
                    htmlElementName = "H6";

                properties.applyCSSProperties(cssProperties);

                if (properties.numPr != null) {

                    var listType = "OL";
                    if (properties.numPr.numFmt == "bullet")
                        listType = "UL";

                    /* Word allows items in a list to be non-contiguous - that is, there may be
                       arbitrary content between two items in a given list, which is not considered
                       part of the list by word. Correct numbering in HTML requires each list item
                       appear directly after its previous one. So we move the intervening paragraphs
                       into the previous list item.

                       This is not ideal, because it means that the paragraphs are indented to
                       match the list item, where in word they might not be. However it's the only
                       way I can see to cater for this intervening content within HTML's list model.

                       Note that we only do this for ordered lists, since for unordered lists it
                       doesn't make any difference to start a new list each time. */

                    if (listType == "OL") {

                        var lastList = lastListForNumId[properties.numPr.abstractNumId];
                        if (lastList != null) {
                            var topList = lastList;
                            while ((topList != null) && (topList.parentNode != htmlParent))
                                topList = topList.parentNode;

                            if (topList != null) {
                                var n = topList.nextSibling;
                                while (n != null) {
                                    var next = n.nextSibling;
                                    lastList.lastChild.appendChild(n);
                                    n = next;
                                }
                            }
                        }
                    }



                    for (var i = 0; i <= properties.numPr.ilvl-1; i++) {
                        if ((htmlParent.lastChild != null) &&
                            ((htmlParent.lastChild.nodeName == "OL") ||
                             (htmlParent.lastChild.nodeName == "UL")) &&
                            (htmlParent.lastChild.getAttribute("word-ilvl") == i) &&
                            (htmlParent.lastChild.lastChild != null) &&
                            (htmlParent.lastChild.lastChild.nodeName == "LI")) {
                            htmlParent = htmlParent.lastChild.lastChild;
                        }
                    }


                    var parentList = null;
                    if ((htmlParent.lastChild != null) &&
                        (htmlParent.lastChild.nodeName == listType)) {
                        parentList = htmlParent.lastChild;
                    }
                    else {
                        parentList = addChild(htmlParent,listType);
                        parentList.setAttribute("word-ilvl",properties.numPr.ilvl);
                        parentList.setAttribute("word-numId",properties.numPr.abstractNumId);
                        lastListForNumId[properties.numPr.abstractNumId] = parentList;
                    }
                    htmlParent = addChild(parentList,"LI");

                    var listStyle = null;

                    if (properties.numPr.numFmt == "bullet") {
                        if (properties.numPr.lvlText == "o")
                            listStyle = "circle";
                        else if (properties.numPr.lvlText == "\uf0a7")
                            listStyle = "square";
                    }
                    else {
                        if (properties.numPr.numFmt == "upperLetter")
                            listStyle = "upper-alpha";
                        else if (properties.numPr.numFmt == "lowerLetter")
                            listStyle = "lower-alpha";
                        else if (properties.numPr.numFmt == "upperRoman")
                            listStyle = "upper-roman";
                        else if (properties.numPr.numFmt == "lowerRoman")
                            listStyle = "lower-roman";
                    }
                    if (listStyle != null)
                        htmlParent.setAttribute("style","list-style-type: "+listStyle);
                }
            }

            var paragraph = addChild(htmlParent,htmlElementName);

            if (properties != null) {
                if (properties.pStyle != null)
                    paragraph.setAttribute("class",properties.pStyle);
            }

            // Set style attribute
            mergeCSSProperties(cssProperties);
            var style = cssPropertiesText(cssProperties);
            if (style != null)
                paragraph.setAttribute("style",style);

            recurseChildren(node,paragraph,containingBlockWidth);

            // Remove empty paragraphs
            if (paragraph.firstChild == null)
                paragraph.parentNode.removeChild(paragraph);
        }
        else if (node.localName == "r") {
            var rPr = firstChildElement(node);
            if ((rPr != null) && isWordElement(rPr,"rPr")) {
                var runProperties = new DOCXRunProperties(rPr);
                if (runProperties.b)
                    htmlParent = addChild(htmlParent,"B");
                if (runProperties.i)
                    htmlParent = addChild(htmlParent,"I");
                if (runProperties.u)
                    htmlParent = addChild(htmlParent,"U");
                if (runProperties.vertAlign == "subscript")
                    htmlParent = addChild(htmlParent,"SUB");
                if (runProperties.vertAlign == "superscript")
                    htmlParent = addChild(htmlParent,"SUP");

                if (runProperties.rStyle == "HTMLAcronym")
                    htmlParent = addChild(htmlParent,"ACRONYM");
                else if (runProperties.rStyle == "HTMLAddressChar")
                    htmlParent = addChild(htmlParent,"I"); // ADDRESS is a block element
                else if (runProperties.rStyle == "HTMLCite")
                    htmlParent = addChild(htmlParent,"CITE");
                else if (runProperties.rStyle == "HTMLCode")
                    htmlParent = addChild(htmlParent,"CODE");
                else if (runProperties.rStyle == "HTMLDefinition")
                    htmlParent = addChild(htmlParent,"DFN");
                else if (runProperties.rStyle == "HTMLKeyboard")
                    htmlParent = addChild(htmlParent,"KBD");
                else if (runProperties.rStyle == "HTMLPreformattedChar")
                    htmlParent = addChild(htmlParent,"TT"); // PRE is a block element
                else if (runProperties.rStyle == "HTMLSample")
                    htmlParent = addChild(htmlParent,"SAMP");
                else if (runProperties.rStyle == "HTMLTypewriter")
                    htmlParent = addChild(htmlParent,"TT");
                else if (runProperties.rStyle == "HTMLVariable")
                    htmlParent = addChild(htmlParent,"VAR");

                var cssProperties = new Object();
                runProperties.applyStyleCSSProperties(cssProperties);
                var styleValue = cssPropertiesText(cssProperties);
                if (styleValue != null) {
                    htmlParent = addChild(htmlParent,"SPAN");
                    htmlParent.setAttribute("style",styleValue);
                }
            }
            recurseChildren(node,htmlParent,containingBlockWidth);
        }
        else if (node.localName == "tbl") {
            var table = new Table(node);
            var htmlTable = addChild(htmlParent,"TABLE");

            var header = false;
            var footer = false;
            var firstColumn = false;
            var lastColumn = false;

            var styleHasFirstRow = false;
            var styleHasLastRow = false;
            var styleHasFirstColumn = false;
            var styleHasLastColumn = false;
            var styleHasHBand = false;
            var styleHasVBand = false;
            var styleHasNWCell = false;
            var styleHasNECell = false;
            var styleHasSWCell = false;
            var styleHasSECell = false;

            var style = null;
            if (table.properties.tblStyle != null)
                style = word.styles.styles[table.properties.tblStyle];

            if (style != null) {
                styleHasFirstRow = style.hasTableStyleType("firstRow");
                styleHasLastRow = style.hasTableStyleType("lastRow");
                styleHasFirstColumn = style.hasTableStyleType("firstCol");
                styleHasLastColumn = style.hasTableStyleType("lastCol");
                styleHasHBand = style.hasTableStyleType("band1Horz") ||
                                style.hasTableStyleType("band2Horz");
                styleHasVBand = style.hasTableStyleType("band1Vert") ||
                                style.hasTableStyleType("band2Vert");
                styleHasNWCell = style.hasTableStyleType("nwCell");
                styleHasNECell = style.hasTableStyleType("neCell");
                styleHasSWCell = style.hasTableStyleType("swCell");
                styleHasSECell = style.hasTableStyleType("seCell");
            }

            if (table.properties.tblLook == null) {
                htmlTable.setAttribute("hband","true");
                htmlTable.setAttribute("vband","true");
            }
            else {
                if (table.properties.tblLook.firstRow && styleHasFirstRow)
                    header = true;
                if (table.properties.tblLook.lastRow && styleHasLastRow)
                    footer = true;
                if (table.properties.tblLook.firstColumn && styleHasFirstColumn)
                    firstColumn = true;
                if (table.properties.tblLook.lastColumn && styleHasLastColumn)
                    lastColumn = true;
                if (!table.properties.tblLook.noHBand && styleHasHBand)
                    htmlTable.setAttribute("hband","true");
                if (!table.properties.tblLook.noVBand && styleHasVBand)
                    htmlTable.setAttribute("vband","true");
            }

            if (!styleHasFirstRow)
                header = false;
            if (!styleHasLastRow)
                footer = false;

            var cssProperties = new Object();
            if (table.properties != null)
                table.properties.applyCSSProperties(cssProperties);

            var tblW = table.properties ? table.properties.tblW : null;
            var ignoreCols = false;

            // Table width: percentage (units: 1/50th of a percent)
            if (tblW && (tblW.type == "pct")) {
                cssProperties["width"] = (tblW.w/50)+"%";
            }
            // Table width: dxa (units: 1/20th of a point)
            else if (tblW && (tblW.type == "dxa")) {
                // Convert to a percentage
                cssProperties["width"] = percentage(tblW.w,containingBlockWidth);
            }
            // Table width: auto (or unspecified)
            else {
                // If all cells are "auto", do not specify a width - let the HTML table layout
                // algorithm set a width. Otherwise, set the width to 100%.

                var total = 0;
                var numAuto = 0;
                var numDxa = 0;
                for (var row = 0; row < table.numRows; row++) {
                    for (var col = 0; col < table.numCols; col++) {
                        var cell = table.get(row,col);
                        if (cell != null) {
                            var tcW = cell.properties ? cell.properties.tcW : null;
                            if (tcW && (tcW.type == "auto"))
                                numAuto++;
                            if (tcW && (tcW.type == "dxa"))
                                numDxa++;
                            total++;
                        }
                    }
                }
                if (numAuto == total) {
                    ignoreCols = true;
                }
                else if (numDxa == total) {
                    // Every column has its width specified - calculate the total table width
                    // based on the maximum row width. This table width is then converted to
                    // a percentage as above when table width = dxa

                    var maxRowWidth = 0;
                    for (var row = 0; row < table.numRows; row++) {
                        var rowWidth = 0;
                        var col = 0;
                        while (col < table.numCols) {
                            var cell = table.get(row,col);
                            if (cell == null) {
                                col++;
                            }
                            else {
                                rowWidth += cell.properties.tcW.w;
                                col += cell.colspan;
                            }
                        }
                        if (maxRowWidth < rowWidth)
                            maxRowWidth = rowWidth;
                    }

                    cssProperties["width"] = percentage(maxRowWidth,containingBlockWidth);
                }
                else {
                    cssProperties["width"] = "100%";
                }
            }

            var style = cssPropertiesText(cssProperties);
            if (style != null)
                htmlTable.setAttribute("style",style);

            if (table.properties && table.properties.tblStyle)
                htmlTable.setAttribute("class",table.properties.tblStyle);

            if ((table.grid != null) && !ignoreCols) {
                // Convert all column widths to percentages. It doesn't make sense to
                // specify fixed widths for HTML pages as the window can be resized arbitrarily

                var total = 0;
                for (var i = 0; i < table.grid.cols.length; i++)
                    total += table.grid.cols[i];
                if (total != 0) {
                    for (var i = 0; i < table.grid.cols.length; i++) {
                        var col = document.createElement("COL");
                        var pct = 100*table.grid.cols[i]/total;
                        pct = Math.round(pct*10)/10;
                        col.setAttribute("width",pct+"%");
                        htmlTable.appendChild(col);
                    }
                }
            }

            var section = null;
            for (var row = 0; row < table.numRows; row++) {

                if ((row == 0) && (header || styleHasNWCell || styleHasNECell))
                    section = addChild(htmlTable,"THEAD");
                else if ((row == table.numRows-1) && (footer || styleHasSWCell || styleHasSECell))
                    section = addChild(htmlTable,"TFOOT");
                else if ((section == null) || (section.nodeName != "TBODY"))
                    section = addChild(htmlTable,"TBODY");

                var htmlTR = addChild(section,"TR");
                for (var col = 0; col < table.numCols; col++) {
                    var cell = table.get(row,col);
                    var colspan = cell ? cell.colspan : 1;
                    var rowspan = cell ? cell.rowspan : 1;

                    var htmlTD;

                    if ((cell == null) || !cell.translated) {
                        if ((col == 0) && firstColumn)
                            htmlTD = addChild(htmlTR,"TH");
                        else if ((col == table.numRows-1) && lastColumn)
                            htmlTD = addChild(htmlTR,"TH");
                        else if ((row == 0) && (col == 0) && styleHasNWCell)
                            htmlTD = addChild(htmlTR,"TH");
                        else if ((row == 0) && (col == table.numCols-1) && styleHasNECell)
                            htmlTD = addChild(htmlTR,"TH");
                        else if ((row == table.numRows-1) && (col == 0) && styleHasSWCell)
                            htmlTD = addChild(htmlTR,"TH");
                        else if ((row == table.numRows-1) && (col == table.numCols-1) &&
                                 styleHasSECell)
                            htmlTD = addChild(htmlTR,"TH");
                        else
                            htmlTD = addChild(htmlTR,"TD");
                    }

                    if (cell == null) {
                        //htmlTD.appendChild(document.createTextNode("\u00a0"));
                        htmlTD.appendChild(document.createTextNode("(none)")); // FIXME
                    }
                    else if (!cell.translated) {
                        if (colspan != 1)
                            htmlTD.setAttribute("colspan",colspan);
                        if (rowspan != 1)
                            htmlTD.setAttribute("rowspan",rowspan);

                        var childWidth = containingBlockWidth;
                        if (cell.properties && cell.properties.tcW &&
                            (cell.properties.tcW.type == "dxa")) {
                            var ratio = cell.properties.tcW.w/docSectionProperties.contentWidth;
                            childWidth = ratio*containingBlockWidth;
                        }

                        recurseChildren(cell.element,htmlTD,childWidth);

                        if (htmlTD.firstChild == null)
                            htmlTD.appendChild(document.createTextNode("\u00a0"));

                        cell.translated = true;
                    }

                    // Set style attribute
                    var cssProperties = new Object();
                    if (cell.properties != null)
                        cell.properties.applyCSSProperties(cssProperties);

                    mergeCSSProperties(cssProperties);

                    // Any border properties set on cells have to be marked !important, to
                    // override the default rule that cells on the edge have border: none
                    for (name in cssProperties) {
                        if (name.indexOf("border") == 0)
                            cssProperties[name] += " !important";
                    }

                    var style = cssPropertiesText(cssProperties);
                    if (style != null)
                        htmlTD.setAttribute("style",style);
                }
            }
        }
        else {
            recurseChildren(node,htmlParent,containingBlockWidth);
        }
    }

    function addChild(parent,name)
    {
        var child = document.createElement(name);
        parent.appendChild(child);
        return child;
    }

    function recurseChildren(node,htmlParent,containingBlockWidth)
    {
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            recurse(child,htmlParent,containingBlockWidth);
        }
    }



    function Cell(element,properties)
    {
        this.element = element;
        this.properties = properties;
        this.colspan = 1;
        this.rowspan = 1;

        if ((properties != null) && (properties.gridSpan != null))
            this.colspan = properties.gridSpan;
    }

    function Table(element)
    {
        var tblGrid = findChildElement(element,WORD_NAMESPACE,"tblGrid");
        var tblPr = findChildElement(element,WORD_NAMESPACE,"tblPr");

        this.grid = (tblGrid == null) ? null : new DOCXTableGrid(tblGrid);
        this.properties = (tblPr == null) ? null : new DOCXTableProperties(tblPr);

        this.row = 0;
        this.col = 0;
        this.cells = new Array();
        this.numRows = 0;
        this.numCols = 0;
        this.translated = false;
        this.processTable(element);
    }

    Table.prototype.set = function(row,col,cell)
    {
        if (this.numRows < row+1)
            this.numRows = row+1;
        if (this.numCols < col+1)
            this.numCols = col+1;
        if (this.cells[row] == null)
            this.cells[row] = new Array();
        this.cells[row][col] = cell;



        // FIXME: temp
        function StringBuilder()
        {
            this.str = "";
        }

        function getNodeText(node)
        {
            var stringBuilder = new StringBuilder();
            getNodeTextRecursive(stringBuilder,node);
            stringBuilder.str = stringBuilder.str.replace(/\s+/g," ");
            return stringBuilder.str;

            function getNodeTextRecursive(stringBuilder,node)
            {
                if (node.nodeName == "#text") {
                    stringBuilder.str += node.nodeValue;
                }
                else {
                    for (var c = node.firstChild; c != null; c = c.nextSibling)
                        getNodeTextRecursive(stringBuilder,c);
                }
            }
        }
    }

    Table.prototype.get = function(row,col)
    {
        if (this.cells[row] == null)
            return null;
        return this.cells[row][col];
    }

    Table.prototype.processTable = function(node)
    {
        if (isWordElement(node,"tc")) {
            var tcPr = findChildElement(node,WORD_NAMESPACE,"tcPr");
            var properties = (tcPr == null) ? null : new DOCXCellProperties(tcPr);

            var cell = null;
            if ((properties != null) &&
                (properties.vMerge == "continue") &&
                (this.get(this.row-1,this.col) != null)) {
                cell = this.get(this.row-1,this.col);
                //this.set(this.row,this.col,cell);
                properties = cell.properties;
                cell.rowspan++;
            }
            else {
                cell = new Cell(node,properties);
            }

            for (var c = 0; c < cell.colspan; c++)
                this.set(this.row,this.col+c,cell);

            this.col += cell.colspan;
        }
        else if (isWordElement(node,"tr")) {
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                this.processTable(child);
            this.row++;
            this.col = 0;
        }
        else {
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                this.processTable(child);
        }
    }

    function getDocSectionProperties(doc)
    {
        var body = doc.documentElement.lastChild;
        if ((body != null) && isWordElement(body,"body")) {
            for (var child = body.lastChild; body != null; body = body.previousSibling) {
                if (isWordElement(child,"sectPr"))
                    return new DOCXSectionProperties(child);
            }
        }
        return new DOCXSectionProperties();
    }

    // docx2html main
    var lastListForNumId = new Object();
    var documentFilename = filename+"/word/document.xml";
    var xml = filesystem.readXML(documentFilename);
    if (xml == null)
        throw new Error("Could not load "+documentFilename);

    // Find page size and margins
    var docSectionProperties = getDocSectionProperties(xml);
    
    // Set margins as a percentage, since a HTML document's width can vary arbitrarily based on
    // the window size
    var bodyCSSProperties = new Object();
    var pr = docSectionProperties;

    var marginLeft = pr.marginLeft / pr.pageWidth;
    var marginRight = pr.marginRight / pr.pageWidth;
    var marginTop = pr.marginTop / pr.pageHeight;
    var marginBottom = pr.marginBottom / pr.pageHeight;

    bodyCSSProperties["margin-left"] = Math.round(1000*marginLeft)/10 + "%";
    bodyCSSProperties["margin-right"] = Math.round(1000*marginRight)/10 + "%";
    bodyCSSProperties["margin-top"] = Math.round(1000*marginTop)/10 + "%";
    bodyCSSProperties["margin-bottom"] = Math.round(1000*marginBottom)/10 + "%";
    document.body.setAttribute("style",cssPropertiesText(bodyCSSProperties));

    // Translate document to HTML
    recurse(xml.documentElement,document.body,docSectionProperties.contentWidth);
    addStyleSheet();
    return;
}
