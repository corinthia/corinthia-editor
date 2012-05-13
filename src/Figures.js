// Copyright (c) 2012 UX Productivity Pty Ltd. All rights reserved.

var Figures_insertFigure;
var Figures_getProperties;
var Figures_setProperties;

(function() {

    // public
    function insertFigure(filename,width,numbered,caption)
    {
        Styles_addDefaultRuleCategory("figure");

        var figure = DOM_createElement(document,"FIGURE");
        var img = DOM_createElement(document,"IMG");
        img.setAttribute("src",filename);
        img.style.width = width;
        DOM_appendChild(figure,img);

        if ((caption != null) && (caption != "")) {
            var figcaption = DOM_createElement(document,"FIGCAPTION");
            DOM_appendChild(figcaption,DOM_createTextNode(document,caption));
            DOM_appendChild(figure,figcaption);
        }

        Clipboard_pasteNodes([figure]);

        // Now that the figure has been inserted into the DOM tree, the outline code will
        // have noticed it and added an id attribute, as well as a caption giving the
        // table number.
        Outline_setNumbered(figure.getAttribute("id"),numbered);
    }


    function getSelectedFigureElement()
    {
        var selectionRange = Selection_get();
        if (selectionRange == null)
            return;
        var matches = selectionRange.findMatchingNodes(isFigureNode);
        if (matches.length > 0)
            return matches[0];
        else
            return null;
    }

    // public
    function getProperties()
    {
        var figure = getSelectedFigureElement();
        if (figure == null)
            return null;
        var result = { width: null, src: null, itemId: null };
        for (var child = figure.firstChild; child != null; child = child.nextSibling) {
            if (DOM_upperName(child) == "IMG") {
                result.src = child.getAttribute("src");
                result.width = child.style.width;
            }
        }
        result.itemId = figure.getAttribute("id");
        return result;
    }

    // public
    function setProperties(itemId,width,src)
    {
        var figure = Outline_getItemElement(itemId);
        for (var child = figure.firstChild; child != null; child = child.nextSibling) {
            if (DOM_upperName(child) == "IMG") {
                if (src == null)
                    child.removeAttribute("src");
                else
                    child.setAttribute("src",src);

                child.style.width = width;
                if (child.getAttribute("style") == "")
                    child.removeAttribute("style");
            }
        }
    }

    Figures_insertFigure = trace(insertFigure);
    Figures_getProperties = trace(getProperties);
    Figures_setProperties = trace(setProperties);

})();
