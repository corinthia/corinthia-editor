// This file is part of the Corinthia project (http://corinthia.io).
//
// See the COPYRIGHT.txt file distributed with this work for
// information regarding copyright ownership.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// FIXME: cursor does not display correctly if it is after a space at the end of the line

define("Selection",function(require,exports) {

    var Collections = require("Collections");
    var Cursor = require("Cursor");
    var DOM = require("DOM");
    var Editor = require("Editor");
    var Formatting = require("Formatting");
    var Input = require("Input");
    var Position = require("Position");
    var Range = require("Range");
    var Tables = require("Tables");
    var Traversal = require("Traversal");
    var Types = require("Types");
    var UndoManager = require("UndoManager");
    var Util = require("Util");

    var HANDLE_NONE = 0;
    var HANDLE_START = 1;
    var HANDLE_END = 2;

    var activeHandle = HANDLE_NONE;

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                            //
    //                                 Selection getter and setter                                //
    //                                                                                            //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    var isMarked;
    var get;
    var setInternal;
    var set;
    var clear;

    (function() {

        var selection = new Object();

        isMarked = function() {
            if (selection.value == null)
                return null;
            else
                return selection.value.isMarked;
        }

        // public
        get = function() {
            if (selection.value == null)
                return null;
            else
                return new Range.Range(selection.value.startNode,selection.value.startOffset,
                                 selection.value.endNode,selection.value.endOffset);
        }

        // public
        setInternal =
            function(newStartNode,newStartOffset,newEndNode,newEndOffset,isMarked) {
            var range = new Range.Range(newStartNode,newStartOffset,newEndNode,newEndOffset);
            if (!Range.isForwards(range))
                range = new Range.Range(newEndNode,newEndOffset,newStartNode,newStartOffset);
            range = boundaryCompliantRange(range);

            UndoManager.setProperty(selection,"value",
                                    { startNode: range.start.node,
                                      startOffset: range.start.offset,
                                      endNode: range.end.node,
                                      endOffset: range.end.offset,
                                      isMarked: isMarked });
        }

        set = function(newStartNode,newStartOffset,newEndNode,newEndOffset,
                                 keepActiveHandle,isMarked) {
            setInternal(newStartNode,newStartOffset,newEndNode,newEndOffset,isMarked);
            update();
            if (!keepActiveHandle)
                activeHandle = HANDLE_NONE;
        }

        // public
        clear = function() {
            UndoManager.setProperty(selection,"value",null);
            update();
        }

    })();

    ////////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                            //
    //                                  Other selection functions                                 //
    //                                                                                            //
    ////////////////////////////////////////////////////////////////////////////////////////////////

    var selectionDivs = new Array();
    var selectionHighlights = new Array();
    var tableSelection = null;

    // private
    updateTableSelection = function(selRange) {
        tableSelection = Tables.regionFromRange(selRange);
        if (tableSelection == null)
            return false;

        Range.trackWhileExecuting(selRange,function() {

            removeSelectionHighlights(getRangeData(null));

            var sel = tableSelection;

            var topLeftTD = Tables.Table_get(sel.structure,sel.top,sel.left);
            var bottomRightTD = Tables.Table_get(sel.structure,sel.bottom,sel.right);

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

            var div = makeSelectionDiv();
            DOM.setAttribute(div,"class",Types.Keys.SELECTION_HIGHLIGHT);
            DOM.setStyleProperties(div,{ "position": "absolute",
                                         "left": x+"px",
                                         "top": y+"px",
                                         "width": width+"px",
                                         "height": height+"px",
                                         "background-color": "rgb(201,221,238)",
                                         "z-index": -1 });

            setTableEdges(x,y,width,height);
            setEditorHandles({ type: "table", x: x, y: y, width: width, height: height });
        });

        setInternal(selRange.start.node,selRange.start.offset,
                              selRange.end.node,selRange.end.offset);

        return true;
    }

    function makeSelectionDiv() {
        var div = DOM.createElement(document,"DIV");
        DOM.appendChild(document.body,div);
        selectionDivs.push(div);
        return div;
    }

    function setTableEdges(x,y,width,height) {
        var left = makeSelectionDiv();
        var right = makeSelectionDiv();
        var top = makeSelectionDiv();
        var bottom = makeSelectionDiv();

        var thick = 2;
        width++;
        height++;
        setBoxCoords(left,x-thick,y-thick,thick,height+2*thick);
        setBoxCoords(right,x+width,y-thick,thick,height+2*thick);
        setBoxCoords(top,x-thick,y-thick,width+2*thick,thick);
        setBoxCoords(bottom,x-thick,y+height,width+2*thick,thick);

        function setBoxCoords(box,x,y,width,height) {
            DOM.setStyleProperties(box,{ "position": "absolute",
                                         "left": x+"px",
                                         "top": y+"px",
                                         "width": width+"px",
                                         "height": height+"px",
                                         "background-color": "blue",
                                         "z-index": 1 });
        }
    }

    var editorHandles = { type: "none" };
    function setEditorHandles(info) {
        var oldEditorHandles = editorHandles;
        editorHandles = info;
        UndoManager.addAction(function() {
            setEditorHandles(oldEditorHandles);
        });
        if (info.type == "cursor") {
            Editor.setCursor(info.left,info.top,info.width,info.height);
        }
        else if (info.type == "selection") {
            if (!isMarked()) {
                Editor.setSelectionHandles(info.x1,info.y1,
                                           info.height1,info.x2,info.y2,info.height2);
            }
            Editor.setSelectionBounds(info.boundsLeft,info.boundsTop,
                                      info.boundsRight,info.boundsBottom);
        }
        else if (info.type == "none") {
            Editor.clearSelectionHandlesAndCursor();
        }
        else if (info.type == "table") {
            Editor.setTableSelection(info.x,info.y,info.width,info.height);
        }
        else {
            throw new Error("setEditorHandles: unknown type "+type);
        }
    }

    function getPrevHighlightText(node) {
        if ((node.previousSibling != null) &&
            Types.isSelectionHighlight(node.previousSibling) &&
            (node.previousSibling.lastChild != null) &&
            (node.previousSibling.lastChild.nodeType == Node.TEXT_NODE))
            return node.previousSibling.lastChild;
        else
            return null;
    }

    function getNextHighlightText(node) {
        if ((node.nextSibling != null) &&
            Types.isSelectionHighlight(node.nextSibling) &&
            (node.nextSibling.firstChild != null) &&
            (node.nextSibling.firstChild.nodeType == Node.TEXT_NODE))
            return node.nextSibling.firstChild;
        else
            return null;
    }

    function getTextNodeBefore(node) {
        var prev = node.previousSibling;
        if ((prev != null) && (prev.nodeType == Node.TEXT_NODE)) {
            return prev;
        }
        else {
            var text = DOM.createTextNode(document,"");
            DOM.insertBefore(node.parentNode,text,node);
            return text;
        }
    }

    function getTextNodeAfter(node) {
        var next = node.nextSibling;
        if ((next != null) && (next.nodeType == Node.TEXT_NODE)) {
            return next;
        }
        else {
            var text = DOM.createTextNode(document,"");
            DOM.insertBefore(node.parentNode,text,node.nextSibling);
            return text;
        }
    }

    function setSelectionHighlights(highlights) {
        UndoManager.addAction(setSelectionHighlights,selectionHighlights);
        selectionHighlights = highlights;
    }

    function createSelectionHighlights(data) {
        var newHighlights = Util.arrayCopy(selectionHighlights);

        var outermost = data.outermost;
        for (var i = 0; i < outermost.length; i++) {
            recurse(outermost[i]);
        }

        setSelectionHighlights(newHighlights);

        function recurse(node) {
            if (Types.isSpecialBlockNode(node)) {
                if (!Types.isSelectionHighlight(node.parentNode)) {
                    var wrapped = DOM.wrapNode(node,"DIV");
                    DOM.setAttribute(wrapped,"class",Types.Keys.SELECTION_CLASS);
                    newHighlights.push(wrapped);
                }
            }
            else if (Types.isNoteNode(node)) {
                if (!Types.isSelectionHighlight(node.parentNode)) {
                    var wrapped = DOM.wrapNode(node,"SPAN");
                    DOM.setAttribute(wrapped,"class",Types.Keys.SELECTION_CLASS);
                    newHighlights.push(wrapped);
                }
            }
            else if (node.nodeType == Node.TEXT_NODE) {
                createTextHighlight(node,data,newHighlights);
            }
            else {
                var next;
                for (var child = node.firstChild; child != null; child = next) {
                    next = child.nextSibling;
                    recurse(child);
                }
            }
        }
    }

    function createTextHighlight(node,data,newHighlights) {
        var selRange = data.range;
        if (Types.isSelectionHighlight(node.parentNode)) {

            if ((node == selRange.end.node) && (node.nodeValue.length > selRange.end.offset)) {
                var destTextNode = getTextNodeAfter(node.parentNode);
                DOM.moveCharacters(node,
                                   selRange.end.offset,
                                   node.nodeValue.length,
                                   destTextNode,0,
                                   true,false);
            }
            if ((node == selRange.start.node) && (selRange.start.offset > 0)) {
                var destTextNode = getTextNodeBefore(node.parentNode);
                DOM.moveCharacters(node,
                                   0,
                                   selRange.start.offset,
                                   destTextNode,destTextNode.nodeValue.length,
                                   false,true);
            }

            return;
        }

        var anext;
        for (var a = node; a != null; a = anext) {
            anext = a.parentNode;
            if (Types.isSelectionHighlight(a))
                DOM.removeNodeButKeepChildren(a);
        }

        if (node == selRange.end.node) {
            if (Util.isWhitespaceString(node.nodeValue.substring(0,selRange.end.offset)))
                return;
            Formatting.splitTextAfter(selRange.end,
                                      function() { return true; });
        }


        if (node == selRange.start.node) {
            if (Util.isWhitespaceString(node.nodeValue.substring(selRange.start.offset)))
                return;
            Formatting.splitTextBefore(selRange.start,
                                       function() { return true; });
        }

        var prevText = getPrevHighlightText(node);
        var nextText = getNextHighlightText(node);

        if ((prevText != null) && containsSelection(data.nodeSet,prevText)) {
            DOM.moveCharacters(node,0,node.nodeValue.length,
                               prevText,prevText.nodeValue.length,true,false);
            DOM.deleteNode(node);
        }
        else if ((nextText != null) && containsSelection(data.nodeSet,nextText)) {
            DOM.moveCharacters(node,0,node.nodeValue.length,
                               nextText,0,false,true);
            DOM.deleteNode(node);
        }
        else if (!Traversal.isWhitespaceTextNode(node)) {
            // Call moveCharacters() with an empty range, to force any tracked positions
            // that are at the end of prevText or the start of nextText to move into this
            // node
            if (prevText != null) {
                DOM.moveCharacters(prevText,
                                   prevText.nodeValue.length,prevText.nodeValue.length,
                                   node,0);
            }
            if (nextText != null) {
                DOM.moveCharacters(nextText,0,0,node,node.nodeValue.length);
            }

            var wrapped = DOM.wrapNode(node,"SPAN");
            DOM.setAttribute(wrapped,"class",Types.Keys.SELECTION_CLASS);
            newHighlights.push(wrapped);
        }
    }

    function getRangeData(selRange) {
        var nodeSet = new Collections.NodeSet();
        var nodes;
        var outermost;
        if (selRange != null) {
            outermost = Range.getOutermostNodes(selRange);
            nodes = Range.getAllNodes(selRange);
            for (var i = 0; i < nodes.length; i++)
                nodeSet.add(nodes[i]);
        }
        else {
            nodes = new Array();
            outermost = new Array();
        }
        return { range: selRange, nodeSet: nodeSet, nodes: nodes, outermost: outermost };
    }

    function removeSelectionHighlights(data,force) {
        var selectedSet = data.nodeSet;

        var remainingHighlights = new Array();
        var checkMerge = new Array();
        for (var i = 0; i < selectionHighlights.length; i++) {
            var span = selectionHighlights[i];
            if ((span.parentNode != null) && (force || !containsSelection(selectedSet,span))) {
                if (span.firstChild != null)
                    checkMerge.push(span.firstChild);
                if (span.lastChild != null)
                    checkMerge.push(span.lastChild);

                DOM.removeNodeButKeepChildren(span);
            }
            else if (span.parentNode != null) {
                remainingHighlights.push(span);
            }
        }
        setSelectionHighlights(remainingHighlights);

        for (var i = 0; i < checkMerge.length; i++) {
            // if not already merged
            if ((checkMerge[i] != null) && (checkMerge[i].parentNode != null)) {
                Formatting.mergeWithNeighbours(checkMerge[i],{});
            }
        }
    }

    function containsSelection(selectedSet,node) {
        if (selectedSet.contains(node))
            return true;
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            if (containsSelection(selectedSet,child))
                return true;
        }
        return false;
    }

    function update() {
        var selRange = get();
        var selMarked = isMarked();

        Range.trackWhileExecuting(selRange,function() {
            // Remove table selection DIVs
            for (var i = 0; i < selectionDivs.length; i++)
                DOM.deleteNode(selectionDivs[i]);
            selectionDivs = new Array();
        });

        if (selRange == null) {
            DOM.ignoreMutationsWhileExecuting(function() {
                removeSelectionHighlights(getRangeData(null));
            });
            return;
        }

        Range.assertValid(selRange,"Selection");

        if (Range.isEmpty(selRange)) {
            // We just have a cursor

            Range.trackWhileExecuting(selRange,function() {
                DOM.ignoreMutationsWhileExecuting(function() {
                    removeSelectionHighlights(getRangeData(selRange));
                });
            });
            // Selection may have changed as a result of removeSelectionHighlights()
            setInternal(selRange.start.node,selRange.start.offset,
                                  selRange.end.node,selRange.end.offset,
                                  selMarked);
            selRange = get(); // since setInternal can theoretically change it

            // If we can't find the cursor rect for some reason, just don't update the position.
            // This is better than using an incorrect position or throwing an exception.
            var rect = Position.displayRectAtPos(selRange.end);
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
            return;
        }

        if (updateTableSelection(selRange))
            return;

        var rects = Range.getClientRects(selRange);

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

            Range.trackWhileExecuting(selRange,function() {
                DOM.ignoreMutationsWhileExecuting(function() {
                    var data = getRangeData(selRange);
                    createSelectionHighlights(data);
                    removeSelectionHighlights(data);
                });
            });

            // Selection may have changed as a result of create/removeSelectionHighlights()
            setInternal(selRange.start.node,selRange.start.offset,
                                  selRange.end.node,selRange.end.offset,
                                  selMarked);

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

        function getAbsoluteOffset(node) {
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
    function selectAll() {
        set(document.body,0,document.body,document.body.childNodes.length);
    }

    // public
    function selectParagraph() {
        var selRange = get();
        if (selRange == null)
            return;
        var startNode = Position.closestActualNode(selRange.start);
        while (!Types.isParagraphNode(startNode) && !Types.isContainerNode(startNode))
            startNode = startNode.parentNode;

        var endNode = Position.closestActualNode(selRange.end);
        while (!Types.isParagraphNode(endNode) && !Types.isContainerNode(endNode))
            endNode = endNode.parentNode;

        var startPos = new Position.Position(startNode,0);
        var endPos = new Position.Position(endNode,DOM.maxChildOffset(endNode));
        startPos = Position.closestMatchForwards(startPos,Position.okForMovement);
        endPos = Position.closestMatchBackwards(endPos,Position.okForMovement);

        set(startPos.node,startPos.offset,endPos.node,endPos.offset);
    }

    // private
    function getPunctuationCharsForRegex() {
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

    function posAtStartOfWord(pos) {
        var node = pos.node;
        var offset = pos.offset;

        if (node.nodeType == Node.TEXT_NODE) {
            var before = node.nodeValue.substring(0,offset);
            var matches = before.match(reWordEnd);
            if (matches) {
                var wordStart = offset - matches[0].length;
                return new Position.Position(node,wordStart);
            }
        }

        return pos;
    }

    function posAtEndOfWord(pos) {
        var node = pos.node;
        var offset = pos.offset;

        if (node.nodeType == Node.TEXT_NODE) {
            var after = node.nodeValue.substring(offset);
            var matches = after.match(reWordStart);
            if (matches) {
                var wordEnd = offset + matches[0].length;
                return new Position.Position(node,wordEnd);
            }
        }

        return pos;
    }

    function rangeOfWordAtPos(pos) {
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

            return new Range.Range(node,startOffset,node,endOffset);
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            var nodeBefore = node.childNodes[offset-1];
            var nodeAfter = node.childNodes[offset];

            if ((nodeBefore != null) && !Traversal.isWhitespaceTextNode(nodeBefore))
                return new Range.Range(node,offset-1,node,offset);
            else if ((nodeAfter != null) && !Traversal.isWhitespaceTextNode(nodeAfter))
                return new Range.Range(node,offset,node,offset+1);
        }

        return null;
    }

    // public
    function selectWordAtCursor() {
        var selRange = get();
        if (selRange == null)
            return;

        var pos = Position.closestMatchBackwards(selRange.end,Position.okForMovement);
        var range = rangeOfWordAtPos(pos);
        if (range != null) {
            set(range.start.node,range.start.offset,range.end.node,range.end.offset);
        }
    }

    // public
    function dragSelectionBegin(x,y,selectWord) {
        var pos = Position.closestMatchForwards(Position.atPoint(x,y),Position.okForMovement);

        if (pos == null) {
            clear();
            return "error";
        }

        set(pos.node,pos.offset,pos.node,pos.offset);

        if (selectWord)
            selectWordAtCursor();

        return "end";
    }

    var selectionHandleEnd = true;

    function toStartOfWord(pos) {
        if (Input.isAtWordBoundary(pos,"backward"))
            return pos;
        var boundary = Input.toWordBoundary(pos,"backward");
        return (boundary != null) ? boundary : pos;
    }

    function toEndOfWord(pos) {
        if (Input.isAtWordBoundary(pos,"forward"))
            return pos;
        var boundary = Input.toWordBoundary(pos,"forward");
        return (boundary != null) ? boundary : pos;
    }

    // public
    function dragSelectionUpdate(x,y,selectWord) {
        y = Cursor.scrollDocumentForY(y);

        var pos = Position.closestMatchForwards(Position.atPoint(x,y),Position.okForMovement);
        var selRange = get();
        if ((pos == null) || (selRange == null))
            return "none";

        var start = selRange.start;
        var end = selRange.end;

        if (selectionHandleEnd) {
            if (Position.compare(pos,start) < 0) {
                if (selectWord)
                    pos = toStartOfWord(pos);
                selectionHandleEnd = false;
            }
            else {
                if (selectWord)
                    pos = toEndOfWord(pos);
            }
            set(start.node,start.offset,pos.node,pos.offset);
        }
        else {
            if (Position.compare(pos,end) > 0) {
                if (selectWord)
                    pos = toEndOfWord(pos);
                selectionHandleEnd = true;
            }
            else {
                if (selectWord)
                    pos = toStartOfWord(pos);
            }
            set(pos.node,pos.offset,end.node,end.offset);
        }

        return selectionHandleEnd ? "end" : "start";
    }

    function moveBoundary(command) {
        var range = get();
        if (range == null)
            return;

        var pos = null;
        if (command == "start-left")
            range.start = pos = Position.prevMatch(range.start,Position.okForMovement);
        else if (command == "start-right")
            range.start = pos = Position.nextMatch(range.start,Position.okForMovement);
        else if (command == "end-left")
            range.end = pos = Position.prevMatch(range.end,Position.okForMovement);
        else if (command == "end-right")
            range.end = pos = Position.nextMatch(range.end,Position.okForMovement);

        if ((range.start != null) && (range.end != null)) {
            var result;
            range = Range.forwards(range);
            set(range.start.node,range.start.offset,range.end.node,range.end.offset);
            if (range.end == pos)
                return "end";
            else if (range.end == pos)
                return "start";
        }
        return null;
    }

    // public
    function moveStartLeft() {
        return moveBoundary("start-left");
    }

    // public
    function moveStartRight() {
        return moveBoundary("start-right");
    }

    // public
    function moveEndLeft() {
        return moveBoundary("end-left");
    }

    // public
    function moveEndRight() {
        return moveBoundary("end-right");
    }

    // public
    function setSelectionStartAtCoords(x,y) {
        var position = Position.closestMatchForwards(Position.atPoint(x,y),Position.okForMovement);
        if (position != null) {
            position = Position.closestMatchBackwards(position,Position.okForMovement);
            var selRange = get();
            var newRange = new Range.Range(position.node,position.offset,
                                     selRange.end.node,selRange.end.offset);
            if (Range.isForwards(newRange)) {
                set(newRange.start.node,newRange.start.offset,
                              newRange.end.node,newRange.end.offset);
            }
        }
    }

    // public
    function setSelectionEndAtCoords(x,y) {
        var position = Position.closestMatchForwards(Position.atPoint(x,y),Position.okForMovement);
        if (position != null) {
            position = Position.closestMatchBackwards(position,Position.okForMovement);
            var selRange = get();
            var newRange = new Range.Range(selRange.start.node,selRange.start.offset,
                                     position.node,position.offset);
            if (Range.isForwards(newRange)) {
                set(newRange.start.node,newRange.start.offset,
                              newRange.end.node,newRange.end.offset);
            }
        }
    }

    // public
    function setTableSelectionEdgeAtCoords(edge,x,y) {
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
        var topLeftCell = Tables.Table_get(structure,tableSelection.top,tableSelection.left);
        var bottomRightCell = Tables.Table_get(structure,tableSelection.bottom,tableSelection.right);

        var topLeftNode = topLeftCell.element.parentNode;
        var topLeftOffset = DOM.nodeOffset(topLeftCell.element);
        var bottomRightNode = bottomRightCell.element.parentNode;
        var bottomRightOffset = DOM.nodeOffset(bottomRightCell.element)+1;

        set(topLeftNode,topLeftOffset,bottomRightNode,bottomRightOffset);

        // FIXME: this could possibly be optimised
        function findCellInTable(structure,x,y) {
            for (var r = 0; r < structure.numRows; r++) {
                for (var c = 0; c < structure.numCols; c++) {
                    var cell = Tables.Table_get(structure,r,c);
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
    function setEmptySelectionAt(node,offset) {
        set(node,offset,node,offset);
    }

    // private
    function deleteTextSelection(selRange,keepEmpty) {
        var nodes = Range.getOutermostNodes(selRange);
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];

            var removeWholeNode = false;

            if ((node == selRange.start.node) &&
                (node == selRange.end.node)) {
                var startOffset = selRange.start.offset;
                var endOffset = selRange.end.offset;
                if ((node.nodeType == Node.TEXT_NODE) &&
                    ((startOffset > 0) || (endOffset < node.nodeValue.length))) {
                    DOM.deleteCharacters(node,startOffset,endOffset);
                }
                else {
                    removeWholeNode = true;
                }
            }
            else if (node == selRange.start.node) {
                var offset = selRange.start.offset;
                if ((node.nodeType == Node.TEXT_NODE) && (offset > 0)) {
                    DOM.deleteCharacters(node,offset);
                }
                else {
                    removeWholeNode = true;
                }
            }
            else if (node == selRange.end.node) {
                var offset = selRange.end.offset;
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
                switch (node._type) {
                case HTML_TD:
                case HTML_TH:
                    DOM.deleteAllChildren(node);
                    break;
                default:
                    DOM.deleteNode(node);
                    break;
                }
            }
        }

        var detail = Range.detail(selRange);

        var sameTextNode = (selRange.start.node == selRange.end.node) &&
                           (selRange.start.node.nodeType == Node.TEXT_NODE);

        if ((detail.startAncestor != null) && (detail.endAncestor != null) &&
            (detail.startAncestor.nextSibling == detail.endAncestor) &&
            !sameTextNode) {
            prepareForMerge(detail);
            DOM.mergeWithNextSibling(detail.startAncestor,
                                          Formatting.MERGEABLE_BLOCK_AND_INLINE);
            if (Types.isParagraphNode(detail.startAncestor) &&
                (detail.startAncestor._type != HTML_DIV))
                removeParagraphDescendants(detail.startAncestor);
        }

        if (!keepEmpty) {
            var startNode = selRange.start.node;
            var endNode = selRange.end.node;
            if (startNode.parentNode != null)
                delEmpty(selRange,startNode);
            if (endNode.parentNode != null)
                delEmpty(selRange,endNode);
        }

        Cursor.updateBRAtEndOfParagraph(Range.singleNode(selRange));
    }

    function delEmpty(selRange,node) {
        while ((node != document.body) &&
               (node.nodeType == Node.ELEMENT_NODE) &&
               (node.firstChild == null)) {

            if (Types.isTableCell(node) || Types.isTableCell(node.parentNode))
                return;

            if (!fixPositionOutside(selRange.start,node))
                break;
            if (!fixPositionOutside(selRange.end,node))
                break;

            var parent = node.parentNode;
            Range.trackWhileExecuting(selRange,function() {
                DOM.deleteNode(node);
            });
            node = parent;
        }
    }

    function fixPositionOutside(pos,node) {
        if (pos.node == node) {
            var before = new Position.Position(node.parentNode,DOM.nodeOffset(node));
            var after = new Position.Position(node.parentNode,DOM.nodeOffset(node)+1);
            before = Position.prevMatch(before,Position.okForMovement);
            after = Position.nextMatch(after,Position.okForMovement);

            if (before != null) {
                pos.node = before.node;
                pos.offset = before.offset;
            }
            else if (after != null) {
                pos.node = after.node;
                pos.offset = after.offset;
            }
            else {
                return false;
            }
        }
        return true;
    }

    function deleteRangeContents(range,keepEmpty) {
        Range.trackWhileExecuting(range,function() {
            DOM.ignoreMutationsWhileExecuting(function() {
                removeSelectionHighlights(getRangeData(range),true);
            });

            var region = Tables.regionFromRange(range);
            if (region != null)
                Tables.deleteRegion(region);
            else
                deleteTextSelection(range,keepEmpty);
        });

        set(range.start.node,range.start.offset,range.start.node,range.start.offset);
    }

    function deleteContents(keepEmpty) {
        var range = get();
        if (range == null)
            return;
        deleteRangeContents(range,keepEmpty);
    }

    // private
    function removeParagraphDescendants(parent) {
        var next;
        for (var child = parent.firstChild; child != null; child = next) {
            next = child.nextSibling;
            removeParagraphDescendants(child);
            if (Types.isParagraphNode(child))
                DOM.removeNodeButKeepChildren(child);
        }
    }

    // private
    function findFirstParagraph(node) {
        if (Types.isParagraphNode(node))
            return node;
        if (node._type == HTML_LI) {
            var nonWhitespaceInline = false;

            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                if (Types.isInlineNode(child) && !Traversal.isWhitespaceTextNode(child))
                    nonWhitespaceInline = true;

                if (Types.isParagraphNode(child)) {
                    if (nonWhitespaceInline)
                        return putPrecedingSiblingsInParagraph(node,child);
                    return child;
                }
                else if (Types.isListNode(child)) {
                    if (nonWhitespaceInline)
                        return putPrecedingSiblingsInParagraph(node,child);
                    return findFirstParagraph(child);
                }
            }
            if (nonWhitespaceInline)
                return putPrecedingSiblingsInParagraph(node,null);
        }
        return null;

        function putPrecedingSiblingsInParagraph(parent,node) {
            var p = DOM.createElement(document,"P");
            while (parent.firstChild != node)
                DOM.appendChild(p,parent.firstChild);
            return p;
        }
    }

    // private
    function prepareForMerge(detail) {
        if (Types.isParagraphNode(detail.startAncestor) && Types.isInlineNode(detail.endAncestor)) {
            var name = detail.startAncestor.nodeName; // check-ok
            var newParagraph = DOM.createElement(document,name);
            DOM.insertBefore(detail.endAncestor.parentNode,newParagraph,detail.endAncestor);
            DOM.appendChild(newParagraph,detail.endAncestor);
            detail.endAncestor = newParagraph;
        }
        else if (Types.isInlineNode(detail.startAncestor) && Types.isParagraphNode(detail.endAncestor)) {
            var name = detail.endAncestor.nodeName; // check-ok
            var newParagraph = DOM.createElement(document,name);
            DOM.insertBefore(detail.startAncestor.parentNode,newParagraph,
                             detail.startAncestor.nextSibling);
            DOM.appendChild(newParagraph,detail.startAncestor);
            detail.startAncestor = newParagraph;
        }
        else if (Types.isParagraphNode(detail.startAncestor) &&
                 Types.isListNode(detail.endAncestor) &&
                 (detail.endAncestor.firstChild._type == HTML_LI)) {
            var list = detail.endAncestor;
            var li = detail.endAncestor.firstChild;

            var paragraph = findFirstParagraph(li);
            if (paragraph != null) {
                DOM.insertBefore(list.parentNode,paragraph,list);
                var name = detail.startAncestor.nodeName; // check-ok
                DOM.replaceElement(paragraph,name);
            }
            if (!Util.nodeHasContent(li))
                DOM.deleteNode(li);
            if (Traversal.firstChildElement(list) == null)
                DOM.deleteNode(list);
        }
        else if (Types.isParagraphNode(detail.endAncestor) &&
                 Types.isListNode(detail.startAncestor) &&
                 (detail.startAncestor.lastChild._type == HTML_LI)) {
            var list = detail.startAncestor;
            var li = detail.startAncestor.lastChild;
            var p = detail.endAncestor;
            var oldLastChild = li.lastChild;
            while (p.firstChild != null)
                DOM.insertBefore(li,p.firstChild,null);
            DOM.deleteNode(p);
            if (oldLastChild != null) {
                DOM.mergeWithNextSibling(oldLastChild,
                                              Formatting.MERGEABLE_BLOCK_AND_INLINE);
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
    function clearSelection() {
        clear();
    }

    // public
    function preserveWhileExecuting(fun) {
        var range = get();

        // Since the selection may have changed as a result of changes to the document, we
        // have to call clear() or set() so that undo history is saved
        if (range == null) {
            result = fun();
            clear();
        }
        else {
            result = Range.trackWhileExecuting(range,fun);
            set(range.start.node,range.start.offset,range.end.node,range.end.offset);
        }
        return result;
    }

    function preferElementPositions() {
        var range = get();
        if (range == null)
            return;
        range.start = Position.preferElementPosition(range.start);
        range.end = Position.preferElementPosition(range.end);
        set(range.start.node,range.start.offset,
                      range.end.node,range.end.offset);
    }

    function getBoundaryContainer(node,topAncestor) {
        var container = document.body;
        for (; node != topAncestor.parentNode; node = node.parentNode) {
            switch (node._type) {
            case HTML_FIGURE:
            case HTML_TABLE:
                container = node;
                break;
            }
        }
        return container;
    }

    function boundaryCompliantRange(range) {
        if (range == null)
            return null;

        var detail = Range.detail(range);
        var start = range.start;
        var end = range.end;
        var startNode = Position.closestActualNode(start);
        var endNode = Position.closestActualNode(end);
        var startContainer = getBoundaryContainer(startNode.parentNode,detail.commonAncestor);
        var endContainer = getBoundaryContainer(endNode.parentNode,detail.commonAncestor);

        if (startContainer != endContainer) {

            var doStart = false;
            var doEnd = false;

            if (nodeHasAncestor(startContainer,endContainer)) {
                doStart = true;
            }
            else if (nodeHasAncestor(endContainer,startContainer)) {
                doEnd = true;
            }
            else {
                doStart = true;
                doEnd = true;
            }

            if (doStart && (startContainer != document.body))
                start = new Position.Position(startContainer.parentNode,DOM.nodeOffset(startContainer));
            if (doEnd && (endContainer != document.body))
                end = new Position.Position(endContainer.parentNode,DOM.nodeOffset(endContainer)+1);
        }
        return new Range.Range(start.node,start.offset,end.node,end.offset);

        function nodeHasAncestor(node,ancestor) {
            for (; node != null; node = node.parentNode) {
                if (node == ancestor)
                    return true;
            }
            return false;
        }
    }

    function print() {
        debug("");
        debug("");
        debug("");
        debug("================================================================================");

        var sel = get();
        if (sel == null) {
            debug("No selection");
            return;
        }

        printSelectionElement(document.body,"");

        function printSelectionElement(node,indent) {
            var className = DOM.getAttribute(node,"class");
            if (className != null)
                debug(indent+node.nodeName+" ("+className+")");
            else
                debug(indent+node.nodeName);

            var child = node.firstChild;
            var offset = 0;
            while (true) {

                var isStart = ((sel.start.node == node) && (sel.start.offset == offset));
                var isEnd = ((sel.end.node == node) && (sel.end.offset == offset));
                if (isStart && isEnd)
                    debug(indent+"    []");
                else if (isStart)
                    debug(indent+"    [");
                else if (isEnd)
                    debug(indent+"    ]");

                if (child == null)
                    break;

                if (child.nodeType == Node.ELEMENT_NODE)
                    printSelectionElement(child,indent+"    ");
                else
                    printSelectionText(child,indent+"    ");

                child = child.nextSibling;
                offset++;
            }
        }

        function printSelectionText(node,indent) {
            var value = node.nodeValue;

            if (sel.end.node == node) {
                var afterSelection = value.substring(sel.end.offset);
                value = value.substring(0,sel.end.offset) + "]" + afterSelection;
            }

            if (sel.start.node == node) {
                var beforeSelection = value.substring(0,sel.start.offset);
                value = beforeSelection + "[" + value.substring(sel.start.offset);
            }

            debug(indent+JSON.stringify(value));
        }
    }

    exports.isMarked = isMarked;
    exports.get = get;
    exports.set = set;
    exports.clear = clear;

    exports.update = update;
    exports.selectAll = selectAll;
    exports.selectParagraph = selectParagraph;
    exports.posAtStartOfWord = posAtStartOfWord;
    exports.posAtEndOfWord = posAtEndOfWord;
    exports.selectWordAtCursor = selectWordAtCursor;
    exports.dragSelectionBegin = dragSelectionBegin;
    exports.dragSelectionUpdate = dragSelectionUpdate;
    exports.moveStartLeft = moveStartLeft;
    exports.moveStartRight = moveStartRight;
    exports.moveEndLeft = moveEndLeft;
    exports.moveEndRight = moveEndRight;
    exports.setSelectionStartAtCoords = setSelectionStartAtCoords;
    exports.setSelectionEndAtCoords = setSelectionEndAtCoords;
    exports.setTableSelectionEdgeAtCoords = setTableSelectionEdgeAtCoords;
    exports.setEmptySelectionAt = setEmptySelectionAt;
    exports.deleteRangeContents = deleteRangeContents;
    exports.deleteContents = deleteContents;
    exports.clearSelection = clearSelection;
    exports.preserveWhileExecuting = preserveWhileExecuting;
    exports.preferElementPositions = preferElementPositions;
    exports.print = print;

});
