(function() {

    // public
    function insertFigure(filename,numbered,caption)
    {
        var figure = DOM.createElement(document,"FIGURE");
        var img = DOM.createElement(document,"IMG");
        img.setAttribute("src",filename);
        DOM.appendChild(figure,img);

        if ((caption != null) && (caption != "")) {
            var figcaption = DOM.createElement(document,"FIGCAPTION");
            DOM.appendChild(figcaption,DOM.createTextNode(document,caption));
            DOM.appendChild(figure,figcaption);
        }

        Clipboard.pasteNodes([figure]);
    }

    window.Figures = new (function Figures(){});
    Figures.insertFigure = insertFigure;

})();
