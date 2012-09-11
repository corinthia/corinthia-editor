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
            if ((child._type == HTML_META) && (child.getAttribute("name") == "viewport")) {
                viewportMetaElement = child;
                break;
            }
        }

        if (viewportMetaElement == null) {
            viewportMetaElement = DOM_createElement(document,"META");
            DOM_setAttribute(viewportMetaElement,"name","viewport");
            DOM_appendChild(head,viewportMetaElement);
        }

        if (width != 0) {
            // Only set the width and text scale if they are not already set, to avoid triggering
            // an extra layout at load time
            var contentValue = "width = "+width+", user-scalable = no";
            if (viewportMetaElement.getAttribute("content") != contentValue)
                DOM_setAttribute(viewportMetaElement,"content",contentValue);
        }

        if (textScale != 0) {
            var pct = textScale+"%";
            if (document.documentElement.style.getPropertyValue("-webkit-text-size-adjust") != pct)
                DOM_setStyleProperties(document.documentElement,{"-webkit-text-size-adjust": pct});
        }
    });

    // public
    Viewport_setViewportWidth = trace(function setViewportWidth(width)
    {
        var contentValue = "width = "+width+", user-scalable = no";
        if (viewportMetaElement.getAttribute("content") != contentValue)
            DOM_setAttribute(viewportMetaElement,"content",contentValue);

        Selection_update();
        Cursor_ensureCursorVisible();
    });

    // public
    Viewport_setTextScale = trace(function setTextScale(textScale)
    {
        var pct = textScale+"%";
        if (document.documentElement.style.getPropertyValue("-webkit-text-size-adjust") != pct)
            DOM_setStyleProperties(document.documentElement,{"-webkit-text-size-adjust": pct});

        Selection_update();
        Cursor_ensureCursorVisible();
    });

})();
