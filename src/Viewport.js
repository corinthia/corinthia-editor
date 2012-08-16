// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Viewport_init;
var Viewport_setViewportWidth;
var Viewport_setTextScale;

(function() {

    var viewportMetaElement = null;

    // public
    Viewport_init = trace(function init(width,textScale)
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

        var pct = textScale+"%";
        DOM_setAttribute(viewportMetaElement,"content","width = "+width+", user-scalable = no");
        DOM_setStyleProperties(document.documentElement,{"-webkit-text-size-adjust": pct});
    });

    // public
    Viewport_setViewportWidth = trace(function setViewportWidth(width)
    {
        DOM_setAttribute(viewportMetaElement,"content","width = "+width+", user-scalable = no");

        Selection_update();
        Cursor_ensureCursorVisible();
    });

    // public
    Viewport_setTextScale = trace(function setTextScale(textScale)
    {
        var pct = textScale+"%";
        DOM_setStyleProperties(document.documentElement,{"-webkit-text-size-adjust": pct});

        Selection_update();
        Cursor_ensureCursorVisible();
    });

})();
