// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function() {

    var viewportMetaElement = null;
    var viewportWidth = null;
    var viewportHeight = null;

    // FIXME: don't need this; there is always a head
    function getOrCreateHead()
    {
        var html = document.documentElement;
        for (var child = html.firstChild; child != null; child = child.nextSibling) {
            if (DOM.upperName(child) == "HEAD")
                return child;
        }
        var head = DOM.createElement(document,"HEAD");
        DOM.insertBefore(html,head,html.firstChild);
        return head;
    }

    // public
    function setViewportSize(width,height)
    {
        if (viewportWidth != width) {
            if (viewportMetaElement == null) {
                var head = getOrCreateHead();
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
            viewportMetaElement.setAttribute("content","width = "+width);
        }

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
        return window.outerWidth/window.innerWidth;
    }

    window.Viewport = new Object();
    Viewport.setViewportSize = setViewportSize;
    Viewport.getViewportWidth = getViewportWidth;
    Viewport.getViewportHeight = getViewportHeight;
    Viewport.getZoom = getZoom;

})();
