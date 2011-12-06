function Preamble()
{
    this.packages = new Object();
    this.colorDefs = new Object();
}

Preamble.prototype.addRequiredPackage = function(pkg)
{
    this.packages[pkg] = true;
}

Preamble.prototype.addColorDef = function(col)
{
    this.addRequiredPackage("color");
    this.colorDefs[colorName(col)] = col;
}

Preamble.prototype.toString = function()
{
    var builder = new StringBuilder();

    builder.append("\\documentclass[a4paper,12pt]{article}\n");

    // for U (\uline)
    if (this.packages["ulem"]) {
        builder.append("\\PassOptionsToPackage{normalem}{ulem}\n");
        builder.append("\\usepackage{ulem}\n");
    }

    // for \prettyref
    if (this.packages["prettyref"]) {
        builder.append("\\usepackage{prettyref}\n");
    }

    // Margins
    builder.append("\\usepackage{geometry}\n");
    builder.append("\\geometry{verbose,tmargin=1in,bmargin=1in,lmargin=1in,rmargin=1in}\n");

    // For \textcolor
    if (this.packages["color"]) {
        builder.append("\\usepackage{color}\n");
    }

    // for tabularx environment
    if (this.packages["tabularx"]) {
        builder.append("\\usepackage{tabularx}\n");
    }

    // for \multirow
    if (this.packages["multirow"]) {
        builder.append("\\usepackage{multirow}\n");
    }

    // Paragraph spacing
    builder.append("\\setlength{\\parskip}{\\medskipamount}\n");
    builder.append("\\setlength{\\parindent}{0pt}\n");

    for (colname in this.colorDefs) {
        var col = this.colorDefs[colname];
        builder.append("\\definecolor{"+colname+"}{RGB}{"+col.r+","+col.g+","+col.b+"}\n");
    }

    return builder.toString();
}

function translateHTML2Latex(document)
{
    var preamble = new Preamble();
    var builder = new StringBuilder();
    recurse(document.body);


    return preamble.toString() +
        "\\begin{document}\n\n" +
        builder.toString() +
        "\n\\end{document}\n";

    function recurse(node)
    {
        if (node.nodeType == Node.TEXT_NODE) {
            var str = node.nodeValue;
            //str = str.replace(/\n/g," ");
            var fixed = "";

            for (var i = 0; i < str.length; i++) {
                var c = str.charAt(i);
                switch (c) {
                case "#": fixed += "\\#"; break;
                case "$": fixed += "\\$"; break;
                case "%": fixed += "\\%"; break;
                case "&": fixed += "\\&"; break;
                case "~": fixed += "\\~{}"; break;
                case "_": fixed += "\\_"; break;
                case "^": fixed += "\\^{}"; break;
                case "\\": fixed += "$\\backslash$"; break;
                case "{": fixed += "\\{"; break;
                case "}": fixed += "\\}"; break;
                case "\n": fixed += " "; break;
                case "\r": break;
                default: fixed += c; break;
                }
            }

            builder.append(fixed);
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            var prefix = "";
            var suffix = "";
            if (node.nodeName == "H1") {
                prefix = "\n\\section{";
                suffix = "}\n";
            }
            else if (node.nodeName == "H2") {
                prefix = "\n\\subsection{";
                suffix = "}\n";
            }

            else if (node.nodeName == "H3") {
                prefix = "\n\\subsubsection{";
                suffix = "}\n";
            }

            else if (node.nodeName == "H4") {
                prefix = "\n\\paragraph{";
                suffix = "}\n";
            }

            else if ((node.nodeName == "H5") || (node.nodeName == "H6")) {
                prefix = "\n\\subparagraph{";
                suffix = "}\n";
            }
            else if (node.nodeName == "P") {

                var prefix = "\n";
                var suffix = "\n";

                if (node.style != null) {
                    var textAlign = node.style.getPropertyValue("text-align");
                    if (textAlign == "left") {
                        prefix = prefix + "\\begin{flushleft}\n";
                        suffix = "\n\\end{flushleft}" + suffix;
                    }
                    else if (textAlign == "right") {
                        prefix = prefix + "\\begin{flushright}\n";
                        suffix = "\n\\end{flushright}" + suffix;
                    }
                    else if (textAlign == "center") {
                        prefix = prefix + "\\begin{center}\n";
                        suffix = "\n\\end{center}" + suffix;
                    }
                }
            }
            else if (node.nodeName == "SCRIPT") {
                return; // Dont want to display contents of this
            }
            else if (node.nodeName == "UL") {
                prefix = "\n\\begin{itemize}\n";
                suffix = "\n\\end{itemize}\n";
            }
            else if (node.nodeName == "OL") {
                prefix = "\n\\begin{enumerate}\n";
                suffix = "\n\\end{enumerate}\n";
            }
            else if (node.nodeName == "LI") {
                prefix = "\\item ";
                suffix = "\n";
            }
            else if (node.nodeName == "B") {
                prefix = "\\textbf{";
                suffix = "}";
            }
            else if (node.nodeName == "I") {
                prefix = "\\emph{";
                suffix = "}";
            }
            else if (node.nodeName == "U") {
                preamble.addRequiredPackage("ulem");
                prefix = "\\uline{";
                suffix = "}";
            }
            else if (node.nodeName == "TT") {
                prefix = "\\texttt{";
                suffix = "}";
            }
            else if (node.nodeName == "A") {
                var href = node.getAttribute("href");
                if ((href != null) && (href.charAt(0) == "#")) {
                    var id = href.slice(1);
                    var target = document.getElementById(id);
                    if (target != null) {
                        var text = refText(target);
                        if (text != null) {
                            builder.append(text);
                            return;
                        }
                    }
                }
            }
            else if (node.nodeName == "TABLE") {
                var table = new htmltable.Table(node);
                preamble.addRequiredPackage("tabularx");
                builder.append("\n\\begin{tabularx}{\\textwidth}{|");
                for (var i = 0; i < table.numCols; i++) {
                    builder.append("X|");
                }
                builder.append("}\n");
                builder.append("\\hline\n");
                for (var r = 0; r < table.numRows; r++) {
                    var c = 0;
                    while (c < table.numCols) {
                        var cell = table.get(r,c);

                        if (cell == null) {
                            c++;
                        }
                        else {
                            if (cell.colspan > 1) {
                                var format = (c == 0) ? "|X|" : "X|";
                                builder.append("\\multicolumn{"+cell.colspan+"}{"+format+"}{");
                            }

                            if (r == cell.startRow) {

                                if (cell.rowspan > 1) {
                                    preamble.addRequiredPackage("multirow");
                                    builder.append("\\multirow{"+cell.rowspan+"}{*}{");
                                }

                                recurse(cell.element); // FIXME what if cell is null?

                                if (cell.rowspan > 1)
                                    builder.append("}");

                            }

                            if (cell.colspan > 1)
                                builder.append("}");

                            c += cell.colspan;
                        }

                        if (c < table.numCols)
                            builder.append(" & ");
                    }
                    builder.append("\\\\\n");

                    var separate = true;
                    for (var c = 0; c < table.numCols; c++) {
                        if (table.get(r,c) == table.get(r+1,c))
                            separate = false;
                    }
                    if (separate) {
                        builder.append("\\hline\n");
                    }
                    else {
                        var start = 0;
                        var end = 0;
                        for (var c = 0; c <= table.numCols; c++) {
                            if ((c == table.numCols) || (table.get(r,c) == table.get(r+1,c))) {
                                if (end > start) {
                                    builder.append("\\cline{"+(start+1)+"-"+(end)+"}\n");
                                }
                                start = c+1;
                                end = c+1;
                            }
                            else {
                                end = c+1;
                            }
                        }
                    }
                }
                builder.append("\\end{tabularx}\n");
                return;
            }

            if (node.style != null) {
                if (node.style.getPropertyValue("color") != null) {
                    var color = node.style.getPropertyCSSValue("color");

                    var col;

                    //debug("color = "+color+" ("+color.primitiveType+")");
                    if (color.primitiveType == CSSPrimitiveValue.CSS_IDENT) {
                        var ident = color.getStringValue();
                        debug("color ident = "+ident);
                        col = CSS_COLORS_BY_NAME[ident];
                    }
                    else if (color.primitiveType == CSSPrimitiveValue.CSS_RGBCOLOR) {
                        var rgbColor = color.getRGBColorValue();
                        debug("color"+color.cssText+": "+
                              " red = "+rgbColor.red.cssText+
                              " green = "+rgbColor.green.cssText+
                              " blue = "+rgbColor.blue.cssText);
                        col = { r: parseInt(rgbColor.red.cssText),
                                g: parseInt(rgbColor.green.cssText),
                                b: parseInt(rgbColor.blue.cssText) };
                    }

                    var text;
                    var rgbname = colorName(col);
                    var latexColor = LATEX_COLORS_BY_RGB[rgbname];
                    if (latexColor == null) {
                        preamble.addColorDef(col);
                        latexColor = colorName(col);
                    }

                    prefix += "\\textcolor{"+latexColor+"}{";
                    suffix = "}" + suffix;

                    preamble.addRequiredPackage("color");
                }
            }

            builder.append(prefix);
            if (node.hasAttribute("id"))
                builder.append("\\label{"+nodeLabel(node)+"}");
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
            builder.append(suffix);
        }
    }

    function nodeLabel(node)
    {
        var id = node.getAttribute("id"); // FIXME: substitute special characters
        if ((node.nodeName == "H1") || (node.nodeName == "H2") || (node.nodeName == "H3"))
            return "sec:"+id;
        else if (node.getAttribute("class") == "figure")
            return "fig:"+id;
        else if (node.getAttribute("class") == "table")
            return "tab:"+id;
        else
            return id;
    }

    function refText(node)
    {
        preamble.addRequiredPackage("prettyref");
        return "\\prettyref{"+nodeLabel(node)+"}";
    }
}

function convert()
{
    var latex = translateHTML2Latex(document);

    var win = window.open();
    var text = win.document.createTextNode(latex);
    var pre = win.document.createElement("PRE");
    pre.appendChild(text);
    win.document.body.appendChild(pre);
}
