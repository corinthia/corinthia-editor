// Copyright (c) 2011-2012 UX Productivity. All rights reserved.

// FIXME: cursor does not display correctly if it is after a space at the end of the line

(function() {

    var selectionDivs = new Array();
    var selectionRange = null;

    // public
    function updateSelectionDisplay()
    {
        for (var i = 0; i < selectionDivs.length; i++)
            selectionDivs[i].parentNode.removeChild(selectionDivs[i]);
        selectionDivs = new Array();

        var rects = null;
        if (selectionRange != null)
            rects = selectionRange.getClientRects();

        if ((selectionRange != null) && selectionRange.isEmpty()) {
            // We just have a cursor
            if ((rects != null) && (rects.length > 0)) {
                left = rects[0].left + window.scrollX;
                top = rects[0].top + window.scrollY;
                width = rects[0].width;
                height = rects[0].height;
            }
            else {
                var absolute = getAbsoluteOffset(selectionRange.start.node);
                left = absolute.offsetLeft;
                top = absolute.offsetTop;            
                width = selectionRange.start.node.parentNode.offsetWidth;
                height = selectionRange.start.node.parentNode.offsetHeight;
            }

            editor.setCursor(left,top,height);
            return;
        }


        if ((rects != null) && (rects.length > 0)) {
            var boundsLeft = null;
            var boundsRight = null;
            var boundsTop = null;
            var boundsBottom = null

            for (var i = 0; i < rects.length; i++) {
                var div = document.createElement("DIV");
                div.style.position = "absolute";

                var left = rects[i].left + window.scrollX;
                var top = rects[i].top + window.scrollY;
                var width = rects[i].width;
                var height = rects[i].height;
                var right = left + width;
                var bottom = top + height;

                if (boundsLeft == null) {
                    boundsLeft = left;
                    boundsTop = top;
                    boundsRight = right;
                    boundsBottom = bottom;
                }
                else {
                    if (boundsLeft > left)
                        boundsLeft = left;
                    if (boundsRight < right)
                        boundsRight = right;
                    if (boundsTop > top)
                        boundsTop = top;
                    if (boundsBottom < bottom)
                        boundsBottom = bottom;
                }

                div.style.left = left+"px";
                div.style.top = top+"px";
                div.style.width = width+"px";
                div.style.height = height+"px";
                div.style.backgroundColor = "rgb(201,221,238)";
                div.style.opacity = "30%";
                div.style.zIndex = -1;
                document.body.appendChild(div);
                selectionDivs.push(div);
            }

            var firstRect = rects[0];
            var lastRect = rects[rects.length-1];

            var zoom = getZoom();
            var x1 = (firstRect.left+window.scrollX)*zoom;
            var y1 = (firstRect.top+window.scrollY)*zoom;
            var height1 = firstRect.height*zoom;
            var x2 = (lastRect.right+window.scrollX)*zoom;
            var y2 = (lastRect.top+window.scrollY)*zoom;
            var height2 = lastRect.height*zoom;

            editor.setSelectionHandles(x1,y1,height1,x2,y2,height2);
            editor.setSelectionBounds(boundsLeft*zoom,boundsTop*zoom,
                                      boundsRight*zoom,boundsBottom*zoom);
        }
        else {
            editor.clearSelectionHandlesAndCursor();
        }

        function getAbsoluteOffset(node)
        {
            var offsetLeft = 0;
            var offsetTop = 0;
            for (; node != null; node = node.parentNode) {
                if (node.offsetLeft != null)
                    offsetLeft += node.offsetLeft;
                if (node.offsetTop != null)
                    offsetTop += node.offsetTop;
            }
            return { offsetLeft: offsetLeft, offsetTop: offsetTop };
        }
    }

    // public
    function selectAll()
    {
        selectionRange = new Range(new Position(document.body,0),
                                   new Position(document.body,document.body.childNodes.length));
        updateSelectionDisplay();
    }

    // public
    function beginSelectionAtCoords(x,y)
    {
        var zoom = getZoom();
        var location = document.caretRangeFromPoint(x/zoom,y/zoom);

        selectionRange = null;

        if (location != null) {
            var node = location.startContainer;
            var offset = location.startOffset;
            if (node.nodeType == Node.TEXT_NODE) {
                selectionRange = new Range(new Position(node,offset),
                                           new Position(node,offset));
                selectionRange.start.moveToStartOfWord();
                selectionRange.end.moveToEndOfWord();
            }
        }

        updateSelectionDisplay();
    }

    // public
    function setSelectionStartAtCoords(x,y)
    {
        var zoom = getZoom();
        var location = document.caretRangeFromPoint(x/zoom,y/zoom);
        if (location != null) {
            selectionRange.start = new Position(location.startContainer,location.startOffset);
            updateSelectionDisplay();
        }
    }

    // public
    function setSelectionEndAtCoords(x,y)
    {
        var zoom = getZoom();
        var location = document.caretRangeFromPoint(x/zoom,y/zoom);
        if (location != null) {
            selectionRange.end = new Position(location.startContainer,location.startOffset);
            updateSelectionDisplay();
        }
    }

    // public
    function getSelectionRange()
    {
        return selectionRange;
    }

    // public
    function setSelectionRange(range)
    {
        selectionRange = range;
        updateSelectionDisplay();
    }

    function ensureCursorVisible()
    {
        var rects = selectionRange.getClientRects();
        if (rects.length > 0) {
            var lastRect = rects[rects.length-1];
            var cursorY = lastRect.top + window.scrollY + lastRect.height/2;
            if ((cursorY < window.scrollY) ||
                (cursorY > window.scrollY + window.innerHeight)) {
                var newScrollY = cursorY - window.innerHeight/2;
                if (newScrollY < 0)
                    newScrollY = 0;
                window.scrollTo(window.scrollX,newScrollY);
            }
        }
    }

    // public
    function setEmptySelectionAt(node,offset)
    {
        setSelectionRange(new Range(new Position(node,offset),new Position(node,offset)));
        ensureCursorVisible();
    }

    // public
    function deleteSelectionContents()
    {
        if (selectionRange == null)
            return;

        var finalNode = selectionRange.start.node;
        var finalOffset = selectionRange.start.offset;

        selectionRange.convertToOffsetFree();
        var nodes = selectionRange.getSelectedNodes();
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];

            var removeWholeNode = false;

            if ((node == selectionRange.start.node) &&
                (node == selectionRange.end.node)) {
                var startOffset = selectionRange.start.offset;
                var endOffset = selectionRange.end.offset;
                if ((node.nodeType == Node.TEXT_NODE) &&
                    ((startOffset > 0) || (endOffset < node.nodeValue.length))) {
                    node.nodeValue = node.nodeValue.slice(0,startOffset) +
                                     node.nodeValue.slice(endOffset);
                }
                else {
                    removeWholeNode = true;
                }
            }
            else if (node == selectionRange.start.node) {
                var offset = selectionRange.start.offset;
                if ((node.nodeType == Node.TEXT_NODE) && (offset > 0)) {
                    node.nodeValue = node.nodeValue.slice(0,offset);
                }
                else {
                    removeWholeNode = true;
                }
            }
            else if (node == selectionRange.end.node) {
                var offset = selectionRange.end.offset;
                if ((node.nodeType == Node.TEXT_NODE) && (offset < node.nodeValue.length)) {
                    node.nodeValue = node.nodeValue.slice(offset);
                }
                else {
                    removeWholeNode = true;
                }
            }
            else {
                removeWholeNode = true;
            }

            if (removeWholeNode) {
                if (finalNode == node) {
                    finalNode = node.parentNode;
                    finalOffset = 0;
                }
                node.parentNode.removeChild(node);
            }
        }

        setEmptySelectionAt(finalNode,finalOffset);
    }

    // public
    function clearSelection()
    {
        selectionRange = null;
        updateSelectionDisplay();
    }

    window.updateSelectionDisplay = updateSelectionDisplay;
    window.selectAll = selectAll;
    window.beginSelectionAtCoords = beginSelectionAtCoords;
    window.setSelectionStartAtCoords = setSelectionStartAtCoords;
    window.setSelectionEndAtCoords = setSelectionEndAtCoords;
    window.getSelectionRange = getSelectionRange;
    window.setSelectionRange = setSelectionRange;
    window.setEmptySelectionAt = setEmptySelectionAt;
    window.deleteSelectionContents = deleteSelectionContents;
    window.clearSelection = clearSelection;

})();
