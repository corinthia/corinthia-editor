// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Viewport_init;
var Viewport_setViewportSize;
var Viewport_getViewportWidth;
var Viewport_getViewportHeight;
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
            DOM_setAttribute(viewportMetaElement,"name","viewport");
            DOM_appendChild(head,viewportMetaElement);
        }
        DOM_setAttribute(viewportMetaElement,"content","width = device-width, user-scalable = no");
    }

    // public
    function setViewportSize(width,height)
    {
        viewportWidth = width;
        viewportHeight = height;
        DOM_setAttribute(viewportMetaElement,"content","width = "+width+", user-scalable = no");

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
    function setTextScale(textScale)
    {
        var pct = Math.floor(textScale*100)+"%";
        DOM_setStyleProperties(document.documentElement,{"-webkit-text-size-adjust": pct});

        Selection_updateSelectionDisplay();
        Cursor_ensureCursorVisible();
    }

    Viewport_init = trace(init);
    Viewport_setViewportSize = trace(setViewportSize);
    Viewport_getViewportWidth = getViewportWidth;
    Viewport_getViewportHeight = getViewportHeight;
    Viewport_setTextScale = trace(setTextScale);

})();
