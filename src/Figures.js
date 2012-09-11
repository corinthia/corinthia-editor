// Copyright (c) 2012 UX Productivity Pty Ltd. All rights reserved.

var Figures_insertFigure;
var Figures_getSelectedFigureId;
var Figures_getProperties;
var Figures_setProperties;

(function() {

    // public
    Figures_insertFigure = trace(function insertFigure(filename,width,numbered,caption)
    {
        UndoManager_newGroup("Insert figure");

        Styles_addDefaultRuleCategory("figure");

        var figure = DOM_createElement(document,"FIGURE");
        var img = DOM_createElement(document,"IMG");
        DOM_setAttribute(img,"src",encodeURI(filename));
        DOM_setStyleProperties(img,{"width": width});
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

        // Place the cursor directly after the figure
        var offset = DOM_nodeOffset(figure);
        var pos = new Position(figure.parentNode,offset);
        pos = Position_closestMatchForwards(pos,Position_okForMovement);
        Selection_set(pos.node,pos.offset,pos.node,pos.offset);

        PostponedActions_add(UndoManager_newGroup);
    });

    Figures_getSelectedFigureId = trace(function getAdjacentFigureId()
    {
        var element = Cursor_getAdjacentNodeWithType(HTML_FIGURE);
        return element ? element.getAttribute("id") : null;
    });

    // public
    Figures_getProperties = trace(function getProperties(itemId)
    {
        var figure = document.getElementById(itemId);
        if (figure == null)
            return null;
        var rect = figure.getBoundingClientRect();
        var result = { width: null, src: null };
        for (var child = figure.firstChild; child != null; child = child.nextSibling) {
            if (child._type == HTML_IMG) {
                result.src = decodeURI(child.getAttribute("src"));
                result.width = child.style.width;
            }
        }
        return result;
    });

    // public
    Figures_setProperties = trace(function setProperties(itemId,width,src)
    {
        var figure = document.getElementById(itemId);
        if (figure == null)
            return null;
        for (var child = figure.firstChild; child != null; child = child.nextSibling) {
            if (child._type == HTML_IMG) {
                if (src == null)
                    DOM_removeAttribute(child,"src");
                else
                    DOM_setAttribute(child,"src",encodeURI(src));

                DOM_setStyleProperties(child,{"width": width});
                if (child.getAttribute("style") == "")
                    DOM_removeAttribute(child,"style");
            }
        }
    });

})();
