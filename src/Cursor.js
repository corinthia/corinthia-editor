// Copyright (c) 2011-2012 UX Productivity. All rights reserved.


(function() {

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
            var rects = position.getClientRects();
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

        var node = selectionRange.start.node;
        var offset = selectionRange.start.offset;

        if ((node.nodeType == Node.TEXT_NODE) && (offset > 0)) {
            var newOffset = offset - 1;
            setEmptySelectionAt(node,newOffset,node,newOffset);
        }
        else {
            do {
                node = prevTextNode(node);
            } while ((node != null) && isWhitespaceTextNode(node) && (node.nodeValue.length > 0));
            if (node != null) {
                var length = node.nodeValue.length;
                setEmptySelectionAt(node,length,node,length);
            }
        }
    }

    // public
    function moveRight()
    {
        var selectionRange = getSelectionRange();
        if (selectionRange == null)
            return;

        var node = selectionRange.end.node;
        var offset = selectionRange.end.offset;

        if ((node.nodeType == Node.TEXT_NODE) && (offset < node.nodeValue.length)) {
            var newOffset = offset + 1;
            setEmptySelectionAt(node,newOffset,node,newOffset);
        }
        else {
            do {
                node = nextTextNode(node);
            } while ((node != null) && isWhitespaceTextNode(node) && (node.nodeValue.length > 0));
            if (node != null)
                setEmptySelectionAt(node,0,node,0);
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
        if (node.nodeType != Node.TEXT_NODE) {
            do {
                node = nextTextNode(node);
                offset = 0;
            } while ((node != null) && isWhitespaceTextNode(node));
        }
        if (node != null) {
            node.insertData(offset,character);
            setEmptySelectionAt(node,offset+1,node,offset+1);
        }
        else {
            clearSelection();
        }
    }

    // public
    function deleteCharacter()
    {
        debug("deleteCharacter");
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
            fixTrailingSpace(node);
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
                        while (paragraph.firstChild != null)
                            prev.appendChild(paragraph.firstChild);
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
                    fixTrailingSpace(node);
                    setEmptySelectionAt(node,node.nodeValue.length);
                }
                removeIfEmpty(node);
            }
        }
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
            while ((node != null) && isInlineNode(node)) {
                if (node.previousSibling != null)
                    return false;
                node = node.parentNode;
            }
            return true;
        }

        function fixTrailingSpace(node)
        {
            if ((node.nodeValue.length > 0) &&
                (node.nodeValue.charAt(node.nodeValue.length-1) == " ")) {
                node.nodeValue = node.nodeValue.slice(0,node.nodeValue.length-1) + "\u00a0";
            }
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
            
            fixEmptyParagraph(copy);
            fixEmptyParagraph(paragraph);
            return copy;

            // An empty paragraph does not get shown and cannot be edited. We can fix this by adding
            // a BR element as a child
            function fixEmptyParagraph(paragraph)
            {
                if ((getNodeText(paragraph) == "") &&
                    ((paragraph.lastChild == null) || (paragraph.lastChild.nodeName != "BR"))) {
                    paragraph.appendChild(document.createElement("BR"));
                }
            }
        }
    }

    window.positionCursor = positionCursor;
    window.moveLeft = moveLeft;
    window.moveRight = moveRight;
    window.insertCharacter = insertCharacter;
    window.deleteCharacter = deleteCharacter;
    window.enterPressed = enterPressed;

})();
