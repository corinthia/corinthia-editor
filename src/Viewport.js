// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function() {

    var viewportWidth = null;
    var viewportHeight = null;

    // public
    function init()
    {
        var head = DOM.documentHead(document);
        var viewportMetaElement = null;
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
        viewportMetaElement.setAttribute("content","width = device-width, user-scalable = no");
    }

    // public
    function setViewportSize(width,height)
    {
        viewportWidth = width;
        viewportHeight = height;

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
        return 1;
    }

    // public
    function setTextScale(zoom)
    {
        var pct = Math.floor(zoom*100)+"%";
        document.documentElement.style.webkitTextSizeAdjust = pct;

        Selection.updateSelectionDisplay();
        Cursor.ensureCursorVisible();
    }

    window.Viewport = new (function Viewport(){});
    Viewport.init = trace(init);
    Viewport.setViewportSize = trace(setViewportSize);
    Viewport.getViewportWidth = getViewportWidth;
    Viewport.getViewportHeight = getViewportHeight;
    Viewport.getZoom = getZoom;
    Viewport.setTextScale = trace(setTextScale);

})();
