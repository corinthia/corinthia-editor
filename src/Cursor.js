// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.


(function() {

    var insertionNode = null;
    var insertionTextBefore = null;
    var insertionTextAfter = null;

    // public
    function ensureCursorVisible()
    {
        var rect = Selection.getCursorRect();
        if (rect != null) {
            var cursorY = rect.top + window.scrollY + rect.height/2;
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
            if ((offset > 0) && !isWhitespaceString(value.charAt(offset-1)))
                result = true;

            // At the end of a text node (with no next sibling), and the preceding character
            // is a whitespace character, but there is a non-whitespace character before it -> YES
            if (isWhitespaceString(value.slice(offset)) &&
                (offset >= 2) &&
                isWhitespaceString(value.charAt(offset-1)) &&
                !isWhitespaceString(value.charAt(offset-2)) &&
                (node.nextSibling == null)) {
                result = true;
            }

            // Immediately before a non-whitespace character -> YES
            if ((offset < value.length) && !isWhitespaceString(value.charAt(offset)))
                result = true;

            // Right at the end of a whitespace node which is the first child in a paragraph,
            // and has no next sibling, or is followed by a BR -> YES
            if ((offset == value.length) &&
                !isInlineNode(node.parentNode) &&
                isWhitespaceTextNode(node) &&
                (prev == null) &&
                ((next == null) || (DOM.upperName(next) == "BR")))
                result = true;
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            var prev = (offset == 0) ? null : node.childNodes[offset-1];
            var next = (offset >= node.childNodes.length) ? null : node.childNodes[offset];

            // Directly after an IMG, TABLE, UL, or OL -> YES
            if ((prev != null) &&
                ((DOM.upperName(prev) == "IMG") ||
                 (DOM.upperName(prev) == "TABLE")))
                result = true;

            // Directly before an IMG, TABLE, UL, or OL -> YES
            if ((next != null) &&
                ((DOM.upperName(next) == "IMG") ||
                 (DOM.upperName(next) == "TABLE")))
                result = true;

            // In an empty paragraph or one that only contains a BR
            if ((prev == null) && (next != null) && (DOM.upperName(next) == "BR"))
                result = true;

            if ((prev == null) && (next == null) &&
                (isParagraphNode(node) || (DOM.upperName(node) == "LI") ||
                 INLINE_ELEMENTS_THAT_CAN_HAVE_CHILDREN[DOM.upperName(node)]))
                result = true;

            // Special case for an IMG that directly follows some text that ends in a
            // non-whitespace character. The cursor will be allowed at the end of the text
            // node, so we don't want to allow it before the image (which corresponds to the
            // same location on screen)
            if ((next != null) && (prev != null) &&
                (DOM.upperName(next) == "IMG") &&
                (prev.nodeType == Node.TEXT_NODE) &&
                (prev.nodeValue.length > 0) &&
                !isWhitespaceString(prev.nodeValue.charAt(prev.nodeValue.length-1))) {
                result = false;
            }

            // As above, but for an IMG that directly precedes some text
            if ((prev != null) && (next != null) &&
                (DOM.upperName(prev) == "IMG") &&
                (next.nodeType == Node.TEXT_NODE) &&
                (next.nodeValue.length > 0) &&
                !isWhitespaceString(next.nodeValue.charAt(0))) {
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
            return false;

        var selectionRange = Selection.getSelectionRange();
        var samePosition = ((selectionRange != null) && selectionRange.isEmpty() &&
                            (position.node == selectionRange.start.node) &&
                            (position.offset == selectionRange.start.offset));
        Selection.setEmptySelectionAt(position.node,position.offset);
        ensureCursorVisible();
        return samePosition;
    }

    // public
    function getCursorPosition()
    {
        var rect = Selection.getCursorRect();
        if (rect == null)
            return null;

        var zoom = Viewport.getZoom();
        var left = (rect.left + window.scrollX) * zoom;
        var top = (rect.top + window.scrollY) * zoom;
        var height = rect.height * zoom;
        return { x: left, y: top, width: 0, height: height };
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

        if (pos != null) {
            Selection.setEmptySelectionAt(pos.node,pos.offset);
            ensureCursorVisible();
        }
    }

    // public
    function moveRight()
    {
        var selectionRange = Selection.getSelectionRange();
        if (selectionRange == null)
            return;

        var pos = nextCursorPosition(selectionRange.start);

        if (pos != null) {
            Selection.setEmptySelectionAt(pos.node,pos.offset);
            ensureCursorVisible();
        }
    }

    function moveToStartOfDocument()
    {
        var pos = new Position(document.body,0);
        pos = closestPositionBackwards(pos);
        Selection.setEmptySelectionAt(pos.node,pos.offset);
        ensureCursorVisible();
    }

    function moveToEndOfDocument()
    {
        var pos = new Position(document.body,document.body.childNodes.length);
        pos = closestPositionForwards(pos);
        Selection.setEmptySelectionAt(pos.node,pos.offset);
        ensureCursorVisible();
    }

    // An empty paragraph does not get shown and cannot be edited. We can fix this by adding
    // a BR element as a child
    // public
    function updateBRAtEndOfParagraph(node)
    {
        var paragraph = node;
        while ((paragraph != null) && !isParagraphNode(paragraph))
            paragraph = paragraph.parentNode;
        if (paragraph != null) {

            var br = null;
            for (var last = paragraph; last != null; last = last.lastChild) {

                var child = last;
                while ((child != null) && isWhitespaceTextNode(child))
                    child = child.previousSibling;

                if ((child != null) && (DOM.upperName(child) == "BR"))
                    br = child;
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

    function tryAndFindEquivalentValidPosition(pos)
    {
        if (isValidCursorPosition(pos))
            return pos;

        if ((pos.node.nodeType == Node.TEXT_NODE) &&
            isWhitespaceString(pos.node.nodeValue.slice(pos.offset))) {
            var str = pos.node.nodeValue;
            var whitespace = str.match(/\s+$/);
            if (whitespace) {
                var adjusted = new Position(pos.node,
                                            str.length - whitespace[0].length + 1);
                return adjusted;
            }
        }
        return pos;
    }

    // public
    function closestPositionForwards(pos)
    {
        pos = tryAndFindEquivalentValidPosition(pos);

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
    function closestPositionBackwards(pos)
    {
        pos = tryAndFindEquivalentValidPosition(pos);

        if (isValidCursorPosition(pos))
            return pos;

        var prev = prevCursorPosition(pos);
        if (prev != null)
            return prev;

        var next = nextCursorPosition(pos);
        if (next != null)
            return next;

        return new Position(document.body,0);
    }

    // public
    function insertReference(itemId)
    {
        var a = DOM.createElement(document,"A");
        a.setAttribute("href","#"+itemId);
        Clipboard.pasteNodes([a]);
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

        DOM.insertCharacters(node,offset,character);
        Selection.setEmptySelectionAt(node,offset+1,node,offset+1);
        Selection.getSelectionRange().trackWhileExecuting(function() {
            updateBRAtEndOfParagraph(node);
        });
        ensureCursorVisible();
    }

    // public
    function beginInsertion()
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

        insertionNode = node;
        insertionTextBefore = insertionNode.nodeValue.slice(0,offset);
        insertionTextAfter = insertionNode.nodeValue.slice(offset);

        Selection.setEmptySelectionAt(node,offset,node,offset);
        Selection.getSelectionRange().trackWhileExecuting(function() {
            updateBRAtEndOfParagraph(node);
        });
        ensureCursorVisible();
        return insertionTextBefore;
    }

    // public
    function updateInsertion(str)
    {
        DOM.setNodeValue(insertionNode,insertionTextBefore+str+insertionTextAfter);

        var node = insertionNode;
        var offset = (insertionTextBefore+str).length;
        Selection.setEmptySelectionAt(node,offset,node,offset);
        Selection.getSelectionRange().trackWhileExecuting(function() {
            updateBRAtEndOfParagraph(node);
        });
        ensureCursorVisible();
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
                selectionRange.start.node = prevPos.node;
                selectionRange.start.offset = prevPos.offset;
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
        if ((DOM.upperName(detail.startParent) == "OL") ||
            (DOM.upperName(detail.startParent) == "UL")) {
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
                    updateBRAtEndOfParagraph(prev);
                    break;
                }
            }

            for (var ancestor = start; ancestor != null; ancestor = ancestor.parentNode) {
                if (isParagraphNode(ancestor) && isHeadingNode(ancestor)) {
                    ancestor = DOM.replaceElement(ancestor,"P");
                    ancestor.removeAttribute("id");
                }

                if (isParagraphNode(ancestor) && !nodeHasContent(ancestor)) {
                    updateBRAtEndOfParagraph(prev);
                    break;
                }
                else if ((DOM.upperName(ancestor) == "LI") && !nodeHasContent(ancestor)) {
                    DOM.deleteAllChildren(ancestor);
                    break;
                }
            }

            updateBRAtEndOfParagraph(selectionRange.singleNode());
        });

        Selection.setSelectionRange(selectionRange);
        ensureCursorVisible();

        function enterPressedFilter(node)
        {
            return (isContainerNode(node) && (DOM.upperName(node) != "LI"));
        }
    }

    window.Cursor = new (function Cursor(){});
    Cursor.ensureCursorVisible = trace(ensureCursorVisible);
    Cursor.isValidCursorPosition = trace(isValidCursorPosition);
    Cursor.positionCursor = trace(positionCursor);
    Cursor.getCursorPosition = trace(getCursorPosition);
    Cursor.moveLeft = trace(moveLeft);
    Cursor.moveRight = trace(moveRight);
    Cursor.moveToStartOfDocument = trace(moveToStartOfDocument);
    Cursor.moveToEndOfDocument = trace(moveToEndOfDocument);
    Cursor.updateBRAtEndOfParagraph = trace(updateBRAtEndOfParagraph);
    Cursor.closestPositionForwards = trace(closestPositionForwards);
    Cursor.closestPositionBackwards = trace(closestPositionBackwards);
    Cursor.insertReference = trace(insertReference);
    Cursor.insertCharacter = trace(insertCharacter);
    Cursor.beginInsertion = trace(beginInsertion);
    Cursor.updateInsertion = trace(updateInsertion);
    Cursor.deleteCharacter = trace(deleteCharacter);
    Cursor.enterPressed = trace(enterPressed);

})();
