// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Cursor_ensureCursorVisible;
var Cursor_isValidCursorPosition;
var Cursor_positionCursor;
var Cursor_getCursorPosition;
var Cursor_moveLeft;
var Cursor_moveRight;
var Cursor_moveToStartOfDocument;
var Cursor_moveToEndOfDocument;
var Cursor_updateBRAtEndOfParagraph;
var Cursor_closestPositionForwards;
var Cursor_closestPositionBackwards;
var Cursor_insertReference;
var Cursor_insertCharacter;
var Cursor_beginInsertion;
var Cursor_updateInsertion;
var Cursor_deleteCharacter;
var Cursor_enterPressed;

(function() {

    var insertionNode = null;
    var insertionTextBefore = null;
    var insertionTextAfter = null;

    // public
    function ensureCursorVisible()
    {
        var rect = Selection_getCursorRect();
        if (rect != null) {
            var extraSpace = 4;

            var cursorTop = rect.top + window.scrollY - extraSpace;
            var cursorBottom = rect.top + rect.height + window.scrollY + extraSpace;

            var windowTop = window.scrollY;
            var windowBottom = window.scrollY + window.innerHeight;

            if (cursorTop < windowTop)
                window.scrollTo(window.scrollX,cursorTop);
            else if (cursorBottom > windowBottom)
                window.scrollTo(window.scrollX,cursorBottom - window.innerHeight);
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
                ((next == null) || (DOM_upperName(next) == "BR")))
                result = true;
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            var prev = node.childNodes[offset-1];
            var next = node.childNodes[offset];

            // Directly after an IMG, TABLE, UL, or OL -> YES
            if ((prev != null) &&
                ((DOM_upperName(prev) == "IMG") ||
                 (DOM_upperName(prev) == "TABLE") ||
                 isOpaqueNode(prev)))
                result = true;

            // Directly before an IMG, TABLE, UL, or OL -> YES
            if ((next != null) &&
                ((DOM_upperName(next) == "IMG") ||
                 (DOM_upperName(next) == "TABLE") ||
                 isOpaqueNode(next)))
                result = true;

            // Just before a BR (but not after a non-empty text node)
            if ((next != null) && (DOM_upperName(next) == "BR")) {
                if ((prev == null) ||
                    (prev.nodeType != Node.TEXT_NODE) ||
                    isWhitespaceTextNode(prev)) {
                    result = true;
                }
            }

            // Just after a numbering span for a heading, figure, or table
            if ((prev != null) && (DOM_upperName(prev) == "SPAN") &&
                ((prev.getAttribute("class") == Keys.HEADING_NUMBER) ||
                 (prev.getAttribute("class") == Keys.FIGURE_NUMBER) ||
                 (prev.getAttribute("class") == Keys.TABLE_NUMBER))) {

                var followingContent = false;
                for (; next != null; next = next.nextSibling) {
                    if (nodeHasContent(next)) {
                        followingContent = true;
                        break;
                    }
                }

                if (!followingContent)
                    result = true;
            }

            if ((prev == null) && (next == null) &&
                (isParagraphNode(node) || (DOM_upperName(node) == "LI") ||
                 INLINE_ELEMENTS_THAT_CAN_HAVE_CHILDREN[DOM_upperName(node)] ||
                 CONTAINER_ELEMENTS_ALLOWING_CONTENT[DOM_upperName(node)]))
                result = true;

            // Special case for an IMG or opaque node that directly follows some text that ends in a
            // non-whitespace character. The cursor will be allowed at the end of the text
            // node, so we don't want to allow it before the image (which corresponds to the
            // same location on screen)
            if ((next != null) && (prev != null) &&
                ((DOM_upperName(next) == "IMG") || isOpaqueNode(next)) &&
                (prev.nodeType == Node.TEXT_NODE) &&
                (prev.nodeValue.length > 0) &&
                !isWhitespaceString(prev.nodeValue.charAt(prev.nodeValue.length-1))) {
                result = false;
            }

            // As above, but for an IMG or opaque node that directly precedes some text
            if ((prev != null) && (next != null) &&
                ((DOM_upperName(prev) == "IMG") || isOpaqueNode(prev)) &&
                (next.nodeType == Node.TEXT_NODE) &&
                (next.nodeValue.length > 0) &&
                !isWhitespaceString(next.nodeValue.charAt(0))) {
                result = false;
            }

            // If the position is in a heading node but before the numbering span, don't allow it
            if ((prev == null) && (next != null) && isOpaqueNode(next) && isHeadingNode(node)) {
                result = false;
            }
        }

        return result;
    }

    // public
    function positionCursor(x,y)
    {
        var zoom = Viewport_getZoom();
        var position = positionAtPoint(x/zoom,y/zoom);
        if ((position != null) && isOpaqueNode(position.node))
            position = nextCursorPosition(position);
        if (position == null)
            return false;

        var selectionRange = Selection_getSelectionRange();
        var samePosition = ((selectionRange != null) && selectionRange.isEmpty() &&
                            (position.node == selectionRange.start.node) &&
                            (position.offset == selectionRange.start.offset));
        Selection_setEmptySelectionAt(position.node,position.offset);
        ensureCursorVisible();
        return samePosition;
    }

    // public
    function getCursorPosition()
    {
        var rect = Selection_getCursorRect();
        if (rect == null)
            return null;

        var zoom = Viewport_getZoom();
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
        var selectionRange = Selection_getSelectionRange();
        if (selectionRange == null)
            return;

        var pos = prevCursorPosition(selectionRange.start);

        if (pos != null) {
            Selection_setEmptySelectionAt(pos.node,pos.offset);
            ensureCursorVisible();
        }
    }

    // public
    function moveRight()
    {
        var selectionRange = Selection_getSelectionRange();
        if (selectionRange == null)
            return;

        var pos = nextCursorPosition(selectionRange.start);

        if (pos != null) {
            Selection_setEmptySelectionAt(pos.node,pos.offset);
            ensureCursorVisible();
        }
    }

    function moveToStartOfDocument()
    {
        var pos = new Position(document.body,0);
        pos = closestPositionBackwards(pos);
        Selection_setEmptySelectionAt(pos.node,pos.offset);
        ensureCursorVisible();
    }

    function moveToEndOfDocument()
    {
        var pos = new Position(document.body,document.body.childNodes.length);
        pos = closestPositionForwards(pos);
        Selection_setEmptySelectionAt(pos.node,pos.offset);
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

                if ((child != null) && (DOM_upperName(child) == "BR"))
                    br = child;
            }

            if (nodeHasContent(paragraph)) {
                // Paragraph has content: don't want BR at end
                if (br != null) {
                    DOM_deleteNode(br);
                }
            }
            else {
                // Paragraph consists only of whitespace: must have BR at end
                if (br == null) {
                    br = DOM_createElement(document,"BR");
                    DOM_appendChild(paragraph,br);
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
        var a = DOM_createElement(document,"A");
        a.setAttribute("href","#"+itemId);
        Clipboard_pasteNodes([a]);
    }

    // public
    function insertCharacter(character)
    {
        var selectionRange = Selection_getSelectionRange();
        if (selectionRange == null)
            return;

        if (!selectionRange.isEmpty())
            Selection_deleteSelectionContents();
        var pos = closestPositionForwards(selectionRange.start);
        var node = pos.node;
        var offset = pos.offset;

        if (node.nodeType == Node.ELEMENT_NODE) {
            var emptyTextNode = DOM_createTextNode(document,"");
            if (offset >= node.childNodes.length)
                DOM_appendChild(node,emptyTextNode);
            else
                DOM_insertBefore(node,emptyTextNode,node.childNodes[offset]);
            node = emptyTextNode;
            offset = 0;
        }

        DOM_insertCharacters(node,offset,character);
        Selection_setEmptySelectionAt(node,offset+1,node,offset+1);
        Selection_getSelectionRange().trackWhileExecuting(function() {
            updateBRAtEndOfParagraph(node);
        });
        ensureCursorVisible();
    }

    // public
    function beginInsertion()
    {
        var selectionRange = Selection_getSelectionRange();
        if (selectionRange == null)
            return;

        if (!selectionRange.isEmpty())
            Selection_deleteSelectionContents();
        var pos = closestPositionForwards(selectionRange.start);
        var node = pos.node;
        var offset = pos.offset;

        if (node.nodeType == Node.ELEMENT_NODE) {
            var emptyTextNode = DOM_createTextNode(document,"");
            if (offset >= node.childNodes.length)
                DOM_appendChild(node,emptyTextNode);
            else
                DOM_insertBefore(node,emptyTextNode,node.childNodes[offset]);
            node = emptyTextNode;
            offset = 0;
        }

        insertionNode = node;
        insertionTextBefore = insertionNode.nodeValue.slice(0,offset);
        insertionTextAfter = insertionNode.nodeValue.slice(offset);

        Selection_setEmptySelectionAt(node,offset,node,offset);
        Selection_getSelectionRange().trackWhileExecuting(function() {
            updateBRAtEndOfParagraph(node);
        });
        ensureCursorVisible();
        return insertionTextBefore;
    }

    // public
    function updateInsertion(str)
    {
        DOM_setNodeValue(insertionNode,insertionTextBefore+str+insertionTextAfter);

        var node = insertionNode;
        var offset = (insertionTextBefore+str).length;
        Selection_setEmptySelectionAt(node,offset,node,offset);
        Selection_getSelectionRange().trackWhileExecuting(function() {
            updateBRAtEndOfParagraph(node);
        });
        ensureCursorVisible();
    }

    // public
    function deleteCharacter()
    {
        var selectionRange = Selection_getSelectionRange();
        if (selectionRange == null)
            return;

        if (!selectionRange.isEmpty()) {
            Selection_deleteSelectionContents();
            return;
        }
        else {
            var currentPos = selectionRange.start;
            var prevPos = prevCursorPosition(currentPos);
            if (prevPos != null) {
                selectionRange.start.node = prevPos.node;
                selectionRange.start.offset = prevPos.offset;
                Selection_deleteSelectionContents();
            }
        }
    }

    // public
    function enterPressed()
    {
        var selectionRange = Selection_getSelectionRange();
        if (selectionRange == null)
            return;

        selectionRange.trackWhileExecuting(function() {
            selectionRange.ensureRangeValidHierarchy();
            if (!selectionRange.isEmpty())
                Selection_deleteSelectionContents();
        });

        var pos = selectionRange.start;

        var detail = selectionRange.detail();
        if ((DOM_upperName(detail.startParent) == "OL") ||
            (DOM_upperName(detail.startParent) == "UL")) {
            var li = DOM_createElement(document,"LI");
            DOM_insertBefore(detail.startParent,li,detail.startChild);
            
            selectionRange.start.node = li;
            selectionRange.start.offset = 0;
            selectionRange.end.node = li;
            selectionRange.end.offset = 0;
            return;
        }

        selectionRange.trackWhileExecuting(function() {

            // If we're directly in a container node, add a paragraph, so we have something to
            // split.
            if (enterPressedFilter(pos.node) || (pos.node == document.body)) {
                var p = DOM_createElement(document,"P");
                DOM_insertBefore(pos.node,p,pos.node.childNodes[pos.offset]);
                pos = new Position(p,0);
            }

            if (pos.node.nodeType == Node.TEXT_NODE)
                pos = Formatting_splitTextAfter(pos.node,pos.offset,enterPressedFilter,true);
            else
                pos = Formatting_moveFollowing(pos.node,pos.offset,enterPressedFilter,true);

            selectionRange.start.node = pos.node;
            selectionRange.start.offset = pos.offset;
            selectionRange.end.node = pos.node;
            selectionRange.end.offset = pos.offset;

            if ((pos.node.nodeType == Node.TEXT_NODE) && (pos.node.nodeValue.length == 0)) {
                DOM_deleteNode(pos.node);
            }

            var detail = selectionRange.detail();

            // If a preceding paragraph has become empty as a result of enter being pressed
            // while the cursor was in it, then update the BR at the end of the paragraph
            var start = detail.startChild ? detail.startChild : detail.startParent;
            for (var ancestor = start; ancestor != null; ancestor = ancestor.parentNode) {
                var prev = ancestor.previousSibling;
                if ((prev != null) && isParagraphNode(prev) && !nodeHasContent(prev)) {
                    DOM_deleteAllChildren(prev);
                    updateBRAtEndOfParagraph(prev);
                    break;
                }
                else if ((prev != null) && isListItemNode(prev) && !nodeHasContent(prev)) {
                    var next;
                    for (var child = prev.firstChild; child != null; child = next) {
                        next = child.nextSibling;
                        if (isWhitespaceTextNode(child))
                            DOM_deleteNode(child);
                        else
                            updateBRAtEndOfParagraph(child);
                    }
                    break;
                }
            }

            for (var ancestor = start; ancestor != null; ancestor = ancestor.parentNode) {
                if (isParagraphNode(ancestor) && isHeadingNode(ancestor)) {
                    ancestor = DOM_replaceElement(ancestor,"P");
                    ancestor.removeAttribute("id");
                }

                if (isParagraphNode(ancestor) && !nodeHasContent(ancestor)) {
                    updateBRAtEndOfParagraph(prev);
                    break;
                }
                else if ((DOM_upperName(ancestor) == "LI") && !nodeHasContent(ancestor)) {
                    DOM_deleteAllChildren(ancestor);
                    break;
                }
            }

            updateBRAtEndOfParagraph(selectionRange.singleNode());
        });

        Selection_setSelectionRange(selectionRange);
        ensureCursorVisible();

        function enterPressedFilter(node)
        {
            return (isContainerNode(node) && (DOM_upperName(node) != "LI"));
        }
    }

    Cursor_ensureCursorVisible = trace(ensureCursorVisible);
    Cursor_isValidCursorPosition = trace(isValidCursorPosition);
    Cursor_positionCursor = trace(positionCursor);
    Cursor_getCursorPosition = trace(getCursorPosition);
    Cursor_moveLeft = trace(moveLeft);
    Cursor_moveRight = trace(moveRight);
    Cursor_moveToStartOfDocument = trace(moveToStartOfDocument);
    Cursor_moveToEndOfDocument = trace(moveToEndOfDocument);
    Cursor_updateBRAtEndOfParagraph = trace(updateBRAtEndOfParagraph);
    Cursor_closestPositionForwards = trace(closestPositionForwards);
    Cursor_closestPositionBackwards = trace(closestPositionBackwards);
    Cursor_insertReference = trace(insertReference);
    Cursor_insertCharacter = trace(insertCharacter);
    Cursor_beginInsertion = trace(beginInsertion);
    Cursor_updateInsertion = trace(updateInsertion);
    Cursor_deleteCharacter = trace(deleteCharacter);
    Cursor_enterPressed = trace(enterPressed);

})();
