// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

// FIXME: cursor does not display correctly if it is after a space at the end of the line

(function() {

    var selectionDivs = new Array();
    var selectionRange = null;

    // public
    function getCursorRect()
    {
        if (selectionRange == null)
            return null;

        var pos = selectionRange.end;
        var node = selectionRange.end.node;
        var offset = selectionRange.end.offset;

        if (node.nodeType == Node.ELEMENT_NODE) {
            // Cursor is immediately before table -> return table rect
            if ((offset > 0) && (DOM.upperName(node.childNodes[offset-1]) == "TABLE")) {
                var rect = node.childNodes[offset-1].getBoundingClientRect();
                return { left: rect.left + rect.width,
                         top: rect.top,
                         width: 0,
                         height: rect.height };
            }
            // Cursor is immediately after table -> return table rect
            else if ((offset < node.childNodes.length) &&
                     (DOM.upperName(node.childNodes[offset]) == "TABLE")) {
                var rect = node.childNodes[offset].getBoundingClientRect();
                return { left: rect.left,
                         top: rect.top,
                         width: 0,
                         height: rect.height };
            }

            // Cursor is between two elements. We don't want to use the rect of either element,
            // since its height may not reflect that of the current text size. Temporarily add a
            /// new character, and set the cursor's location and height based on this.
            var tempNode = DOM.createTextNode(document,"X");
            DOM.insertBefore(node,tempNode,node.childNodes[offset]);
            var result = rectAtLeftOfRange(new Range(tempNode,0,tempNode,0));
            DOM.deleteNode(tempNode);
            return result;
        }
        else if (node.nodeType == Node.TEXT_NODE) {
            // First see if the client rects returned by the range gives us a valid value. This
            // won't be the case if the cursor is surrounded by both sides on whitespace.
            var result = rectAtRightOfRange(selectionRange);
            if (result != null)
                return result;

            if (offset > 0) {
                // Try and get the rect of the previous character; the cursor goes after that
                var result = rectAtRightOfRange(new Range(node,offset-1,node,offset));
                if (result != null)
                    return result;
            }

            // Temporarily add a new character, and set the cursor's location to the place
            // that would go.
            var oldNodeValue = node.nodeValue;
            node.nodeValue = node.nodeValue.slice(0,offset) + "X" + node.nodeValue.slice(offset);
            var result = rectAtLeftOfRange(new Range(node,offset,node,offset));
            node.nodeValue = oldNodeValue;
            return result;
        }
        else {
            return null;
        }

        function rectAtRightOfRange(range)
        {
            var rects = range.getClientRects();
            if ((rects == null) || (rects.length == 0) || (rects[rects.length-1].width == 0))
                return null;
            var rect = rects[rects.length-1];
            return { left: rect.left + rect.width,
                     top: rect.top,
                     width: 0,
                     height: rect.height };

        }

        function rectAtLeftOfRange(range)
        {
            var rects = range.getClientRects();
            if ((rects == null) || (rects.length == 0))
                return null;
            var rect = rects[0];
            return { left: rect.left,
                     top: rect.top,
                     width: 0,
                     height: rect.height };
        }
    }

    // public
    function updateSelectionDisplay()
    {
        for (var i = 0; i < selectionDivs.length; i++)
            DOM.deleteNode(selectionDivs[i]);
        selectionDivs = new Array();

        var rects = null;
        if (selectionRange != null)
            rects = selectionRange.getClientRects();

        if ((selectionRange != null) && selectionRange.isEmpty()) {
            // We just have a cursor

            var rect = getCursorRect();

            if (rect != null) {
                var zoom = Viewport.getZoom();
                var left = rect.left + window.scrollX;
                var top = rect.top + window.scrollY;
                var height = rect.height;
                var width = rect.width ? (rect.width * zoom) : 2;
                editor.setCursor(left*zoom,top*zoom,width,height*zoom);
            }
            else {
                editor.setCursor(0,0,300,300);
            }
            return;
        }


        if ((rects != null) && (rects.length > 0)) {
            var boundsLeft = null;
            var boundsRight = null;
            var boundsTop = null;
            var boundsBottom = null

            for (var i = 0; i < rects.length; i++) {
                var div = DOM.createElement(document,"DIV");
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
                div.style.zIndex = -1;
                DOM.appendChild(document.body,div);
                selectionDivs.push(div);
            }

            var firstRect = rects[0];
            var lastRect = rects[rects.length-1];

            var zoom = Viewport.getZoom();
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
        selectionRange = new Range(document.body,0,
                                   document.body,document.body.childNodes.length);
        updateSelectionDisplay();
    }

    // public
    function selectWordAtCursor()
    {
        var selectionRange = Selection.getSelectionRange();
        if (selectionRange == null)
            return;
        var pos = Cursor.closestPositionBackwards(selectionRange.end);
        var node = pos.node;
        var offset = pos.offset;
        if (node.nodeType == Node.TEXT_NODE) {
            selectionRange.start.moveToStartOfWord();
            selectionRange.end.moveToEndOfWord();
            Selection.setSelectionRange(selectionRange);
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            var nodeBefore = null;
            var nodeAfter = null;

            if (offset > 0)
                nodeBefore = node.childNodes[offset-1];
            if (offset+1 < node.childNodes.length)
                nodeAfter = node.childNodes[offset];

            if ((nodeBefore != null) && !isWhitespaceTextNode(nodeBefore)) {
                Selection.setSelectionRange(new Range(node,offset-1,node,offset));
            }
            else if ((nodeAfter != null) && !isWhitespaceTextNode(nodeAfter)) {
                Selection.setSelectionRange(new Range(node,offset,node,offset+1));
            }
        }
    }

    // public
    function beginSelectionAtCoords(x,y)
    {
        selectionRange = null;

        var zoom = Viewport.getZoom();
        var pos = positionAtPoint(x/zoom,y/zoom);
        if (pos != null) {
            if (pos.node.nodeType == Node.TEXT_NODE) {
                selectionRange = new Range(pos.node,pos.offset,pos.node,pos.offset);
                selectionRange.start.moveToStartOfWord();
                selectionRange.end.moveToEndOfWord();
            }
        }

        updateSelectionDisplay();
    }

    // public
    function setSelectionStartAtCoords(x,y)
    {
        var zoom = Viewport.getZoom();
        var position = positionAtPoint(x/zoom,y/zoom);
        if (position != null) {
            selectionRange.start = position;
            updateSelectionDisplay();
        }
    }

    // public
    function setSelectionEndAtCoords(x,y)
    {
        var zoom = Viewport.getZoom();
        var position = positionAtPoint(x/zoom,y/zoom);
        if (position != null) {
            selectionRange.end = position;
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
        var oldRange = selectionRange;
        UndoManager.addAction(function() {
            setSelectionRange(oldRange);
        },"Set selection to "+oldRange);
        selectionRange = range;
        updateSelectionDisplay();
    }

    // public
    function setEmptySelectionAt(node,offset)
    {
        setSelectionRange(new Range(node,offset,node,offset));
    }

    // public
    function deleteSelectionContents()
    {
        if (selectionRange == null)
            return;

        selectionRange = selectionRange.forwards();

        selectionRange.trackWhileExecuting(function() {
            var nodes = selectionRange.getOutermostNodes();
            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];

                var removeWholeNode = false;

                if ((node == selectionRange.start.node) &&
                    (node == selectionRange.end.node)) {
                    var startOffset = selectionRange.start.offset;
                    var endOffset = selectionRange.end.offset;
                    if ((node.nodeType == Node.TEXT_NODE) &&
                        ((startOffset > 0) || (endOffset < node.nodeValue.length))) {
                        DOM.deleteCharacters(node,startOffset,endOffset);
                    }
                    else {
                        removeWholeNode = true;
                    }
                }
                else if (node == selectionRange.start.node) {
                    var offset = selectionRange.start.offset;
                    if ((node.nodeType == Node.TEXT_NODE) && (offset > 0)) {
                        DOM.deleteCharacters(node,offset);
                    }
                    else {
                        removeWholeNode = true;
                    }
                }
                else if (node == selectionRange.end.node) {
                    var offset = selectionRange.end.offset;
                    if ((node.nodeType == Node.TEXT_NODE) && (offset < node.nodeValue.length)) {
                        DOM.deleteCharacters(node,0,offset);
                    }
                    else {
                        removeWholeNode = true;
                    }
                }
                else {
                    removeWholeNode = true;
                }

                if (removeWholeNode) {
                    if ((DOM.upperName(node) == "TD") || (DOM.upperName(node) == "TH"))
                        DOM.deleteAllChildren(node);
                    else
                        DOM.deleteNode(node);
                }
            }

            var detail = selectionRange.detail();

            if ((detail.startAncestor != null) && (detail.endAncestor != null) &&
                (detail.startAncestor.nextSibling == detail.endAncestor)) {
                DOM.mergeWithNextSibling(detail.startAncestor,
                                         Formatting.MERGEABLE_BLOCK_AND_INLINE);
            }

            Cursor.updateBRAtEndOfParagraph(selectionRange.singleNode());
        });

        setEmptySelectionAt(selectionRange.start.node,selectionRange.start.offset);
    }

    // public
    function clearSelection()
    {
        selectionRange = null;
        updateSelectionDisplay();
    }

    window.Selection = new Object();
    Selection.getCursorRect = getCursorRect;
    Selection.updateSelectionDisplay = updateSelectionDisplay;
    Selection.selectAll = selectAll;
    Selection.selectWordAtCursor = selectWordAtCursor;
    Selection.beginSelectionAtCoords = beginSelectionAtCoords;
    Selection.setSelectionStartAtCoords = setSelectionStartAtCoords;
    Selection.setSelectionEndAtCoords = setSelectionEndAtCoords;
    Selection.getSelectionRange = getSelectionRange;
    Selection.setSelectionRange = setSelectionRange;
    Selection.setEmptySelectionAt = setEmptySelectionAt;
    Selection.deleteSelectionContents = deleteSelectionContents;
    Selection.clearSelection = clearSelection;

})();
