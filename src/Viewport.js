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
    Viewport_init = trace(function init(width,height,textScale)
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

        viewportWidth = width;
        viewportHeight = height;
        var pct = Math.floor(textScale*100)+"%";
        DOM_setAttribute(viewportMetaElement,"content","width = "+width+", user-scalable = no");
        DOM_setStyleProperties(document.documentElement,{"-webkit-text-size-adjust": pct});
    });

    // public
    Viewport_setViewportSize = trace(function setViewportSize(width,height)
    {
        viewportWidth = width;
        viewportHeight = height;
        DOM_setAttribute(viewportMetaElement,"content","width = "+width+", user-scalable = no");

        Selection_update();
        Cursor_ensureCursorVisible();
    });

    // public
    Viewport_getViewportWidth = trace(function getViewportWidth()
    {
        return viewportWidth;
    });

    // public
    Viewport_getViewportHeight = trace(function getViewportHeight()
    {
        return viewportHeight;
    });

    // public
    Viewport_setTextScale = trace(function setTextScale(textScale)
    {
        var pct = Math.floor(textScale*100)+"%";
        DOM_setStyleProperties(document.documentElement,{"-webkit-text-size-adjust": pct});

        Selection_update();
        Cursor_ensureCursorVisible();
    });

})();
