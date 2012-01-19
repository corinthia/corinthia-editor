// Copyright (c) 2011-2012 UX Productivity. All rights reserved.

(function() {

    var selectionDivs = new Array();
    var selectionRange = null;

    function updateSelectionDisplay()
    {
        for (var i = 0; i < selectionDivs.length; i++)
            selectionDivs[i].parentNode.removeChild(selectionDivs[i]);
        selectionDivs = new Array();

        var rects = null;
        if (selectionRange != null)
            rects = selectionRange.getClientRects();

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
            editor.clearSelectionHandles();
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
    function beginSelection(x,y)
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
    function setSelectionStart(x,y)
    {
        var zoom = getZoom();
        var location = document.caretRangeFromPoint(x/zoom,y/zoom);
        if (location != null) {
            selectionRange.start = new Position(location.startContainer,location.startOffset);
            updateSelectionDisplay();
        }
    }

    // public
    function setSelectionEnd(x,y)
    {
        var zoom = getZoom();
        var location = document.caretRangeFromPoint(x/zoom,y/zoom);
        if (location != null) {
            selectionRange.end = new Position(location.startContainer,location.startOffset);
            updateSelectionDisplay();
        }
    }

    // public
    function clearSelection()
    {
        selectionRange = null;
        updateSelectionDisplay();
    }

    window.selectAll = selectAll;
    window.beginSelection = beginSelection;
    window.setSelectionStart = setSelectionStart;
    window.setSelectionEnd = setSelectionEnd;
    window.clearSelection = clearSelection;

})();
