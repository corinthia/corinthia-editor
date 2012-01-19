// Copyright (c) 2011-2012 UX Productivity. All rights reserved.

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
    var head = document.createElement("HEAD");
    html.insertBefore(head,html.firstChild);
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
            viewportMetaElement = document.createElement("META");
            viewportMetaElement.setAttribute("name","viewport");
            head.appendChild(viewportMetaElement);
        }
    }
    viewportMetaElement.setAttribute("content","width = "+width);
    updateCursor();
}
