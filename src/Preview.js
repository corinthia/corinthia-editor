// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Preview_showForStyle;

(function(){

    var previewText =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec in diam \n"+
        "mauris. Integer in lorem sit amet dolor lacinia aliquet. Cras vehicula odio \n"+
        "non enim euismod nec congue lorem varius. Sed eu libero arcu, eget tempus \n"+
        "augue. Vivamus varius risus ac libero sagittis eu ultricies lectus \n"+
        "consequat. Integer gravida accumsan fermentum. Morbi erat ligula, volutpat \n"+
        "non accumsan sed, pellentesque quis purus. Vestibulum vestibulum tincidunt \n"+
        "lectus non pellentesque. Quisque porttitor sollicitudin tellus, id porta \n"+
        "velit interdum sit amet. Cras quis sem orci, vel convallis magna. \n"+
        "Pellentesque congue, libero et iaculis volutpat, enim turpis sodales dui, \n"+
        "lobortis pharetra lectus dolor at sem. Nullam aliquam, odio ac laoreet \n"+
        "vulputate, ligula nunc euismod leo, vel bibendum magna leo ut orci. In \n"+
        "tortor turpis, pellentesque nec cursus ut, consequat non ipsum. Praesent \n"+
        "venenatis, leo in pulvinar pharetra, eros nisi convallis elit, vitae luctus \n"+
        "magna velit ut lorem."

    function getStyleElement()
    {
        var style = document.getElementById("style");
        if (style == null) {
            style = DOM_createElement(document,"STYLE");
            style.setAttribute("id","style");
            var head = DOM_documentHead(document);
            DOM_appendChild(head,style);
        }
        return style;
    }

    function clearDocument()
    {
        var style = getStyleElement();
        DOM_deleteAllChildren(style);
        DOM_deleteAllChildren(document.body);
    }

    function setStyleSheet(selector,cssText)
    {

        clearDocument();
        
        var style = getStyleElement();
        DOM_appendChild(style,DOM_createTextNode(document,cssText));
        
        var element;
        if (selector.charAt(0) == ".") {
            element = DOM_createElement(document,"DIV");
            element.setAttribute("class",selector.slice(1));
        }
        else {
            element = DOM_createElement(document,selector);
        }
        
        DOM_appendChild(document.body,element);
        DOM_appendChild(element,DOM_createTextNode(document,previewText));
    }

    function setTableCellContents(node)
    {
        if (isTableCell(node)) {
            DOM_deleteAllChildren(node);
            DOM_appendChild(node,DOM_createTextNode(document,"Cell contents"));
        }
        else {
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                setTableCellContents(child);
        }
    }

    function showForStyle(styleId)
    {
        var displayName = styleId;
        var style = Styles_getAllStyles()[styleId];
        if (style != null)
            displayName = style.displayName;

        var titleText = "Preview of style "+displayName;
        var title = DOM_createTextNode(document,titleText);
        var text = DOM_createTextNode(document,previewText);

        // We use BR here instead of separate paragraphs, for the case in which we are displaying
        // the BODY ("Document defaults style"), in which we don't want style properties set for
        // the P element to be displayed.
        DOM_deleteAllChildren(document.body);

        if (PARAGRAPH_ELEMENTS[styleId.toUpperCase()]) {
            DOM_appendChild(document.body,title);
            DOM_appendChild(document.body,DOM_createElement(document,"BR"));
            DOM_appendChild(document.body,DOM_createElement(document,"BR"));
            DOM_appendChild(document.body,text);

            Selection_selectAll();
            Formatting_applyFormattingChanges(styleId,null);
            Selection_setSelectionRange(null);
        }
        else if ((styleId == "table") || (styleId == "caption")) {
            Selection_selectAll();
            Tables_insertTable(3,3,"100%",true,"Table caption");
            Selection_setSelectionRange(null);
            var table = document.getElementsByTagName("TABLE")[0];
            setTableCellContents(table);
        }
        else if ((styleId == "figure") || (styleId == "figcaption")) {
            Selection_selectAll();
            Figures_insertFigure("SampleFigure.svg","75%",true,"TCP 3-way handshake");
            Selection_setSelectionRange(null);
        }
        else if (styleId == "body") {
            DOM_appendChild(document.body,title);
            DOM_appendChild(document.body,DOM_createElement(document,"BR"));
            DOM_appendChild(document.body,DOM_createElement(document,"BR"));
            DOM_appendChild(document.body,text);
        }
    }

    Preview_showForStyle = trace(showForStyle);

//    DOM_assignNodeIds(document);

})();
