// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.


(function() {

    // public
    function isValidCursorPosition(pos)
    {
        var result = false;

        var node = pos.node;
        var offset = pos.offset;

        if (isOpaqueNode(node))
            return false;

        if (node.nodeType == Node.TEXT_NODE) {
            var value = node.nodeValue;
            var prev = node.previousSibling;
            var next = node.nextSibling;

            // Immediately after a non-whitespace character -> YES
            if ((offset > 0) && !isWhitespaceCharacter(value.charAt(offset-1)))
                result = true;

            // Immediately before a non-whitespace character -> YES
            if ((offset < value.length) && !isWhitespaceCharacter(value.charAt(offset)))
                result = true;

            // Right at the end of a whitespace node which is the first child in a paragraph,
            // and has no next sibling, or is followed by a BR -> YES
            if ((offset == value.length) &&
                !isInlineNode(node.parentNode) &&
                isWhitespaceTextNode(node) &&
                (prev == null) &&
                ((next == null) || (next.nodeName == "BR")))
                result = true;
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            var prev = (offset == 0) ? null : node.childNodes[offset-1];
            var next = (offset >= node.childNodes.length) ? null : node.childNodes[offset];

            // Directly after an IMG, TABLE, UL, or OL -> YES
            if ((prev != null) &&
                ((prev.nodeName == "IMG") ||
                 (prev.nodeName == "TABLE") ||
                 (prev.nodeName == "UL") ||
                 (prev.nodeName == "OL")))
                result = true;

            // Directly before an IMG, TABLE, UL, or OL -> YES
            if ((next != null) &&
                ((next.nodeName == "IMG") ||
                 (next.nodeName == "TABLE") ||
                 (next.nodeName == "UL") ||
                 (next.nodeName == "OL")))
                result = true;

            // In an empty paragraph or one that only contains a BR
            if ((prev == null) && (next != null) && (next.nodeName == "BR"))
                result = true;

            if ((prev == null) && (next == null) &&
                (isParagraphNode(node) || INLINE_ELEMENTS_THAT_CAN_HAVE_CHILDREN[node.nodeName]))
                result = true;

            // Special case for an IMG that directly follows some text that ends in a
            // non-whitespace character. The cursor will be allowed at the end of the text
            // node, so we don't want to allow it before the image (which corresponds to the
            // same location on screen)
            if ((next != null) && (prev != null) &&
                (next.nodeName == "IMG") &&
                (prev.nodeType == Node.TEXT_NODE) &&
                (prev.nodeValue.length > 0) &&
                !isWhitespaceCharacter(prev.nodeValue.charAt(prev.nodeValue.length-1))) {
                result = false;
            }

            // As above, but for an IMG that directly precedes some text
            if ((prev != null) && (next != null) &&
                (prev.nodeName == "IMG") &&
                (next.nodeType == Node.TEXT_NODE) &&
                (next.nodeValue.length > 0) &&
                !isWhitespaceCharacter(next.nodeValue.charAt(0))) {
                result = false;
            }
        }

        return result;
    }

    // public
    function positionCursor(x,y)
    {
        var zoom = Viewport.getZoom();
        var position = positionAtPoint(x/zoom,y/zoom);
        if ((position != null) && isOpaqueNode(position.node))
            position = nextCursorPosition(position);
        if (position == null)
            return;

        var selectionRange = Selection.getSelectionRange();
        if ((selectionRange != null) && selectionRange.isEmpty() &&
            (position.node == selectionRange.start.node) &&
            (position.offset == selectionRange.start.offset)) {
            var domRange = document.createRange();
            domRange.setStart(position.node,position.offset);
            domRange.setEnd(position.node,position.offset);
            var rects = domRange.getClientRects();
            if (rects.length > 0) {
                var zoom = Viewport.getZoom();
                var left = (rects[0].left + window.scrollX) * zoom;
                var top = (rects[0].top + window.scrollY) * zoom;
                var height = rects[0].height * zoom;
                editor.showCursorMenu(left,top,height);
            }
        }
        Selection.setEmptySelectionAt(position.node,position.offset);
    }

    function prevCursorPosition(pos)
    {
        do {
            pos = pos.prev();
        } while ((pos != null) && !isValidCursorPosition(pos));
        return pos;
    }

    function nextCursorPosition(pos)
    {
        do {
            pos = pos.next();
        } while ((pos != null) && !isValidCursorPosition(pos));
        return pos;
    }

    // public
    function moveLeft()
    {
        var selectionRange = Selection.getSelectionRange();
        if (selectionRange == null)
            return;

        var pos = prevCursorPosition(selectionRange.start);

        if (pos != null)
            Selection.setEmptySelectionAt(pos.node,pos.offset);
    }

    // public
    function moveRight()
    {
        var selectionRange = Selection.getSelectionRange();
        if (selectionRange == null)
            return;

        var pos = nextCursorPosition(selectionRange.start);

        if (pos != null)
            Selection.setEmptySelectionAt(pos.node,pos.offset);
    }

    function nodeHasContent(node)
    {
        if (node.nodeType == Node.TEXT_NODE) {
            return !isWhitespaceString(node.nodeValue);
        }
        else if ((node.nodeName == "IMG") || (node.nodeName == "TABLE")) {
            return true;
        }
        else {
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                if (nodeHasContent(child))
                    return true;
            }
            return false;
        }
    }

    // An empty paragraph does not get shown and cannot be edited. We can fix this by adding
    // a BR element as a child
    function updateBRAtEndOfParagraph(node)
    {
        var paragraph = node;
        while ((paragraph != null) && !isParagraphNode(paragraph))
            paragraph = paragraph.parentNode;
        if (paragraph != null) {

            var br = null;
            for (var last = paragraph; last != null; last = last.lastChild) {

                var child = last;
                while ((last != null) && isWhitespaceTextNode(last))
                    last = last.previousSibling;

                if ((last != null) && (last.nodeName == "BR"))
                    br = last;
            }

            if (nodeHasContent(paragraph)) {
                // Paragraph has content: don't want BR at end
                if (br != null) {
                    DOM.deleteNode(br);
                }
            }
            else {
                // Paragraph consists only of whitespace: must have BR at end
                if (br == null) {
                    br = DOM.createElement(document,"BR");
                    DOM.appendChild(paragraph,br);
                }
            }
        }
    }

    function closestPositionForwards(pos)
    {
        if (isValidCursorPosition(pos))
            return pos;

        var next = nextCursorPosition(pos);
        if (next != null)
            return next;

        var prev = prevCursorPosition(pos);
        if (prev != null)
            return prev;

        return new Position(document.body,document.body.childNodes.length);
    }

    // public
    function insertCharacter(character)
    {
        var selectionRange = Selection.getSelectionRange();
        if (selectionRange == null)
            return;

        if (!selectionRange.isEmpty())
            Selection.deleteSelectionContents();

        var pos = closestPositionForwards(selectionRange.start);
        var node = pos.node;
        var offset = pos.offset;

        if (node.nodeType == Node.ELEMENT_NODE) {
            var emptyTextNode = DOM.createTextNode(document,"");
            if (offset >= node.childNodes.length)
                DOM.appendChild(node,emptyTextNode);
            else
                DOM.insertBefore(node,emptyTextNode,node.childNodes[offset]);
            node = emptyTextNode;
            offset = 0;
        }

        node.insertData(offset,character);
        Selection.setEmptySelectionAt(node,offset+1,node,offset+1);
        Selection.getSelectionRange().trackWhileExecuting(function() {
            updateBRAtEndOfParagraph(node);
        });
    }

    // public
    function deleteCharacter()
    {
        var selectionRange = Selection.getSelectionRange();
        if (selectionRange == null)
            return;

        if (!selectionRange.isEmpty()) {
            Selection.deleteSelectionContents();
            return;
        }
        else {
            var currentPos = selectionRange.start;
            var prevPos = prevCursorPosition(currentPos);
            if (prevPos != null) {
                Selection.setSelectionRange(new Range(prevPos.node,prevPos.offset,
                                                      currentPos.node,currentPos.offset));
                Selection.deleteSelectionContents();
            }
        }
    }

    // public
    function enterPressed()
    {
        var selectionRange = Selection.getSelectionRange();
        if (selectionRange == null)
            return;

        selectionRange.trackWhileExecuting(function() {
            selectionRange.ensureRangeValidHierarchy();
            if (!selectionRange.isEmpty())
                Selection.deleteSelectionContents();
        });

        var pos = selectionRange.start;

        var detail = selectionRange.detail();
        if ((detail.startParent.nodeName == "OL") || (detail.startParent.nodeName == "UL")) {
            var li = DOM.createElement(document,"LI");
            DOM.insertBefore(detail.startParent,li,detail.startChild);
            
            selectionRange.start.node = li;
            selectionRange.start.offset = 0;
            selectionRange.end.node = li;
            selectionRange.end.offset = 0;
            return;
        }

        selectionRange.trackWhileExecuting(function() {

            if (pos.node.nodeType == Node.TEXT_NODE)
                pos = Formatting.splitTextAfter(pos.node,pos.offset,enterPressedFilter,true);
            else
                pos = Formatting.moveFollowing(pos.node,pos.offset,enterPressedFilter,true);

            selectionRange.start.node = pos.node;
            selectionRange.start.offset = pos.offset;
            selectionRange.end.node = pos.node;
            selectionRange.end.offset = pos.offset;

            if ((pos.node.nodeType == Node.TEXT_NODE) && (pos.node.nodeValue.length == 0)) {
                DOM.deleteNode(pos.node);
            }

            var detail = selectionRange.detail();

            var start = detail.startChild ? detail.startChild : detail.startParent;
            for (var ancestor = start; ancestor != null; ancestor = ancestor.parentNode) {
                var prev = ancestor.previousSibling;
                if ((prev != null) && isParagraphNode(prev) && !nodeHasContent(prev)) {
                    DOM.deleteAllChildren(prev);
                    var br = DOM.createElement(document,"BR");
                    prev.appendChild(br);
                    break;
                }
                else if ((prev != null) && (prev.nodeName == "LI") && !nodeHasContent(prev)) {
                    DOM.deleteAllChildren(prev);
                    break;
                }
            }

            for (var ancestor = start; ancestor != null; ancestor = ancestor.parentNode) {
                if (isParagraphNode(ancestor) && isHeadingNode(ancestor)) {
                    ancestor = DOM.replaceElement(ancestor,"P");
                    ancestor.removeAttribute("id");
                }

                if (isParagraphNode(ancestor) && !nodeHasContent(ancestor)) {
                    var br = DOM.createElement(document,"BR");
                    ancestor.appendChild(br);
                    break;
                }
                else if ((ancestor.nodeName == "LI") && !nodeHasContent(ancestor)) {
                    DOM.deleteAllChildren(ancestor);
                    break;
                }
            }
        });

        function enterPressedFilter(node)
        {
            return (isContainerNode(node) && (node.nodeName != "LI"));
        }
    }

    window.Cursor = new Object();
    Cursor.isValidCursorPosition = isValidCursorPosition;
    Cursor.positionCursor = positionCursor;
    Cursor.moveLeft = moveLeft;
    Cursor.moveRight = moveRight;
    Cursor.updateBRAtEndOfParagraph = updateBRAtEndOfParagraph;
    Cursor.insertCharacter = insertCharacter;
    Cursor.deleteCharacter = deleteCharacter;
    Cursor.enterPressed = enterPressed;

})();
