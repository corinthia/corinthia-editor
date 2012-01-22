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
    updateSelectionDisplay();
}

// These variables keep track of the portion of the window that is visible on screen (i.e. not
// hidden by the keyboard). We need to keep track of these since scrollIntoViewIfNeeded() does
// not take into account the presence of the keyboard on screen, and every time we move the
// cursor we want to make sure it is visible *above* the keyboard.

var visibleAreaWidth = null;
var visibleAreaHeight = null;

function setVisibleArea(width,height)
{
    visibleAreaWidth = width;
    visibleAreaHeight = height;
    updateSelectionDisplay();
}
