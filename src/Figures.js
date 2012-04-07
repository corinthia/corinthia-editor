(function() {

    // public
    function insertFigure(filename,numbered,caption)
    {
        debug("JS insertFigure: filename = "+filename+
              ", numbered = "+numbered+
              ", caption = "+caption);
    }

    window.Figures = new (function Figures(){});
    Figures.insertFigure = insertFigure;

})();
