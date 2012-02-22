// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

function getZoom()
{
    return window.outerWidth/window.innerWidth;
}

function getOrCreateHead()
{
    var html = document.documentElement;
    for (var child = html.firstChild; child != null; child = child.nextSibling) {
        if (child.nodeName == "HEAD")
            return child;
    }
    var head = DOM.createElement(document,"HEAD");
    DOM.insertBefore(html,head,html.firstChild);
    return head;
}

var viewportMetaElement = null;

function setViewportWidth(width)
{
    if (viewportMetaElement == null) {
        var head = getOrCreateHead();
        for (var child = head.firstChild; child != null; child = child.nextSibling) {
            if ((child.nodeName == "META") && (child.getAttribute("name") == "viewport")) {
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
    Selection.updateSelectionDisplay();
}
