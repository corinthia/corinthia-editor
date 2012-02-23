// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.


(function() {

    // public
    function isValidCursorPosition(pos)
    {
        var result = false;

        var node = pos.node;
        var offset = pos.offset;

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

            // Directly after an IMG or TABLE -> YES
            if ((prev != null) &&
                ((prev.nodeName == "IMG") ||
                 (prev.nodeName == "TABLE")))
                result = true;

            // Directly before an IMG or TABLE -> YES
            if ((next != null) &&
                ((next.nodeName == "IMG") ||
                 (next.nodeName == "TABLE")))
                result = true;

            // In an empty paragraph or one that only contains a BR
            if ((prev == null) && (next != null) && (next.nodeName == "BR"))
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

    // public
    function moveLeft()
    {
        var selectionRange = Selection.getSelectionRange();
        if (selectionRange == null)
            return;

        var pos = selectionRange.start;

        var count = 0;
        do {
            pos = pos.prev();
            count++;
        } while ((pos != null) && !isValidCursorPosition(pos));

        if (pos != null)
            Selection.setEmptySelectionAt(pos.node,pos.offset);
    }

    // public
    function moveRight()
    {
        var selectionRange = Selection.getSelectionRange();
        if (selectionRange == null)
            return;

        var pos = selectionRange.start;

        var count = 0;
        do {
            pos = pos.next();
            count++;
        } while ((pos != null) && !isValidCursorPosition(pos));

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
                if (last.nodeName == "BR")
                    br = last;
            }

            if (nodeHasContent(paragraph)) {
                // Paragraph has content: don't want BR at end
                if (br != null) {
                    debug("Removing BR at end of paragraph");
                    DOM.deleteNode(br);
                }
            }
            else {
                // Paragraph consists only of whitespace: must have BR at end
                if (br == null) {
                    debug("Adding BR at end of paragraph");
                    br = DOM.createElement(document,"BR");
                    DOM.appendChild(paragraph,br);
                }
            }
        }
    }

    // public
    function insertCharacter(character)
    {
        var selectionRange = Selection.getSelectionRange();
        if (selectionRange == null)
            return;

        if (!selectionRange.isEmpty())
            Selection.deleteSelectionContents();

        var node = selectionRange.start.node;
        var offset = selectionRange.start.offset;

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
        updateBRAtEndOfParagraph(node);
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

        var node = selectionRange.start.node;
        var offset = selectionRange.start.offset;

        if ((node.nodeType == Node.TEXT_NODE) && (offset > 0)) {
            node.nodeValue = node.nodeValue.slice(0,offset-1) +
                             node.nodeValue.slice(offset);
            Selection.setEmptySelectionAt(node,offset-1);
        }
        else {
            if (isFirstInParagraph(node)) {
                var paragraph = getParagraph(node);
                if ((paragraph != null) && (paragraph.previousSibling != null)) {
                    var prev = paragraph.previousSibling;
                    
                    while ((prev != null) && isWhitespaceTextNode(prev)) {
                        var prev2 = prev.previousSibling;
                        DOM.deleteNode(prev);
                        prev = prev2;
                    }
                    
                    if ((prev != null) && (prev.nodeType == Node.ELEMENT_NODE)) {
                        if ((prev.lastChild != null) && (prev.lastChild.nodeName == "BR"))
                            DOM.deleteNode(prev.lastChild);
                        Selection.setEmptySelectionAt(prev,prev.childNodes.length);
                        if (nodeHasContent(paragraph)) {
                            while (paragraph.firstChild != null)
                                DOM.appendChild(prev,paragraph.firstChild);
                        }
                        DOM.deleteNode(paragraph);
                    }
                    Selection.updateSelectionDisplay();
                }
            }
            else {
                do {
                    node = prevTextNode(node);
                } while ((node != null) && isWhitespaceTextNode(node));
                if (node != null) {
                    node.nodeValue = node.nodeValue.slice(0,node.nodeValue.length-1);
                    Selection.setEmptySelectionAt(node,node.nodeValue.length);
                }
                removeIfEmpty(node);
            }
        }
        updateBRAtEndOfParagraph(node);
        return;

        function getParagraph(node)
        {
            while ((node != null) && isInlineNode(node)) {
                node = node.parentNode;
            }
            return node;
        }

        function isFirstInParagraph(node)
        {
            for (; (node != null) && isInlineNode(node); node = node.parentNode) {
                for (var prev = node.previousSibling; prev != null; prev = node.previousSibling) {
                    if (!isWhitespaceTextNode(prev)) {
                        return false;
                    }
                }
                node = node.parentNode;
            }
            return true;
        }

        function removeIfEmpty(node)
        {
            if (node == null)
                return;
            var parent = node.parentNode;
            if (node.nodeType == Node.TEXT_NODE) {
                if (node.nodeValue.length == 0) {
                    DOM.deleteNode(node);
                    removeIfEmpty(parent);
                }
            }
            else if (node.nodeType == Node.ELEMENT_NODE) {
                var haveContent = false;
                for (var child = node.firstChild; child != null; child = child.nextSibling) {
                    if (!isWhitespaceTextNode(child)) {
                        haveContent = true;
                        break;
                    }
                }
                if (!haveContent) {
                    DOM.deleteNode(node);
                    removeIfEmpty(parent);
                }
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

            var pos = selectionRange.start;

            if (pos.node.nodeType == Node.TEXT_NODE)
                Formatting.splitTextBefore(pos.node,pos.offset);
        });

        var node = selectionRange.singleNode();
        
        if (isParagraphNode(node)) {
            // Special case for when the cursor is in an empty paragraph (one that simply
            // contains a BR element); in this case the focus node is the paragraph element
            // itself, because there is no text node.
            var copy = makeNew(node,null);
            Selection.setEmptySelectionAt(copy,0,copy,0);
            return;
        }

        for (var child = node; child.parentNode != null; child = child.parentNode) {
            if (isParagraphNode(child.parentNode)) {
                makeNew(child.parentNode,child);
                Selection.setEmptySelectionAt(node,0,node,0);
                return;
            }
        }

        return;

        function isAtEndOfParagraph(position,paragraph)
        {
            var nextPosition = position;
            do {
                nextPosition = nextPosition.next();
            } while ((nextPosition != null) && !isValidCursorPosition(nextPosition));
            for (var n = nextPosition.node; n != null; n = n.parentNode) {
                if (n == paragraph)
                    return false;
            }
            return true;
        }

        function makeNew(paragraph,child)
        {
            var copy;
            if (isHeadingNode(paragraph) && isAtEndOfParagraph(selectionRange.start,paragraph))
                copy = DOM.createElement(document,"P");
            else
                copy = DOM.shallowCopyElement(paragraph);
            
            DOM.removeAdjacentWhitespace(paragraph);
            
            // If the cursor is in the last paragraph of a list item, we need to
            // add another list item rather than another paragraph
            if (paragraph.parentNode.nodeName == "LI") {
                var li = paragraph.parentNode;
                var liCopy = DOM.shallowCopyElement(li);
                DOM.insertBefore(li.parentNode,liCopy,li.nextSibling);
                DOM.appendChild(liCopy,copy);
                
                // For list items, we want to put all futher paragraphs inside the old list item
                // inside the new one as well
                var follow = paragraph.nextSibling;
                while (follow != null) {
                    var next = follow.nextSibling;
                    DOM.appendChild(liCopy,follow);
                    follow = next;
                }
            }
            else {
                DOM.insertBefore(paragraph.parentNode,copy,paragraph.nextSibling);
            }
            
            while (child != null) {
                var next = child.nextSibling;
                DOM.appendChild(copy,child);
                child = next;
            }

            updateBRAtEndOfParagraph(copy);
            updateBRAtEndOfParagraph(paragraph);
            
            return copy;
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
