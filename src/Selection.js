// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

// FIXME: cursor does not display correctly if it is after a space at the end of the line

var Selection_getCursorRect;
var Selection_hide;
var Selection_updateSelectionDisplay;
var Selection_show;
var Selection_selectAll;
var Selection_selectParagraph;
var Selection_selectWordAtCursor;
var Selection_dragSelectionBegin;
var Selection_dragSelectionUpdate;
var Selection_setSelectionStartAtCoords;
var Selection_setSelectionEndAtCoords;
var Selection_setTableSelectionEdgeAtCoords;
var Selection_get;
var Selection_set;
var Selection_clear;
var Selection_setSelectionRange;
var Selection_setEmptySelectionAt;
var Selection_deleteSelectionContents;
var Selection_clearSelection;
var Selection_hideWhileExecuting;
var Selection_trackWhileExecuting;

(function() {

    var selectionDivs = new Array();
    var selectionRange = null;

    var tableSelection = null;
    var selectionVisible = true;

    // public
    Selection_getCursorRect = getCursorRect = trace(getCursorRect);
    function getCursorRect()
    {
        if (selectionRange == null)
            return null;

        var pos = selectionRange.end;
        var node = selectionRange.end.node;
        var offset = selectionRange.end.offset;

        if (node.nodeType == Node.ELEMENT_NODE) {
            // Cursor is immediately before table -> return table rect
            if ((offset > 0) && (DOM_upperName(node.childNodes[offset-1]) == "TABLE")) {
                var rect = node.childNodes[offset-1].getBoundingClientRect();
                return { left: rect.left + rect.width,
                         top: rect.top,
                         width: 0,
                         height: rect.height };
            }
            // Cursor is immediately after table -> return table rect
            else if ((offset < node.childNodes.length) &&
                     (DOM_upperName(node.childNodes[offset]) == "TABLE")) {
                var rect = node.childNodes[offset].getBoundingClientRect();
                return { left: rect.left,
                         top: rect.top,
                         width: 0,
                         height: rect.height };
            }

            // Cursor is between two elements. We don't want to use the rect of either element,
            // since its height may not reflect that of the current text size. Temporarily add a
            /// new character, and set the cursor's location and height based on this.
            var tempNode = DOM_createTextNode(document,"X");
            DOM_insertBefore(node,tempNode,node.childNodes[offset]);
            var result = rectAtLeftOfRange(new Range(tempNode,0,tempNode,0));
            DOM_deleteNode(tempNode);
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

    // private
    updateTableSelection = trace(updateTableSelection);
    function updateTableSelection()
    {
        tableSelection = Tables_regionFromRange(selectionRange);
        if (tableSelection == null)
            return false;

        var sel = tableSelection;

        var topLeftTD = sel.structure.get(sel.top,sel.left);
        var bottomRightTD = sel.structure.get(sel.bottom,sel.right);

        var topLeftRect = topLeftTD.element.getBoundingClientRect();
        var bottomRightRect = bottomRightTD.element.getBoundingClientRect();

        var left = topLeftRect.left;
        var top = topLeftRect.top;

        var bottom = bottomRightRect.bottom;
        var right = bottomRightRect.right;

        var x = left;
        var y = top;
        var width = right - left;
        var height = bottom - top;

        x += window.scrollX;
        y += window.scrollY;

        var div = DOM_createElement(document,"DIV");
        DOM_setAttribute(div,"class",Keys.SELECTION_HIGHLIGHT);
        DOM_setStyleProperties(div,{ "position": "absolute",
                                     "left": x+"px",
                                     "top": y+"px",
                                     "width": width+"px",
                                     "height": height+"px",
                                     "background-color": "rgb(201,221,238)",
                                     "z-index": -1 });
        DOM_appendChild(document.body,div);
        selectionDivs.push(div);

        Editor_setTableSelection(x,y,width,height);

        return true;
    }

    // public
    Selection_hide = hide = trace(hide);
    function hide()
    {
        if (!selectionVisible)
            throw new Error("Selection is already hidden");
        selectionVisible = false;
        for (var i = 0; i < selectionDivs.length; i++)
            DOM_deleteNode(selectionDivs[i]);
        selectionDivs = new Array();
    }

    // public
    Selection_updateSelectionDisplay = updateSelectionDisplay = trace(updateSelectionDisplay);
    function updateSelectionDisplay()
    {
        if (selectionVisible)
            hide();
        show();
    }

    Selection_show = show = trace(show);
    function show()
    {
        if (selectionVisible)
            throw new Error("Selection is already visible");
        selectionVisible = true;
        var rects = null;
        if (selectionRange != null)
            rects = selectionRange.getClientRects();

        if ((selectionRange != null) && selectionRange.isEmpty()) {
            // We just have a cursor

            var rect = getCursorRect();

            if (rect != null) {
                var left = rect.left + window.scrollX;
                var top = rect.top + window.scrollY;
                var height = rect.height;
                var width = rect.width ? rect.width : 2;
                Editor_setCursor(left,top,width,height);
            }
            else {
                Editor_setCursor(0,0,300,300);
            }
            return;
        }

        if (updateTableSelection())
            return;

        if ((rects != null) && (rects.length > 0)) {
            var boundsLeft = null;
            var boundsRight = null;
            var boundsTop = null;
            var boundsBottom = null

            for (var i = 0; i < rects.length; i++) {
                var div = DOM_createElement(document,"DIV");
                DOM_setAttribute(div,"class",Keys.SELECTION_HIGHLIGHT);
                DOM_setStyleProperties(div,{"position": "absolute"});

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

                DOM_setStyleProperties(div,{ "left": left+"px",
                                             "top": top+"px",
                                             "width": width+"px",
                                             "height": height+"px",
                                             "background-color": "rgb(201,221,238)",
                                             "z-index": -1 });
                DOM_appendChild(document.body,div);
                selectionDivs.push(div);
            }

            var firstRect = rects[0];
            var lastRect = rects[rects.length-1];

            var x1 = firstRect.left + window.scrollX;
            var y1 = firstRect.top + window.scrollY;
            var height1 = firstRect.height;
            var x2 = lastRect.right + window.scrollX;
            var y2 = lastRect.top + window.scrollY;
            var height2 = lastRect.height;

            Editor_setSelectionHandles(x1,y1,height1,x2,y2,height2);
            Editor_setSelectionBounds(boundsLeft,boundsTop,
                                      boundsRight,boundsBottom);
        }
        else {
            Editor_clearSelectionHandlesAndCursor();
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
    Selection_selectAll = selectAll = trace(selectAll);
    function selectAll()
    {
        selectionRange = new Range(document.body,0,
                                   document.body,document.body.childNodes.length);
        Selection_updateSelectionDisplay();
    }

    // public
    Selection_selectParagraph = selectParagraph = trace(selectParagraph);
    function selectParagraph()
    {
        if (selectionRange == null)
            return;
        Selection_hideWhileExecuting(function() {
            var startNode = selectionRange.start.closestActualNode();
            while (!isParagraphNode(startNode) && !isContainerNode(startNode))
                startNode = startNode.parentNode;

            var endNode = selectionRange.end.closestActualNode();
            while (!isParagraphNode(endNode) && !isContainerNode(endNode))
                endNode = endNode.parentNode;

            var startPos = new Position(startNode.parentNode,DOM_nodeOffset(startNode));
            var endPos = new Position(endNode.parentNode,DOM_nodeOffset(endNode)+1);
            startPos = Cursor_closestPositionForwards(startPos);
            endPos = Cursor_closestPositionBackwards(endPos);

            Selection_set(startPos.node,startPos.offset,endPos.node,endPos.offset);
        });
    }

    // private
    getPunctuationCharsForRegex = trace(getPunctuationCharsForRegex);
    function getPunctuationCharsForRegex()
    {
        var escaped = "^$\\.*+?()[]{}|"; // From ECMAScript regexp spec (PatternCharacter)
        var unescaped = "";
        for (var i = 32; i <= 127; i++) {
            var c = String.fromCharCode(i);
            if ((escaped.indexOf(c) < 0) && !c.match(/[\w\d]/))
                unescaped += c;
        }
        return unescaped + escaped.replace(/(.)/g,"\\$1");
    }

    // The following regular expressions are used by selectWordAtCursor(). We initialise them at
    // startup to avoid repeatedly initialising them.
    var punctuation = getPunctuationCharsForRegex();
    var wsPunctuation = "\\s"+punctuation;

    // Note: We use a blacklist of punctuation characters here instead of a whitelist of "word"
    // characters, as the \w character class in javascript regular expressions only matches
    // characters in english words. By using a blacklist, and assuming every other character is
    // part of a word, we can select words containing non-english characters. This isn't a perfect
    // solution, because there are many unicode characters that represent punctuation as well, but
    // at least we handle the common ones here.

    var reOtherEnd = new RegExp("["+wsPunctuation+"]*$");
    var reOtherStart = new RegExp("^["+wsPunctuation+"]*");
    var reWordOtherEnd = new RegExp("[^"+wsPunctuation+"]*["+wsPunctuation+"]*$");
    var reWordOtherStart = new RegExp("^["+wsPunctuation+"]*[^"+wsPunctuation+"]*");

    // public
    Selection_selectWordAtCursor = selectWordAtCursor = trace(selectWordAtCursor);
    function selectWordAtCursor()
    {
        var selectionRange = Selection_get();
        if (selectionRange == null)
            return;

        Selection_hideWhileExecuting(function() {
            var pos = Cursor_closestPositionBackwards(selectionRange.end);
            var node = pos.node;
            var offset = pos.offset;

            if (node.nodeType == Node.TEXT_NODE) {
                var before = node.nodeValue.substring(0,offset);
                var after = node.nodeValue.substring(offset);

                var otherBefore = before.match(reOtherEnd)[0];
                var otherAfter = after.match(reOtherStart)[0];

                var wordOtherBefore = before.match(reWordOtherEnd)[0];
                var wordOtherAfter = after.match(reWordOtherStart)[0];

                var startOffset = offset;
                var endOffset = offset;

                var haveWordBefore = (wordOtherBefore.length != otherBefore.length);
                var haveWordAfter = (wordOtherAfter.length != otherAfter.length);

                if ((otherBefore.length == 0) && (otherAfter.length == 0)) {
                    startOffset = offset - wordOtherBefore.length;
                    endOffset = offset + wordOtherAfter.length;
                }
                else if (haveWordBefore && !haveWordAfter) {
                    startOffset = offset - wordOtherBefore.length;
                }
                else if (haveWordAfter && !haveWordBefore) {
                    endOffset = offset + wordOtherAfter.length;
                }
                else if (otherBefore.length <= otherAfter.length) {
                    startOffset = offset - wordOtherBefore.length;
                }
                else {
                    endOffset = offset + wordOtherAfter.length;
                }

                Selection_set(node,startOffset,node,endOffset);
            }
            else if (node.nodeType == Node.ELEMENT_NODE) {
                var nodeBefore = node.childNodes[offset-1];
                var nodeAfter = node.childNodes[offset];

                if ((nodeBefore != null) && !isWhitespaceTextNode(nodeBefore))
                    Selection_set(node,offset-1,node,offset);
                else if ((nodeAfter != null) && !isWhitespaceTextNode(nodeAfter))
                    Selection_set(node,offset,node,offset+1);
            }
        });
    }

    var originalDragStart = null;
    var originalDragEnd = null;

    // public
    Selection_dragSelectionBegin = dragSelectionBegin = trace(dragSelectionBegin);
    function dragSelectionBegin(x,y,selectWord)
    {
        selectionRange = null;
        originalDragStart = null;
        originalDragEnd = null;

        var result = Selection_hideWhileExecuting(function() {
            var pos = Cursor_closestPositionForwards(positionAtPoint(x,y));
            if (pos == null)
                return "error";

            Selection_set(pos.node,pos.offset,pos.node,pos.offset);
            return "end";
        });

        if (selectWord) {
            Selection_selectWordAtCursor();
            if (result != "error") {
                originalDragStart = new Position(selectionRange.start.node,
                                                 selectionRange.start.offset);
                originalDragEnd = new Position(selectionRange.end.node,
                                               selectionRange.end.offset);
            }
        }
        return result;
    }

    // public
    Selection_dragSelectionUpdate = dragSelectionUpdate = trace(dragSelectionUpdate);
    function dragSelectionUpdate(x,y)
    {
        // It is possible that when the user first double-tapped, there was no point at that
        // position, i.e. the pos == null case in dragSelectionBegin(). So we just try to begin
        // the selection again.
        if ((originalDragStart == null) || (originalDragEnd == null))
            return dragSelectionBegin(x,y);

        return Selection_hideWhileExecuting(function() {
            var pos = Cursor_closestPositionForwards(positionAtPoint(x,y));
            if (pos != null) {

                var startToPos = new Range(originalDragStart.node,originalDragStart.offset,
                                           pos.node,pos.offset);
                var posToEnd = new Range(pos.node,pos.offset,
                                         originalDragEnd.node,originalDragEnd.offset);

                if (startToPos.isForwards() && posToEnd.isForwards()) {
                    // Position is within the original selection
                    Selection_set(originalDragStart.node,originalDragStart.offset,
                                  originalDragEnd.node,originalDragEnd.offset)
                }
                else if (!startToPos.isForwards()) {
                    // Position comes before the start
                    Selection_set(posToEnd.start.node,posToEnd.start.offset,
                                  posToEnd.end.node,posToEnd.end.offset);
                    return "start";
                }
                else if (!posToEnd.isForwards()) {
                    // Position comes after the end
                    Selection_set(startToPos.start.node,startToPos.start.offset,
                                  startToPos.end.node,startToPos.end.offset);
                    return "end";
                }
            }
            return "none";
        });
    }

    // public
    Selection_setSelectionStartAtCoords = setSelectionStartAtCoords =
        trace(setSelectionStartAtCoords);
    function setSelectionStartAtCoords(x,y)
    {
        var position = Cursor_closestPositionForwards(positionAtPoint(x,y));
        if (position != null) {
            position = Cursor_closestPositionBackwards(position);
            var newRange = new Range(position.node,position.offset,
                                     selectionRange.end.node,selectionRange.end.offset);
            if (newRange.isForwards()) {
                selectionRange = newRange;
                Selection_updateSelectionDisplay();
            }
        }
    }

    // public
    Selection_setSelectionEndAtCoords = setSelectionEndAtCoords = trace(setSelectionEndAtCoords);
    function setSelectionEndAtCoords(x,y)
    {
        var position = Cursor_closestPositionForwards(positionAtPoint(x,y));
        if (position != null) {
            position = Cursor_closestPositionBackwards(position);
            var newRange = new Range(selectionRange.start.node,selectionRange.start.offset,
                                     position.node,position.offset);
            if (newRange.isForwards()) {
                selectionRange = newRange;
                Selection_updateSelectionDisplay();
            }
        }
    }

    // public
    Selection_setTableSelectionEdgeAtCoords = setTableSelectionEdgeAtCoords =
        trace(setTableSelectionEdgeAtCoords);
    function setTableSelectionEdgeAtCoords(edge,x,y)
    {
        if (tableSelection == null)
            return;

        var structure = tableSelection.structure;
        var pointInfo = findCellInTable(structure,x,y);
        if (pointInfo == null)
            return;

        Selection_hideWhileExecuting(function() {
            if (edge == "topLeft") {
                if (pointInfo.row <= tableSelection.bottom)
                    tableSelection.top = pointInfo.row;
                if (pointInfo.col <= tableSelection.right)
                    tableSelection.left = pointInfo.col;
            }
            else if (edge == "bottomRight") {
                if (pointInfo.row >= tableSelection.top)
                    tableSelection.bottom = pointInfo.row;
                if (pointInfo.col >= tableSelection.left)
                    tableSelection.right = pointInfo.col;
            }

            // FIXME: handle the case where there is no cell at the specified row and column
            var topLeftCell = structure.get(tableSelection.top,tableSelection.left);
            var bottomRightCell = structure.get(tableSelection.bottom,tableSelection.right);

            var topLeftNode = topLeftCell.element.parentNode;
            var topLeftOffset = DOM_nodeOffset(topLeftCell.element);
            var bottomRightNode = bottomRightCell.element.parentNode;
            var bottomRightOffset = DOM_nodeOffset(bottomRightCell.element)+1;

            Selection_set(topLeftNode,topLeftOffset,bottomRightNode,bottomRightOffset);
        });

        // FIXME: this could possibly be optimised
        function findCellInTable(structure,x,y)
        {
            for (var r = 0; r < structure.numRows; r++) {
                for (var c = 0; c < structure.numCols; c++) {
                    var cell = structure.get(r,c);
                    if (cell != null) {
                        var rect = cell.element.getBoundingClientRect();
                        if ((x >= rect.left) && (x <= rect.right) &&
                            (y >= rect.top) && (y <= rect.bottom))
                            return cell;
                    }
                }
            }
            return null;
        }
    }

    // public
    Selection_get = get = trace(get);
    function get()
    {
        if (selectionRange == null) {
            return null;
        }
        else {
            return new Range(selectionRange.start.node,selectionRange.start.offset,
                             selectionRange.end.node,selectionRange.end.offset);
        }
    }

    // public
    Selection_set = set = trace(set);
    function set(startNode,startOffset,endNode,endOffset)
    {
        if (selectionVisible)
            throw new Error("Attempt to set selection while visible");
        selectionRange = new Range(startNode,startOffset,endNode,endOffset).forwards();
    }

    // public
    Selection_clear = clear = trace(clear)
    function clear()
    {
        if (selectionVisible)
            throw new Error("Attempt to clear selection while visible");
        selectionRange = null;
    }

    // public
    Selection_setSelectionRange = setSelectionRange = trace(setSelectionRange);
    function setSelectionRange(range)
    {
        Selection_hideWhileExecuting(function() {
            if (range == null)
                Selection_clear();
            else
                Selection_set(range.start.node,range.start.offset,range.end.node,range.end.offset);
        });
    }

    // public
    Selection_setEmptySelectionAt = setEmptySelectionAt = trace(setEmptySelectionAt);
    function setEmptySelectionAt(node,offset)
    {
        Selection_hideWhileExecuting(function() {
            Selection_set(node,offset,node,offset);
        });
    }

    // private
    deleteTextSelection = trace(deleteTextSelection);
    function deleteTextSelection(selectionRange)
    {
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
                    DOM_deleteCharacters(node,startOffset,endOffset);
                }
                else {
                    removeWholeNode = true;
                }
            }
            else if (node == selectionRange.start.node) {
                var offset = selectionRange.start.offset;
                if ((node.nodeType == Node.TEXT_NODE) && (offset > 0)) {
                    DOM_deleteCharacters(node,offset);
                }
                else {
                    removeWholeNode = true;
                }
            }
            else if (node == selectionRange.end.node) {
                var offset = selectionRange.end.offset;
                if ((node.nodeType == Node.TEXT_NODE) && (offset < node.nodeValue.length)) {
                    DOM_deleteCharacters(node,0,offset);
                }
                else {
                    removeWholeNode = true;
                }
            }
            else {
                removeWholeNode = true;
            }

            if (removeWholeNode) {
                if ((DOM_upperName(node) == "TD") || (DOM_upperName(node) == "TH"))
                    DOM_deleteAllChildren(node);
                else
                    DOM_deleteNode(node);
            }
        }

        var detail = selectionRange.detail();

        if ((detail.startAncestor != null) && (detail.endAncestor != null) &&
            (detail.startAncestor.nextSibling == detail.endAncestor)) {
            prepareForMerge(detail);
            DOM_mergeWithNextSibling(detail.startAncestor,
                                     Formatting_MERGEABLE_BLOCK_AND_INLINE);
            if (isParagraphNode(detail.startAncestor) &&
                (DOM_upperName(detail.startAncestor) != "DIV"))
                removeParagraphDescendants(detail.startAncestor);
        }

        Cursor_updateBRAtEndOfParagraph(selectionRange.singleNode());
    }

    // public
    Selection_deleteSelectionContents = deleteSelectionContents = trace(deleteSelectionContents);
    function deleteSelectionContents(allowInvalidCursorPos)
    {
        if (selectionRange == null)
            return;

        Selection_hideWhileExecuting(function() {
            selectionRange.trackWhileExecuting(function() {
                var region = Tables_regionFromRange(selectionRange);
                if (region != null)
                    Tables_deleteRegion(region);
                else
                    deleteTextSelection(selectionRange);
            });

            if (allowInvalidCursorPos) {
                var node = selectionRange.start.node;
                var offset = selectionRange.start.offset;
                Selection_set(node,offset,node,offset);
            }
            else {
                var pos = Cursor_closestPositionForwards(selectionRange.start);
                var node = pos.node;
                var offset = pos.offset;
                Selection_set(node,offset,node,offset);
            }
        });
    }

    // private
    removeParagraphDescendants = trace(removeParagraphDescendants);
    function removeParagraphDescendants(parent)
    {
        var next;
        for (var child = parent.firstChild; child != null; child = next) {
            next = child.nextSibling;
            removeParagraphDescendants(child);
            if (isParagraphNode(child))
                DOM_removeNodeButKeepChildren(child);
        }
    }

    // private
    findFirstParagraph = trace(findFirstParagraph);
    function findFirstParagraph(node)
    {
        if (isParagraphNode(node))
            return node;
        if (isListItemNode(node)) {
            var nonWhitespaceInline = false;

            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                if (isInlineNode(child) && !isWhitespaceTextNode(child))
                    nonWhitespaceInline = true;

                if (isParagraphNode(child)) {
                    if (nonWhitespaceInline)
                        return putPrecedingSiblingsInParagraph(node,child);
                    return child;
                }
                else if (isListNode(child)) {
                    if (nonWhitespaceInline)
                        return putPrecedingSiblingsInParagraph(node,child);
                    return findFirstParagraph(child);
                }
            }
            if (nonWhitespaceInline)
                return putPrecedingSiblingsInParagraph(node,null);
        }
        return null;

        function putPrecedingSiblingsInParagraph(parent,node)
        {
            var p = DOM_createElement(document,"P");
            while (parent.firstChild != node)
                DOM_appendChild(p,parent.firstChild);
            return p;
        }
    }

    // private
    prepareForMerge = trace(prepareForMerge);
    function prepareForMerge(detail)
    {
        if (isParagraphNode(detail.startAncestor) && isInlineNode(detail.endAncestor)) {
            var name = detail.startAncestor.nodeName; // check-ok
            var newParagraph = DOM_createElement(document,name);
            DOM_insertBefore(detail.endAncestor.parentNode,newParagraph,detail.endAncestor);
            DOM_appendChild(newParagraph,detail.endAncestor);
            detail.endAncestor = newParagraph;
        }
        else if (isInlineNode(detail.startAncestor) && isParagraphNode(detail.endAncestor)) {
            var name = detail.endAncestor.nodeName; // check-ok
            var newParagraph = DOM_createElement(document,name);
            DOM_insertBefore(detail.startAncestor.parentNode,newParagraph,
                             detail.startAncestor.nextSibling);
            DOM_appendChild(newParagraph,detail.startAncestor);
            detail.startAncestor = newParagraph;
        }
        else if (isParagraphNode(detail.startAncestor) &&
                 isListNode(detail.endAncestor) &&
                 isListItemNode(detail.endAncestor.firstChild)) {
            var list = detail.endAncestor;
            var li = detail.endAncestor.firstChild;

            var paragraph = findFirstParagraph(li);
            if (paragraph != null) {
                DOM_insertBefore(list.parentNode,paragraph,list);
                var name = detail.startAncestor.nodeName; // check-ok
                DOM_replaceElement(paragraph,name);
            }
            if (!nodeHasContent(li))
                DOM_deleteNode(li);
            if (firstChildElement(list) == null)
                DOM_deleteNode(list);
        }
        else if (isParagraphNode(detail.endAncestor) &&
                 isListNode(detail.startAncestor) &&
                 isListItemNode(detail.startAncestor.lastChild)) {
            var list = detail.startAncestor;
            var li = detail.startAncestor.lastChild;
            var p = detail.endAncestor;
            var oldLastChild = li.lastChild;
            while (p.firstChild != null)
                DOM_insertBefore(li,p.firstChild,null);
            DOM_deleteNode(p);
            if (oldLastChild != null) {
                DOM_mergeWithNextSibling(oldLastChild,
                                         Formatting_MERGEABLE_BLOCK_AND_INLINE);
            }
        }

        if ((detail.startAncestor.lastChild != null) && (detail.endAncestor.firstChild != null)) {
            var childDetail = new Object();
            childDetail.startAncestor = detail.startAncestor.lastChild;
            childDetail.endAncestor = detail.endAncestor.firstChild;
            prepareForMerge(childDetail);
        }
    }

    // public
    Selection_clearSelection = clearSelection = trace(clearSelection);
    function clearSelection()
    {
        selectionRange = null;
        Selection_updateSelectionDisplay();
    }

    Selection_hideWhileExecuting = hideWhileExecuting = trace(hideWhileExecuting);
    function hideWhileExecuting(fun)
    {
        hide();
        try {
            return fun();
        }
        finally {
            show();
        }
    }

    // public
    Selection_trackWhileExecuting = trackWhileExecuting = trace(trackWhileExecuting);
    function trackWhileExecuting(fun)
    {
        if (selectionRange == null)
            return fun();
        else
            return selectionRange.trackWhileExecuting(fun);
    }

})();
