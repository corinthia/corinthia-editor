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
        var zoom = getZoom();
        var position = positionAtPoint(x/zoom,y/zoom);
        if (position == null)
            return;

        var selectionRange = getSelectionRange();
        if ((selectionRange != null) && selectionRange.isEmpty() &&
            (position.node == selectionRange.start.node) &&
            (position.offset == selectionRange.start.offset)) {
            var domRange = document.createRange();
            domRange.setStart(position.node,position.offset);
            domRange.setEnd(position.node,position.offset);
            var rects = domRange.getClientRects();
            if (rects.length > 0) {
                var zoom = getZoom();
                var left = (rects[0].left + window.scrollX) * zoom;
                var top = (rects[0].top + window.scrollY) * zoom;
                var height = rects[0].height * zoom;
                editor.showCursorMenu(left,top,height);
            }
        }
        setEmptySelectionAt(position.node,position.offset);
    }

    // public
    function moveLeft()
    {
        var selectionRange = getSelectionRange();
        if (selectionRange == null)
            return;

        var pos = selectionRange.start;

        var count = 0;
        do {
            pos = pos.prev();
            count++;
        } while ((pos != null) && !isValidCursorPosition(pos));

        if (pos != null)
            setEmptySelectionAt(pos.node,pos.offset);
    }

    // public
    function moveRight()
    {
        var selectionRange = getSelectionRange();
        if (selectionRange == null)
            return;

        var pos = selectionRange.start;

        var count = 0;
        do {
            pos = pos.next();
            count++;
        } while ((pos != null) && !isValidCursorPosition(pos));

        if (pos != null)
            setEmptySelectionAt(pos.node,pos.offset);
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
                    br.parentNode.removeChild(br);
                }
            }
            else {
                // Paragraph consists only of whitespace: must have BR at end
                if (br == null) {
                    debug("Adding BR at end of paragraph");
                    br = document.createElement("BR");
                    paragraph.appendChild(br);
                }
            }
        }
    }

    // public
    function insertCharacter(character)
    {
        var selectionRange = getSelectionRange();
        if (selectionRange == null)
            return;

        if (!selectionRange.isEmpty())
            deleteSelectionContents();

        var node = selectionRange.start.node;
        var offset = selectionRange.start.offset;

        if (node.nodeType == Node.ELEMENT_NODE) {
            var emptyTextNode = document.createTextNode("");
            if (offset >= node.childNodes.length)
                node.appendChild(emptyTextNode);
            else
                node.insertBefore(emptyTextNode,node.childNodes[offset]);
            node = emptyTextNode;
            offset = 0;
        }

        node.insertData(offset,character);
        setEmptySelectionAt(node,offset+1,node,offset+1);
        updateBRAtEndOfParagraph(node);
    }

    // public
    function deleteCharacter()
    {
        var selectionRange = getSelectionRange();
        if (selectionRange == null)
            return;

        if (!selectionRange.isEmpty()) {
            deleteSelectionContents();
            return;
        }

        var node = selectionRange.start.node;
        var offset = selectionRange.start.offset;

        if ((node.nodeType == Node.TEXT_NODE) && (offset > 0)) {
            node.nodeValue = node.nodeValue.slice(0,offset-1) +
                             node.nodeValue.slice(offset);
            setEmptySelectionAt(node,offset-1);
        }
        else {
            if (isFirstInParagraph(node)) {
                var paragraph = getParagraph(node);
                if ((paragraph != null) && (paragraph.previousSibling != null)) {
                    var prev = paragraph.previousSibling;
                    
                    while ((prev != null) && isWhitespaceTextNode(prev)) {
                        var prev2 = prev.previousSibling;
                        prev.parentNode.removeChild(prev);
                        prev = prev2;
                    }
                    
                    if ((prev != null) && (prev.nodeType == Node.ELEMENT_NODE)) {
                        if ((prev.lastChild != null) && (prev.lastChild.nodeName == "BR"))
                            prev.removeChild(prev.lastChild);
                        setEmptySelectionAt(prev,prev.childNodes.length);
                        if (nodeHasContent(paragraph)) {
                            while (paragraph.firstChild != null)
                                prev.appendChild(paragraph.firstChild);
                        }
                        paragraph.parentNode.removeChild(paragraph);
                    }
                    updateSelectionDisplay();
                }
            }
            else {
                do {
                    node = prevTextNode(node);
                } while ((node != null) && isWhitespaceTextNode(node));
                if (node != null) {
                    node.nodeValue = node.nodeValue.slice(0,node.nodeValue.length-1);
                    setEmptySelectionAt(node,node.nodeValue.length);
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
                    parent.removeChild(node);
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
                    parent.removeChild(node);
                    removeIfEmpty(parent);
                }
            }
        }
    }

    // public
    function enterPressed()
    {
        var selectionRange = getSelectionRange();
        if (selectionRange == null)
            return;

        if (!selectionRange.isEmpty())
            deleteSelectionContents();

        var node = selectionRange.start.node;
        var offset = selectionRange.start.offset;

        ensureValidHierarchy(node);
        if (node.nodeType == Node.TEXT_NODE)
            splitTextBefore(node,offset);
        
        if (isParagraphNode(node)) {
            // Special case for when the cursor is in an empty paragraph (one that simply
            // contains a BR element); in this case the focus node is the paragraph element
            // itself, because there is no text node.
            var copy = makeNew(node,null);
            setEmptySelectionAt(copy,0,copy,0);
            return;
        }
        
        for (var child = node; child.parentNode != null; child = child.parentNode) {
            if (isParagraphNode(child.parentNode)) {
                makeNew(child.parentNode,child);
                setEmptySelectionAt(node,0,node,0);
                return;
            }
        }

        return;

        function makeNew(paragraph,child)
        {
            var copy = shallowCopyElement(paragraph);
            
            removeAdjacentWhitespace(paragraph);
            
            // If the cursor is in the last paragraph of a list item, we need to
            // add another list item rather than another paragraph
            if (paragraph.parentNode.nodeName == "LI") {
                var li = paragraph.parentNode;
                var liCopy = shallowCopyElement(li);
                li.parentNode.insertBefore(liCopy,li.nextSibling);
                liCopy.appendChild(copy);
                
                // For list items, we want to put all futher paragraphs inside the old list item
                // inside the new one as well
                var follow = paragraph.nextSibling;
                while (follow != null) {
                    var next = follow.nextSibling;
                    liCopy.appendChild(follow);
                    follow = next;
                }
            }
            else {
                paragraph.parentNode.insertBefore(copy,paragraph.nextSibling);
            }
            
            while (child != null) {
                var next = child.nextSibling;
                copy.appendChild(child);
                child = next;
            }

            updateBRAtEndOfParagraph(copy);
            updateBRAtEndOfParagraph(paragraph);
            
            return copy;
        }
    }

    window.isValidCursorPosition = isValidCursorPosition;
    window.positionCursor = positionCursor;
    window.moveLeft = moveLeft;
    window.moveRight = moveRight;
    window.insertCharacter = insertCharacter;
    window.deleteCharacter = deleteCharacter;
    window.enterPressed = enterPressed;

})();
