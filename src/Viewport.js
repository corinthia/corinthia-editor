// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function() {

    var viewportMetaElement = null;
    var viewportWidth = null;
    var viewportHeight = null;
    var scale = null;

    var viewportMetaWidth = 980;
    var viewportMetaInitialScale = 1.0;

    debug("initial window.innerWidth = "+window.innerWidth);
    debug("initial window.outerWidth = "+window.outerWidth);

    function getViewportMetaElement()
    {
        if (viewportMetaElement == null) {
            var head = DOM.documentHead(document);
            for (var child = head.firstChild; child != null; child = child.nextSibling) {
                if ((DOM.upperName(child) == "META") &&
                    (child.getAttribute("name") == "viewport")) {
                    viewportMetaElement = child;
                    break;
                }
            }
            if (viewportMetaElement == null) {
                viewportMetaElement = DOM.createElement(document,"META");
                viewportMetaElement.setAttribute("name","viewport");
                DOM.appendChild(head,viewportMetaElement);
            }
        }
        return viewportMetaElement;
    }

    function updateMetaViewport()
    {
        var viewport = getViewportMetaElement();
        viewport.setAttribute("content","width = "+viewportMetaWidth+
                              ", initial-scale = "+viewportMetaInitialScale);
        debug("content = "+viewport.getAttribute("content"));
    }

//    setMetaViewportWidth = trace(setMetaViewportWidth);

    function setViewport(width,height,zoom)
    {
        var viewport = getViewportMetaElement();
        debug("innerWidth = "+window.innerWidth+", outerWidth = "+window.outerWidth);
        if (scale == null)
            scale = window.innerWidth/window.outerWidth;
//        viewport.setAttribute("content","width = device-width, initial-scale = "+
//                             initialScale);
        viewport.setAttribute("content","width = device-width");
        var pct = Math.floor(zoom*100);
        document.body.setAttribute("style","text-align: justify; "+
                                   "-webkit-text-size-adjust: "+pct+"%");
//        debug(document.body.getAttribute("style"));

        document.documentElement.setAttribute("style",//"text-align: justify; "+
                                   "color: red; "+
                                   "-webkit-transform-origin: top left; "+
                                   "-webkit-transform: scale("+1.5+","+1.5+")");
    }


    // public
    function setViewport1(width,height,zoom)
    {
        debug("setViewport: width = "+width+", height = "+height+", zoom = "+zoom);
        var metaWidth = Math.floor(width/zoom);
//        setMetaViewportWidth(metaWidth,980/width);
//        viewportMetaWidth = metaWidth;
//        updateMetaViewport();

        viewportWidth = width;
        viewportHeight = height;
        viewportZoom = zoom;

        scale = window.innerWidth/metaWidth;
//        viewportMetaInitialScale = scale;
        viewportMetaInitialScale = zoom;
        updateMetaViewport();
        debug("scale = "+scale);


        document.documentElement.setAttribute("style",//"text-align: justify; "+
                                   "color: red; "+
                                   "-webkit-transform-origin: top left; "+
                                   "-webkit-transform: scale("+scale+","+scale+")");
        debug("transform origin = "+document.body.style.webkitTransformOrigin);
        debug("transform = "+document.body.style.webkitTransform);


        debug("window.innerWidth = "+window.innerWidth);
        debug("window.outerWidth = "+window.outerWidth);
        debug("");

        Selection.updateSelectionDisplay();
        Cursor.ensureCursorVisible();
    }

    // public
    function getViewportWidth()
    {
        return viewportWidth;
    }

    // public
    function getViewportHeight()
    {
        return viewportHeight;
    }

    // public
    function getZoom()
    {
        return scale;
    }

    // public
    function getRatio()
    {
        return window.innerWidth/window.outerWidth;
    }

    window.Viewport = new (function Viewport(){});
    Viewport.setViewport = trace(setViewport);
    Viewport.getViewportWidth = getViewportWidth;
    Viewport.getViewportHeight = getViewportHeight;
    Viewport.getZoom = getZoom;
    Viewport.getRatio = getRatio;

})();
