// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Viewport_init;
var Viewport_setViewportSize;
var Viewport_getViewportWidth;
var Viewport_getViewportHeight;
var Viewport_getZoom;
var Viewport_setTextScale;

(function() {

    var viewportWidth = null;
    var viewportHeight = null;
    var viewportMetaElement = null;

    // public
    function init()
    {
        var head = DOM_documentHead(document);
        for (var child = head.firstChild; child != null; child = child.nextSibling) {
            if ((DOM_upperName(child) == "META") &&
                (child.getAttribute("name") == "viewport")) {
                viewportMetaElement = child;
                break;
            }
        }
        if (viewportMetaElement == null) {
            viewportMetaElement = DOM_createElement(document,"META");
            viewportMetaElement.setAttribute("name","viewport");
            DOM_appendChild(head,viewportMetaElement);
        }
        viewportMetaElement.setAttribute("content","width = device-width, user-scalable = no");
    }

    // public
    function setViewportSize(width,height)
    {
        viewportWidth = width;
        viewportHeight = height;
        viewportMetaElement.setAttribute("content","width = "+width+", user-scalable = no");

        Selection_updateSelectionDisplay();
        Cursor_ensureCursorVisible();
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

        Selection_updateSelectionDisplay();
        Cursor_ensureCursorVisible();
    }

    Viewport_init = trace(init);
    Viewport_setViewportSize = trace(setViewportSize);
    Viewport_getViewportWidth = getViewportWidth;
    Viewport_getViewportHeight = getViewportHeight;
    Viewport_getZoom = getZoom;
    Viewport_setTextScale = trace(setTextScale);

})();
