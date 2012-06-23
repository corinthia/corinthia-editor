// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

// FIXME: cursor does not display correctly if it is after a space at the end of the line

var Selection_get;
var Selection_set;
var Selection_clear;

var Selection_getPositionRect;
var Selection_getCursorRect;
var Selection_update;
var Selection_selectAll;
var Selection_selectParagraph;
var Selection_selectWordAtCursor;
var Selection_dragSelectionBegin;
var Selection_dragSelectionUpdate;
var Selection_moveStartLeft;
var Selection_moveStartRight;
var Selection_moveEndLeft;
var Selection_moveEndRight;
var Selection_setSelectionStartAtCoords;
var Selection_setSelectionEndAtCoords;
var Selection_setTableSelectionEdgeAtCoords;
var Selection_setEmptySelectionAt;
var Selection_deleteRangeContents;
var Selection_deleteContents;
var Selection_clearSelection;
var Selection_preserveWhileExecuting;
var Selection_posAtStartOfWord;
var Selection_posAtEndOfWord;

(function() {

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                            //
    //                                 Selection getter and setter                                //
    //                                                                                            //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    var Selection_setInternal;

    (function() {

        var selection = new Object();

        // public
        Selection_get = trace(function get()
        {
            if (selection.value == null)
                return null;
            else
                return new Range(selection.value.startNode,selection.value.startOffset,
                                 selection.value.endNode,selection.value.endOffset);
        });

        // public
        Selection_setInternal =
            trace(function setInternal(newStartNode,newStartOffset,newEndNode,newEndOffset)
        {
            var range = new Range(newStartNode,newStartOffset,newEndNode,newEndOffset);
            if (range.isForwards()) {
                UndoManager_setProperty(selection,"value",
                                        { startNode: newStartNode,
                                          startOffset: newStartOffset,
                                          endNode: newEndNode,
                                          endOffset: newEndOffset });
            }
            else {
                UndoManager_setProperty(selection,"value",
                                        { startNode: newEndNode,
                                          startOffset: newEndOffset,
                                          endNode: newStartNode,
                                          endOffset: newStartOffset
                                        });
            }
        });

        Selection_set = trace(function set(newStartNode,newStartOffset,newEndNode,newEndOffset)
        {
            Selection_setInternal(newStartNode,newStartOffset,newEndNode,newEndOffset);
            Selection_update();
        });

        // public
        Selection_clear = trace(function clear()
        {
            UndoManager_setProperty(selection,"value",null);
            Selection_update();
        });
    })();

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                            //
    //                                  Other selection functions                                 //
    //                                                                                            //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    var selectionDivs = new Array();
    var selectionSpans = new Array();
    var tableSelection = null;

    Selection_getPositionRect = trace(function getPositionRect(pos)
    {
        var node = pos.node;
        var offset = pos.offset;

        if (node.nodeType == Node.ELEMENT_NODE) {
            if (offset > node.childNodes.length)
                throw new Error("Invalid offset: "+offset+" of "+node.childNodes.length);

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
            var result;
            UndoManager_disableWhileExecuting(function() {
                DOM_ignoreMutationsWhileExecuting(function() {
                    var tempNode = DOM_createTextNode(document,"X");
                    DOM_insertBefore(node,tempNode,node.childNodes[offset]);
                    result = rectAtLeftOfRange(new Range(tempNode,0,tempNode,0));
                    DOM_deleteNode(tempNode);
                });
            });
            return result;
        }
        else if (node.nodeType == Node.TEXT_NODE) {
            // First see if the client rects returned by the range gives us a valid value. This
            // won't be the case if the cursor is surrounded by both sides on whitespace.
            var result = rectAtRightOfRange(new Range(node,offset,node,offset));
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
            var result;
            DOM_ignoreMutationsWhileExecuting(function() {
                var oldNodeValue = node.nodeValue;
                node.nodeValue = node.nodeValue.slice(0,offset) + "X" +
                                 node.nodeValue.slice(offset);
                result = rectAtLeftOfRange(new Range(node,offset,node,offset));
                node.nodeValue = oldNodeValue;
            });
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
    });

    // public
    Selection_getCursorRect = trace(function getCursorRect()
    {
        var selRange = Selection_get();
        if (selRange != null)
            return Selection_getPositionRect(selRange.end);
        else
            return null;
    });

    // private
    updateTableSelection = trace(function updateTableSelection(selRange)
    {
        tableSelection = Tables_regionFromRange(selRange);
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

        setEditorHandles({ type: "table", x: x, y: y, width: width, height: height });

        return true;
    });

    var editorHandles = { type: "none" };
    var setEditorHandles = trace(function setEditorHandles(info)
    {
        var oldEditorHandles = editorHandles;
        editorHandles = info;
        UndoManager_addAction(function() {
            setEditorHandles(oldEditorHandles);
        });
        if (info.type == "cursor") {
            Editor_setCursor(info.left,info.top,info.width,info.height);
        }
        else if (info.type == "selection") {
            Editor_setSelectionHandles(info.x1,info.y1,info.height1,info.x2,info.y2,info.height2);
            Editor_setSelectionBounds(info.boundsLeft,info.boundsTop,
                                      info.boundsRight,info.boundsBottom);
        }
        else if (info.type == "none") {
            Editor_clearSelectionHandlesAndCursor();
        }
        else if (info.type == "table") {
            Editor_setTableSelection(info.x,info.y,info.width,info.height);
        }
        else {
            throw new Error("setEditorHandles: unknown type "+type);
        }
    });

    var getPrevSpanText = trace(function getPrevSpanText(node)
    {
        if ((node.previousSibling != null) &&
            isSelectionSpan(node.previousSibling) &&
            (node.previousSibling.lastChild != null) &&
            (node.previousSibling.lastChild.nodeType == Node.TEXT_NODE))
            return node.previousSibling.lastChild;
        else
            return null;
    });

    var getNextSpanText = trace(function getNextSpanText(node)
    {
        if ((node.nextSibling != null) &&
            isSelectionSpan(node.nextSibling) &&
            (node.nextSibling.firstChild != null) &&
            (node.nextSibling.firstChild.nodeType == Node.TEXT_NODE))
            return node.nextSibling.firstChild;
        else
            return null;
    });

    var insertTextBefore = trace(function insertTextBefore(str,node)
    {
        var prev = node.previousSibling;
        if ((prev != null) && (prev.nodeType == Node.TEXT_NODE)) {
            DOM_insertCharacters(prev,prev.nodeValue.length,str);
        }
        else {
            var text = DOM_createTextNode(document,str);
            DOM_insertBefore(node.parentNode,text,node);
        }
    });

    var insertTextAfter = trace(function insertTextAfter(str,node)
    {
        var next = node.nextSibling;
        if ((next != null) && (next.nodeType == Node.TEXT_NODE)) {
            DOM_insertCharacters(next,0,str);
        }
        else {
            var text = DOM_createTextNode(document,str);
            DOM_insertBefore(node.parentNode,text,node.nextSibling);
        }
    });

    var setSelectionSpans = trace(function setSelectionSpans(spans)
    {
        UndoManager_addAction(setSelectionSpans,selectionSpans);
        selectionSpans = spans;
    });

    var createSelectionSpans = trace(function createSelectionSpans(selRange)
    {
        var skipped = 0;
        var reused = 0;
        var nodes = selRange.getAllNodes();
        var newSpans = arrayCopy(selectionSpans);
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];

            if (node.nodeType != Node.TEXT_NODE)
                continue;

            if (isSelectionSpan(node.parentNode)) {
                skipped++;

                if ((node == selRange.end.node) && (node.nodeValue.length > selRange.end.offset)) {
                    var notSelected = node.nodeValue.substring(selRange.end.offset);
                    DOM_deleteCharacters(node,selRange.end.offset,node.nodeValue.length);
                    insertTextAfter(notSelected,node.parentNode);
                }
                if ((node == selRange.start.node) && (selRange.start.offset > 0)) {
                    var notSelected = node.nodeValue.substring(0,selRange.start.offset);
                    DOM_deleteCharacters(node,0,selRange.start.offset);
                    insertTextBefore(notSelected,node.parentNode);
                }

                continue;
            }

            var anext;
            for (var a = node; a != null; a = anext) {
                anext = a.parentNode;
                if (isSelectionSpan(a))
                    DOM_removeNodeButKeepChildren(a);
            }

            if (node == selRange.end.node) {
                var prevText = getPrevSpanText(node);
                if (prevText != null) {
                    var substring = node.nodeValue.substring(0,selRange.end.offset);
                    DOM_insertCharacters(prevText,prevText.nodeValue.length,substring);
                    DOM_deleteCharacters(node,0,selRange.end.offset);
                    continue;
                }
                else {
                    if (isWhitespaceString(node.nodeValue.substring(0,selRange.end.offset)))
                        continue;
                    Formatting_splitTextAfter(node,selRange.end.offset,
                                              function() { return true; });
                }
            }

            if (node == selRange.start.node) {
                var nextText = getNextSpanText(node);
                if (nextText != null) {
                    var substring = node.nodeValue.substring(selRange.start.offset);
                    DOM_insertCharacters(nextText,0,substring);
                    DOM_deleteCharacters(node,selRange.start.offset,node.nodeValue.length);
                    continue;
                }
                else {
                    if (isWhitespaceString(node.nodeValue.substring(selRange.start.offset)))
                        continue;
                    Formatting_splitTextBefore(node,selRange.start.offset,
                                              function() { return true; });
                }
            }

            var prevText = getPrevSpanText(node);
            var nextText = getNextSpanText(node);

            if (prevText != null) {
                DOM_insertCharacters(prevText,prevText.nodeValue.length,node.nodeValue);
                DOM_deleteNode(node);
            }
            else if (nextText != null) {
                DOM_insertCharacters(nextText,0,node.nodeValue);
                DOM_deleteNode(node);
            }
            else if (!isWhitespaceTextNode(node)) {
                var wrapped = DOM_wrapNode(node,"SPAN");
                DOM_setAttribute(wrapped,"class",Keys.SELECTION_CLASS);
                newSpans.push(wrapped);
            }
        }
        setSelectionSpans(newSpans);
    });

    var removeSelectionSpans = trace(function removeSelectionSpans(selRange,force)
    {
        var selectedSet = new NodeSet();
        if (selRange != null) {
            var nodes = selRange.getAllNodes();
            for (var i = 0; i < nodes.length; i++)
                selectedSet.add(nodes[i]);
        }

        var remainingSpans = new Array();
        var checkMerge = new Array();
        for (var i = 0; i < selectionSpans.length; i++) {
            var span = selectionSpans[i];
            if ((span.parentNode != null) && (force || !containsSelection(span))) {
                if (span.firstChild != null)
                    checkMerge.push(span.firstChild);
                if (span.lastChild != null)
                    checkMerge.push(span.lastChild);

                DOM_removeNodeButKeepChildren(span);
            }
            else if (span.parentNode != null) {
                remainingSpans.push(span);
            }
        }
        setSelectionSpans(remainingSpans);

        for (var i = 0; i < checkMerge.length; i++) {
            // if not already merged
            if ((checkMerge[i] != null) && (checkMerge[i].parentNode != null)) {
                Formatting_mergeWithNeighbours(checkMerge[i],{});
            }
        }

        function containsSelection(node)
        {
            if (selectedSet.contains(node))
                return true;
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                if (containsSelection(child))
                    return true;
            }
            return false;
        }
    });

    Selection_update = trace(function update()
    {
        // Remove table selection DIVs
        for (var i = 0; i < selectionDivs.length; i++)
            DOM_deleteNode(selectionDivs[i]);
        selectionDivs = new Array();

        var selRange = Selection_get();

        if (selRange == null) {
            DOM_ignoreMutationsWhileExecuting(function() {
                removeSelectionSpans(null);
            });
            return;
        }

        var rects = null;
        if (selRange != null)
            rects = selRange.getClientRects();

        if ((selRange != null) && selRange.isEmpty()) {
            // We just have a cursor

            selRange.trackWhileExecuting(function() {
                DOM_ignoreMutationsWhileExecuting(function() {
                    removeSelectionSpans(selRange);
                });
            });
            // Selection may have changed as a result of removeSelectionSpans()
            Selection_setInternal(selRange.start.node,selRange.start.offset,
                                  selRange.end.node,selRange.end.offset);

            var rect = Selection_getCursorRect();

            if (rect != null) {
                var left = rect.left + window.scrollX;
                var top = rect.top + window.scrollY;
                var height = rect.height;
                var width = rect.width ? rect.width : 2;
                setEditorHandles({ type: "cursor",
                                   left: left,
                                   top: top,
                                   width: width,
                                   height: height});
            }
            else {
                // Represents an invalid position - this should never actually occur
                // FIXME: maybe throw an exception here?
                setEditorHandles({ type: "cursor",
                                   left: 0,
                                   top: 0,
                                   width: 300,
                                   height: 300});
            }
            return;
        }

        if (updateTableSelection(selRange))
            return;

        if ((rects != null) && (rects.length > 0)) {
            var boundsLeft = null;
            var boundsRight = null;
            var boundsTop = null;
            var boundsBottom = null

            for (var i = 0; i < rects.length; i++) {
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
            }

            selRange.trackWhileExecuting(function() {
                DOM_ignoreMutationsWhileExecuting(function() {
                    createSelectionSpans(selRange);
                    removeSelectionSpans(selRange);
                });
            });

            // Selection may have changed as a result of create/removeSelectionSpans()
            Selection_setInternal(selRange.start.node,selRange.start.offset,
                                  selRange.end.node,selRange.end.offset);

            var firstRect = rects[0];
            var lastRect = rects[rects.length-1];

            var x1 = firstRect.left + window.scrollX;
            var y1 = firstRect.top + window.scrollY;
            var height1 = firstRect.height;
            var x2 = lastRect.right + window.scrollX;
            var y2 = lastRect.top + window.scrollY;
            var height2 = lastRect.height;

            setEditorHandles({ type: "selection",
                               x1: x1,
                               y1: y1,
                               height1: height1,
                               x2: x2,
                               y2: y2,
                               height2: height2,
                               boundsLeft: boundsLeft,
                               boundsTop: boundsTop,
                               boundsRight: boundsRight,
                               boundsBottom: boundsBottom });;

        }
        else {
            setEditorHandles({ type: "none" });
        }
        return;

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
    });

    // public
    Selection_selectAll = trace(function selectAll()
    {
        Selection_set(document.body,0,document.body,document.body.childNodes.length);
    });

    // public
    Selection_selectParagraph = trace(function selectParagraph()
    {
        var selRange = Selection_get();
        if (selRange == null)
            return;
        var startNode = selRange.start.closestActualNode();
        while (!isParagraphNode(startNode) && !isContainerNode(startNode))
            startNode = startNode.parentNode;

        var endNode = selRange.end.closestActualNode();
        while (!isParagraphNode(endNode) && !isContainerNode(endNode))
            endNode = endNode.parentNode;

        var startPos = new Position(startNode.parentNode,DOM_nodeOffset(startNode));
        var endPos = new Position(endNode.parentNode,DOM_nodeOffset(endNode)+1);
        startPos = Position_closestMatchForwards(startPos,Position_okForMovement);
        endPos = Position_closestMatchBackwards(endPos,Position_okForMovement);

        Selection_set(startPos.node,startPos.offset,endPos.node,endPos.offset);
    });

    // private
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

    var reWordStart = new RegExp("^[^"+wsPunctuation+"]+");
    var reWordEnd = new RegExp("[^"+wsPunctuation+"]+$");

    Selection_posAtStartOfWord = trace(function posAtStartOfWord(pos)
    {
        var node = pos.node;
        var offset = pos.offset;

        if (node.nodeType == Node.TEXT_NODE) {
            var before = node.nodeValue.substring(0,offset);
            var matches = before.match(reWordEnd);
            if (matches) {
                var wordStart = offset - matches[0].length;
                return new Position(node,wordStart);
            }
        }

        return pos;
    });

    Selection_posAtEndOfWord = trace(function posAtEndOfWord(pos)
    {
        var node = pos.node;
        var offset = pos.offset;

        if (node.nodeType == Node.TEXT_NODE) {
            var after = node.nodeValue.substring(offset);
            var matches = after.match(reWordStart);
            if (matches) {
                var wordEnd = offset + matches[0].length;
                return new Position(node,wordEnd);
            }
        }

        return pos;
    });

    var rangeOfWordAtPos = trace(function rangeOfWordAtPos(pos)
    {
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

            return new Range(node,startOffset,node,endOffset);
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            var nodeBefore = node.childNodes[offset-1];
            var nodeAfter = node.childNodes[offset];

            if ((nodeBefore != null) && !isWhitespaceTextNode(nodeBefore))
                return new Range(node,offset-1,node,offset);
            else if ((nodeAfter != null) && !isWhitespaceTextNode(nodeAfter))
                return new Range(node,offset,node,offset+1);
        }

        return null;
    });

    // public
    Selection_selectWordAtCursor = trace(function selectWordAtCursor()
    {
        var selRange = Selection_get();
        if (selRange == null)
            return;

        var pos = Position_closestMatchBackwards(selRange.end,Position_okForMovement);
        var range = rangeOfWordAtPos(pos);
        if (range != null) {
            Selection_set(range.start.node,range.start.offset,range.end.node,range.end.offset);
        }
    });

    var originalDragStart = null;
    var originalDragEnd = null;

    // public
    Selection_dragSelectionBegin = trace(function dragSelectionBegin(x,y,selectWord)
    {
        var range = Selection_get();
        if ((range != null) && !range.isEmpty())
            return Selection_dragSelectionUpdate(x,y,selectWord);

        if (originalDragStart != null)
            Position_untrack(originalDragStart);
        if (originalDragEnd != null)
            Position_untrack(originalDragEnd);
        originalDragStart = null;
        originalDragEnd = null;

        var result;
        var pos = Position_closestMatchForwards(positionAtPoint(x,y),Position_okForMovement);
        if (pos == null) {
            Selection_clear();
            result = "error";
        }
        else {
            Selection_set(pos.node,pos.offset,pos.node,pos.offset);
            result = "end";
        }

        if (selectWord)
            Selection_selectWordAtCursor();

        if (result != "error") {
            var selRange = Selection_get();
            originalDragStart = new Position(selRange.start.node,selRange.start.offset);
            originalDragEnd = new Position(selRange.end.node,selRange.end.offset);
            Position_track(originalDragStart);
            Position_track(originalDragEnd);
        }
        return result;
    });

    // public
    Selection_dragSelectionUpdate = trace(function dragSelectionUpdate(x,y,selectWord)
    {
        // It is possible that when the user first double-tapped, there was no point at that
        // position, i.e. the pos == null case in dragSelectionBegin(). So we just try to begin
        // the selection again.
        if ((originalDragStart == null) || (originalDragEnd == null))
            return Selection_dragSelectionBegin(x,y,false); // FIXME: what about selectWord?

        var pos = Position_closestMatchForwards(positionAtPoint(x,y),Position_okForMovement);
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
                if (selectWord) {
                    posToEnd.start = Selection_posAtStartOfWord(posToEnd.start);
                    posToEnd.end = Selection_posAtEndOfWord(posToEnd.end);
                }
                Selection_set(posToEnd.start.node,posToEnd.start.offset,
                              posToEnd.end.node,posToEnd.end.offset);
                return "start";
            }
            else if (!posToEnd.isForwards()) {
                // Position comes after the end
                if (selectWord) {
                    startToPos.start = Selection_posAtStartOfWord(startToPos.start);
                    startToPos.end = Selection_posAtEndOfWord(startToPos.end);
                }
                Selection_set(startToPos.start.node,startToPos.start.offset,
                              startToPos.end.node,startToPos.end.offset);
                return "end";
            }
        }
        return "none";
    });

    var moveBoundary = trace(function moveBoundary(command)
    {
        var range = Selection_get();
        if (range == null)
            return;

        var pos = null;
        if (command == "start-left")
            range.start = pos = Position_prevMatch(range.start,Position_okForMovement);
        else if (command == "start-right")
            range.start = pos = Position_nextMatch(range.start,Position_okForMovement);
        else if (command == "end-left")
            range.end = pos = Position_prevMatch(range.end,Position_okForMovement);
        else if (command == "end-right")
            range.end = pos = Position_nextMatch(range.end,Position_okForMovement);

        if ((range.start != null) && (range.end != null)) {
            var result;
            range = range.forwards();
            Selection_set(range.start.node,range.start.offset,range.end.node,range.end.offset);
            if (range.end == pos)
                return "end";
            else if (range.end == pos)
                return "start";
        }
        return null;
    });

    // public
    Selection_moveStartLeft = trace(function moveStartLeft()
    {
        return moveBoundary("start-left");
    });

    // public
    Selection_moveStartRight = trace(function moveStartRight()
    {
        return moveBoundary("start-right");
    });

    // public
    Selection_moveEndLeft = trace(function moveEndLeft()
    {
        return moveBoundary("end-left");
    });

    // public
    Selection_moveEndRight = trace(function moveEndRight()
    {
        return moveBoundary("end-right");
    });

    // public
    Selection_setSelectionStartAtCoords = trace(function setSelectionStartAtCoords(x,y)
    {
        var position = Position_closestMatchForwards(positionAtPoint(x,y),Position_okForMovement);
        if (position != null) {
            position = Position_closestMatchBackwards(position,Position_okForMovement);
            var selRange = Selection_get();
            var newRange = new Range(position.node,position.offset,
                                     selRange.end.node,selRange.end.offset);
            if (newRange.isForwards()) {
                Selection_set(newRange.start.node,newRange.start.offset,
                              newRange.end.node,newRange.end.offset);
            }
        }
    });

    // public
    Selection_setSelectionEndAtCoords = trace(function setSelectionEndAtCoords(x,y)
    {
        var position = Position_closestMatchForwards(positionAtPoint(x,y),Position_okForMovement);
        if (position != null) {
            position = Position_closestMatchBackwards(position,Position_okForMovement);
            var selRange = Selection_get();
            var newRange = new Range(selRange.start.node,selRange.start.offset,
                                     position.node,position.offset);
            if (newRange.isForwards()) {
                Selection_set(newRange.start.node,newRange.start.offset,
                              newRange.end.node,newRange.end.offset);
            }
        }
    });

    // public
    Selection_setTableSelectionEdgeAtCoords = trace(function setTableSelectionEdgeAtCoords(edge,x,y)
    {
        if (tableSelection == null)
            return;

        var structure = tableSelection.structure;
        var pointInfo = findCellInTable(structure,x,y);
        if (pointInfo == null)
            return;

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
    });

    // public
    Selection_setEmptySelectionAt = trace(function setEmptySelectionAt(node,offset)
    {
        Selection_set(node,offset,node,offset);
    });

    // private
    var deleteTextSelection = trace(function deleteTextSelection(selRange)
    {
        var nodes = selRange.getOutermostNodes();
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];

            var removeWholeNode = false;

            if ((node == selRange.start.node) &&
                (node == selRange.end.node)) {
                var startOffset = selRange.start.offset;
                var endOffset = selRange.end.offset;
                if ((node.nodeType == Node.TEXT_NODE) &&
                    ((startOffset > 0) || (endOffset < node.nodeValue.length))) {
                    DOM_deleteCharacters(node,startOffset,endOffset);
                }
                else {
                    removeWholeNode = true;
                }
            }
            else if (node == selRange.start.node) {
                var offset = selRange.start.offset;
                if ((node.nodeType == Node.TEXT_NODE) && (offset > 0)) {
                    DOM_deleteCharacters(node,offset);
                }
                else {
                    removeWholeNode = true;
                }
            }
            else if (node == selRange.end.node) {
                var offset = selRange.end.offset;
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

        var detail = selRange.detail();

        if ((detail.startAncestor != null) && (detail.endAncestor != null) &&
            (detail.startAncestor.nextSibling == detail.endAncestor)) {
            prepareForMerge(detail);
            DOM_mergeWithNextSibling(detail.startAncestor,
                                     Formatting_MERGEABLE_BLOCK_AND_INLINE);
            if (isParagraphNode(detail.startAncestor) &&
                (DOM_upperName(detail.startAncestor) != "DIV"))
                removeParagraphDescendants(detail.startAncestor);
        }

        Cursor_updateBRAtEndOfParagraph(selRange.singleNode());
    });

    Selection_deleteRangeContents = trace(function deleteRangeContents(range)
    {
        range.trackWhileExecuting(function() {
            DOM_ignoreMutationsWhileExecuting(function() {
                removeSelectionSpans(range,true);
            });

            var region = Tables_regionFromRange(range);
            if (region != null)
                Tables_deleteRegion(region);
            else
                deleteTextSelection(range);
        });

        Selection_set(range.start.node,range.start.offset,range.start.node,range.start.offset);
    });

    Selection_deleteContents = trace(function deleteContents()
    {
        var range = Selection_get();
        if (range == null)
            return;
        Selection_deleteRangeContents(range);
    });

    // private
    var removeParagraphDescendants = trace(function removeParagraphDescendants(parent)
    {
        var next;
        for (var child = parent.firstChild; child != null; child = next) {
            next = child.nextSibling;
            removeParagraphDescendants(child);
            if (isParagraphNode(child))
                DOM_removeNodeButKeepChildren(child);
        }
    });

    // private
    var findFirstParagraph = trace(function findFirstParagraph(node)
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
    });

    // private
    var prepareForMerge = trace(function prepareForMerge(detail)
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
    });

    // public
    Selection_clearSelection = trace(function clearSelection()
    {
        Selection_clear();
    });

    // public
    Selection_preserveWhileExecuting = trace(function preserveWhileExecuting(fun)
    {
        var range = Selection_get();

        // Since the selection may have changed as a result of changes to the document, we
        // have to call clear() or set() so that undo history is saved
        if (range == null) {
            result = fun();
            Selection_clear();
        }
        else {
            result = range.trackWhileExecuting(fun);
            Selection_set(range.start.node,range.start.offset,range.end.node,range.end.offset);
        }
        return result;
    });

})();
