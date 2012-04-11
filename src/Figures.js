// Copyright (c) 2012 UX Productivity Pty Ltd. All rights reserved.

var Figures_insertFigure;

(function() {

    // public
    function insertFigure(filename,numbered,caption)
    {
        var figure = DOM_createElement(document,"FIGURE");
        var img = DOM_createElement(document,"IMG");
        img.setAttribute("src",filename);
        DOM_appendChild(figure,img);

        if ((caption != null) && (caption != "")) {
            var figcaption = DOM_createElement(document,"FIGCAPTION");
            DOM_appendChild(figcaption,DOM_createTextNode(document,caption));
            DOM_appendChild(figure,figcaption);
        }

        Clipboard_pasteNodes([figure]);
    }

    Figures_insertFigure = insertFigure;

})();
