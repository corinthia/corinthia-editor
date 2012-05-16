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
var Cursor_insertLink;
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
    Cursor_ensureCursorVisible = trace(function ensureCursorVisible()
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
    });

    // private
    var nodeCausesLineBreak = trace(function nodeCausesLineBreak(node)
    {
        return ((DOM_upperName(node) == "BR") || !isInlineNode(node));
    });

    // private
    var spacesUntilNextContent = trace(function spacesUntilNextContent(node)
    {
        var spaces = 0;
        while (1) {
            if (node.firstChild) {
                node = node.firstChild;
            }
            else if (node.nextSibling) {
                node = node.nextSibling;
            }
            else {
                while ((node.parentNode != null) && (node.parentNode.nextSibling == null)) {
                    node = node.parentNode;
                    if (nodeCausesLineBreak(node))
                        return null;
                }
                if (node.parentNode == null)
                    node = null;
                else
                    node = node.parentNode.nextSibling;
            }

            if ((node == null) || nodeCausesLineBreak(node))
                return null;
            if (isOpaqueNode(node))
                return spaces;
            if (node.nodeType == Node.TEXT_NODE) {
                if (isWhitespaceTextNode(node)) {
                    spaces += node.nodeValue.length;
                }
                else {
                    var matches = node.nodeValue.match(/^\s+/);
                    if (matches == null)
                        return spaces;
                    spaces += matches[0].length;
                    return spaces;
                }
            }
        }
    });

    // public
    Cursor_isValidCursorPosition = trace(function isValidCursorPosition(pos)
    {
        var node = pos.node;
        var offset = pos.offset;

        if (isOpaqueNode(node))
            return false;

        if (node.nodeType == Node.TEXT_NODE) {
            var value = node.nodeValue;

            // If there are multiple adjacent text nodes, consider them as one (adjusting the
            // offset appropriately)

            var firstNode = node;
            var lastNode = node;

            while ((firstNode.previousSibling != null) && isTextNode(firstNode.previousSibling)) {
                firstNode = firstNode.previousSibling;
                value = firstNode.nodeValue + value;
                offset += firstNode.nodeValue.length;
            }

            while ((lastNode.nextSibling != null) && isTextNode(lastNode.nextSibling)) {
                lastNode = lastNode.nextSibling;
                value += lastNode.nodeValue;
            }

            var prevPrevChar = value.charAt(offset-2);
            var prevChar = value.charAt(offset-1);
            var nextChar = value.charAt(offset);
            var havePrevChar = ((prevChar != null) && !isWhitespaceString(prevChar));
            var haveNextChar = ((nextChar != null) && !isWhitespaceString(nextChar));
            var precedingText = value.substring(0,offset);
            var followingText = value.substring(offset);

            if (isWhitespaceString(value)) {
                if (offset == 0) {
                    if ((node == firstNode) &&
                        (firstNode.previousSibling == null) && (lastNode.nextSibling == null))
                        return true;
                    if ((node.nextSibling != null) && (DOM_upperName(node.nextSibling) == "BR"))
                        return true;
                    if ((node.firstChild == null) &&
                        (node.previousSibling == null) &&
                        (node.nextSibling == null)) {
                        return true;
                    }
                }
                return false;
            }

            if (isWhitespaceString(precedingText)) {
                return (haveNextChar &&
                        ((node.previousSibling == null) ||
                         (DOM_upperName(node.previousSibling) == "BR") ||
                         (isParagraphNode(node.previousSibling)) ||
                         (getNodeText(node.previousSibling).match(/\s$/)) ||
                         ((precedingText.length > 0))));
            }

            if (isWhitespaceString(followingText)) {
                return (havePrevChar &&
                        ((node.nextSibling == null) ||
                         (followingText.length > 0) ||
                         (spacesUntilNextContent(node) != 0)));
            }

            return (havePrevChar || haveNextChar);
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            if ((node.firstChild == null) &&
                (isParagraphNode(node) || isListItemNode(node) || isTableCell(node)))
                return true;

            var prevNode = node.childNodes[offset-1];
            var nextNode = node.childNodes[offset];

            if ((prevNode == null) && (nextNode == null) &&
                (CONTAINER_ELEMENTS_ALLOWING_CONTENT[DOM_upperName(node)] ||
                (isInlineNode(node) && !isOpaqueNode(node) && (DOM_upperName(node) != "BR"))))
                return true;

            if ((prevNode != null) && isTableNode(prevNode))
                return true;
            if ((nextNode != null) && isTableNode(nextNode))
                return true;

            if ((nextNode != null) && isItemNumber(nextNode))
                return false;
            if ((prevNode != null) && isItemNumber(prevNode))
                return ((nextNode == null) || isWhitespaceTextNode(nextNode));

            if ((nextNode != null) && (DOM_upperName(nextNode) == "BR"))
                return ((prevNode == null) || !isTextNode(prevNode));

            if ((prevNode != null) && (isOpaqueNode(prevNode) || isTableNode(prevNode))) {
                return ((nextNode == null) ||
                        isOpaqueNode(nextNode) ||
                        isTextNode(nextNode) ||
                        isTableNode(nextNode));
            }
            if ((nextNode != null) && (isOpaqueNode(nextNode) || isTableNode(nextNode))) {
                return ((prevNode == null) ||
                        isOpaqueNode(prevNode) ||
                        isTextNode(prevNode) ||
                        isTableNode(prevNode));
            }
        }

        return false;
    });

    // public
    Cursor_positionCursor = trace(function positionCursor(x,y)
    {
        var position = Cursor_closestPositionForwards(positionAtPoint(x,y));
        if ((position != null) && isOpaqueNode(position.node))
            position = nextCursorPosition(position);
        if (position == null)
            return false;

        var selectionRange = Selection_get();
        var samePosition = ((selectionRange != null) && selectionRange.isEmpty() &&
                            (position.node == selectionRange.start.node) &&
                            (position.offset == selectionRange.start.offset));
        Selection_setEmptySelectionAt(position.node,position.offset);
        Cursor_ensureCursorVisible();
        return samePosition;
    });

    // public
    Cursor_getCursorPosition = trace(function getCursorPosition()
    {
        var rect = Selection_getCursorRect();
        if (rect == null)
            return null;

        var left = rect.left + window.scrollX;
        var top = rect.top + window.scrollY;
        var height = rect.height;
        return { x: left, y: top, width: 0, height: height };
    });

    var prevCursorPosition = trace(function prevCursorPosition(pos)
    {
        do {
            pos = pos.prev();
        } while ((pos != null) && !Cursor_isValidCursorPosition(pos));
        return pos;
    });

    var nextCursorPosition = trace(function nextCursorPosition(pos)
    {
        do {
            pos = pos.next();
        } while ((pos != null) && !Cursor_isValidCursorPosition(pos));
        return pos;
    });

    // public
    Cursor_moveLeft = trace(function moveLeft()
    {
        var selectionRange = Selection_get();
        if (selectionRange == null)
            return;

        var pos = prevCursorPosition(selectionRange.start);

        if (pos != null) {
            Selection_setEmptySelectionAt(pos.node,pos.offset);
            Cursor_ensureCursorVisible();
        }
    });

    // public
    Cursor_moveRight = trace(function moveRight()
    {
        var selectionRange = Selection_get();
        if (selectionRange == null)
            return;

        var pos = nextCursorPosition(selectionRange.start);

        if (pos != null) {
            Selection_setEmptySelectionAt(pos.node,pos.offset);
            Cursor_ensureCursorVisible();
        }
    });

    Cursor_moveToStartOfDocument = trace(function moveToStartOfDocument()
    {
        var pos = new Position(document.body,0);
        pos = Cursor_closestPositionBackwards(pos);
        Selection_setEmptySelectionAt(pos.node,pos.offset);
        Cursor_ensureCursorVisible();
    });

    Cursor_moveToEndOfDocument = trace(function moveToEndOfDocument()
    {
        var pos = new Position(document.body,document.body.childNodes.length);
        pos = Cursor_closestPositionForwards(pos);
        Selection_setEmptySelectionAt(pos.node,pos.offset);
        Cursor_ensureCursorVisible();
    });

    // An empty paragraph does not get shown and cannot be edited. We can fix this by adding
    // a BR element as a child
    // public
    Cursor_updateBRAtEndOfParagraph = trace(function updateBRAtEndOfParagraph(node)
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
    });

    var tryAndFindEquivalentValidPosition = trace(function tryAndFindEquivalentValidPosition(pos)
    {
        if (Cursor_isValidCursorPosition(pos))
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
    });

    // public
    Cursor_closestPositionForwards = trace(function closestPositionForwards(pos)
    {
        if (pos == null)
            return null;

        pos = tryAndFindEquivalentValidPosition(pos);

        if (Cursor_isValidCursorPosition(pos))
            return pos;

        var next = nextCursorPosition(pos);
        if (next != null)
            return next;

        var prev = prevCursorPosition(pos);
        if (prev != null)
            return prev;

        return new Position(document.body,document.body.childNodes.length);
    });

    // public
    Cursor_closestPositionBackwards = trace(function closestPositionBackwards(pos)
    {
        if (pos == null)
            return null;

        pos = tryAndFindEquivalentValidPosition(pos);

        if (Cursor_isValidCursorPosition(pos))
            return pos;

        var prev = prevCursorPosition(pos);
        if (prev != null)
            return prev;

        var next = nextCursorPosition(pos);
        if (next != null)
            return next;

        return new Position(document.body,0);
    });

    // public
    Cursor_insertReference = trace(function insertReference(itemId)
    {
        var a = DOM_createElement(document,"A");
        DOM_setAttribute(a,"href","#"+itemId);
        Clipboard_pasteNodes([a]);
    });

    // public
    Cursor_insertLink = trace(function insertLink(text,url)
    {
        var a = DOM_createElement(document,"A");
        DOM_setAttribute(a,"href",url);
        DOM_appendChild(a,DOM_createTextNode(document,text));
        Clipboard_pasteNodes([a]);
    });

    // public
    Cursor_insertCharacter = trace(function insertCharacter(character)
    {
        Cursor_beginInsertion();
        Cursor_updateInsertion(character);
    });

    // public
    Cursor_beginInsertion = trace(function beginInsertion()
    {
        var selectionRange = Selection_get();
        if (selectionRange == null)
            return;

        if (!selectionRange.isEmpty()) {
            Selection_deleteSelectionContents();
            selectionRange = Selection_get();
        }
        var pos = Cursor_closestPositionForwards(selectionRange.start);
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
        Selection_get().trackWhileExecuting(function() {
            Cursor_updateBRAtEndOfParagraph(node);
        });
        Cursor_ensureCursorVisible();
        return insertionTextBefore;
    });

    // public
    Cursor_updateInsertion = trace(function updateInsertion(str)
    {
        DOM_setNodeValue(insertionNode,insertionTextBefore+str+insertionTextAfter);

        var node = insertionNode;
        var offset = (insertionTextBefore+str).length;
        Selection_setEmptySelectionAt(node,offset,node,offset);
        Selection_get().trackWhileExecuting(function() {
            Cursor_updateBRAtEndOfParagraph(node);
        });
        Cursor_ensureCursorVisible();
    });

    // public
    Cursor_deleteCharacter = trace(function deleteCharacter()
    {
        var selectionRange = Selection_get();
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
                selectionRange = new Range(prevPos.node,prevPos.offset,
                                           selectionRange.end.node,selectionRange.end.offset);
                Selection_setSelectionRange(selectionRange);
                Selection_deleteSelectionContents();
            }
        }
    });

    // public
    Cursor_enterPressed = trace(function enterPressed()
    {
        var selectionRange = Selection_get();
        if (selectionRange == null)
            return;

        selectionRange.trackWhileExecuting(function() {
            selectionRange.ensureRangeInlineNodesInParagraph();
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
            Selection_setSelectionRange(selectionRange);
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

            if (positionAtStartOfHeading(pos)) {
                var container = getContainerOrParagraph(pos.node);
                pos = Formatting_movePreceding(container,0,enterPressedFilter,true);
            }
            else if (pos.node.nodeType == Node.TEXT_NODE) {
                pos = Formatting_splitTextAfter(pos.node,pos.offset,enterPressedFilter,true);
            }
            else {
                pos = Formatting_moveFollowing(pos.node,pos.offset,enterPressedFilter,true);
            }

            selectionRange.start.node = pos.node;
            selectionRange.start.offset = pos.offset;
            selectionRange.end.node = pos.node;
            selectionRange.end.offset = pos.offset;
            Selection_setSelectionRange(selectionRange);

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
                    Cursor_updateBRAtEndOfParagraph(prev);
                    break;
                }
                else if ((prev != null) && isListItemNode(prev) && !nodeHasContent(prev)) {
                    var next;
                    for (var child = prev.firstChild; child != null; child = next) {
                        next = child.nextSibling;
                        if (isWhitespaceTextNode(child))
                            DOM_deleteNode(child);
                        else
                            Cursor_updateBRAtEndOfParagraph(child);
                    }
                    break;
                }
            }

            for (var ancestor = start; ancestor != null; ancestor = ancestor.parentNode) {
                if (isParagraphNode(ancestor) && isHeadingNode(ancestor)) {
                    ancestor = DOM_replaceElement(ancestor,"P");
                    DOM_removeAttribute(ancestor,"id");
                }

                if (isParagraphNode(ancestor) && !nodeHasContent(ancestor)) {
                    Cursor_updateBRAtEndOfParagraph(prev);
                    break;
                }
                else if ((DOM_upperName(ancestor) == "LI") && !nodeHasContent(ancestor)) {
                    DOM_deleteAllChildren(ancestor);
                    break;
                }
            }

            Cursor_updateBRAtEndOfParagraph(selectionRange.singleNode());
        });

        Selection_setSelectionRange(selectionRange);
        Cursor_ensureCursorVisible();

        function enterPressedFilter(node)
        {
            return (isContainerNode(node) && (DOM_upperName(node) != "LI"));
        }

        function getContainerOrParagraph(node)
        {
            while ((node != null) && isInlineNode(node))
                node = node.parentNode;
            return node;
        }

        function positionAtStartOfHeading(pos)
        {
            var container = getContainerOrParagraph(pos.node);
            if (isHeadingNode(container)) {
                var startOffset = 0;
                if (isOpaqueNode(container.firstChild))
                    startOffset = 1;
                var range = new Range(container,startOffset,pos.node,pos.offset);
                return !range.hasContent();
            }
            else
                return false;
        }
    });

})();
