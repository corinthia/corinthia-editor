(function() {

    var prevSelectionNode = null;
    var prevSelectionOffset = null;

    // These variables keep track of the portion of the window that is visible on screen (i.e. not
    // hidden by the keyboard). We need to keep track of these since scrollIntoViewIfNeeded() does
    // not take into account the presence of the keyboard on screen, and every time we move the
    // cursor we want to make sure it is visible *above* the keyboard.

    var visibleAreaWidth = null;
    var visibleAreaHeight = null;

    function ensurePointVisible(x,y)
    {
        var relX = x - window.scrollX;
        var relY = y - window.scrollY;    
        if ((relX < 0) || (relX >= visibleAreaWidth) || (relY < 0) || (relY >= visibleAreaHeight))
            window.scrollTo(x-visibleAreaWidth/2,y-visibleAreaHeight/2);
    }

    // We use these instead of selection.focusNode and selection.focusOffset, because the latter has
    // a bug where the offset can't be at the end of a space.

    var cursorNode = null;
    var cursorOffset = null;
    var cursorDiv = null;

    function createCursorDiv()
    {
        if (cursorDiv == null) {
            cursorDiv = document.createElement("DIV");
            cursorDiv.style.position = "absolute";
            cursorDiv.style.width = "2px";
            cursorDiv.style.backgroundColor = "blue";
            cursorDiv.style.opacity = "50%";
            document.body.appendChild(cursorDiv);
        }
    }

    function destroyCursorDiv()
    {
        if (cursorDiv != null) {
            cursorDiv.parentNode.removeChild(cursorDiv);
            cursorDiv = null;
        }
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

    function setCursorNodeAndOffset(node,offset)
    {
        cursorNode = node;
        cursorOffset = offset;
        
        var selection = window.getSelection();
        if (cursorNode != null)
            selection.setBaseAndExtent(cursorNode,cursorOffset,cursorNode,cursorOffset);
        else
            selection.removeAllRanges();
        // setBaseAndExtent may actually record a different base node/offset, so make sure that's
        // what we're comparing with in setBaseAndExtent()
        prevSelectionNode = selection.baseNode;
        prevSelectionOffset = selection.baseOffset;
        
        reportSelectionFormatting();
        updateCursor();
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

    function fixTrailingSpace(node)
    {
        if ((node.nodeValue.length > 0) && (node.nodeValue.charAt(node.nodeValue.length-1) == " "))
            node.nodeValue = node.nodeValue.slice(0,node.nodeValue.length-1) + "\u00a0";
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
    }

    // An empty paragraph does not get shown and cannot be edited. We can fix this by adding
    // a BR element as a child
    function fixEmptyParagraph(paragraph)
    {
        if (getNodeText(paragraph) == "")
            paragraph.appendChild(document.createElement("BR"));
    }

    function getParagraph(node)
    {
        while ((node != null) && isInlineNode(node)) {
            node = node.parentNode;
        }
        return node;
    }

    // public
    function checkForSelectionChange()
    {
        var selection = window.getSelection();
        if ((selection.focusNode != prevSelectionNode) ||
            (selection.focusOffset != prevSelectionOffset)) {
            destroyCursorDiv();
        }
        prevSelectionNode = selection.focusNode;
        prevSelectionOffset = selection.focusOffset;
    }

    // public
    function setVisibleArea(width,height)
    {
        visibleAreaWidth = width;
        visibleAreaHeight = height;
        updateCursor();
    }

    // public
    function positionCursor(x,y)
    {
        var zoom = getZoom();
        var range = document.caretRangeFromPoint(x/zoom,y/zoom);
        if (range == null)
            return;
        setCursorNodeAndOffset(range.startContainer,range.startOffset);
    }

    // public
    function clearCursor()
    {
        setCursorNodeAndOffset(null,0);
    }

    // public
    function moveLeft()
    {
        if (cursorNode == null)
            return;
        if ((cursorNode.nodeType == Node.TEXT_NODE) && (cursorOffset > 0)) {
            var newOffset = cursorOffset - 1;
            setCursorNodeAndOffset(cursorNode,newOffset,cursorNode,newOffset);
        }
        else {
            var node = cursorNode;
            do {
                node = prevTextNode(node);
            } while ((node != null) && isWhitespaceTextNode(node) && (node.nodeValue.length > 0));
            if (node != null) {
                var length = node.nodeValue.length;
                setCursorNodeAndOffset(node,length,node,length);
            }
        }
    }

    // public
    function moveRight()
    {
        if (cursorNode == null) {
            return;
        }
        if ((cursorNode.nodeType == Node.TEXT_NODE) &&
            (cursorOffset < cursorNode.nodeValue.length)) {
            var newOffset = cursorOffset + 1;
            setCursorNodeAndOffset(cursorNode,newOffset,cursorNode,newOffset);
        }
        else {
            var node = cursorNode;
            do {
                node = nextTextNode(node);
            } while ((node != null) && isWhitespaceTextNode(node) && (node.nodeValue.length > 0));
            if (node != null)
                setCursorNodeAndOffset(node,0,node,0);
        }
    }

    // public
    function insertCharacter(character)
    {
        if (cursorNode == null)
            return;
        var node = cursorNode;
        var offset = cursorOffset;
        if (node.nodeType != Node.TEXT_NODE) {
            do {
                node = nextTextNode(node);
                offset = 0;
            } while ((node != null) && isWhitespaceTextNode(node));
        }
        if (node != null) {
            node.insertData(offset,character);
            setCursorNodeAndOffset(node,offset+1,node,offset+1);
        }
        updateCursor();
    }

    // public
    function deleteCharacter()
    {
        if (cursorNode == null)
            return;
        if ((cursorNode.nodeType == Node.TEXT_NODE) && (cursorOffset > 0)) {
            cursorNode.nodeValue = cursorNode.nodeValue.slice(0,cursorOffset-1) +
                cursorNode.nodeValue.slice(cursorOffset);
            fixTrailingSpace(cursorNode);
            setCursorNodeAndOffset(cursorNode,cursorOffset-1);
        }
        else {
            if (isFirstInParagraph(cursorNode)) {
                var paragraph = getParagraph(cursorNode);
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
                    updateCursor();
                }
            }
            else {
                var node = cursorNode;
                do {
                    node = prevTextNode(node);
                } while ((node != null) && isWhitespaceTextNode(node));
                if (node != null) {
                    node.nodeValue = node.nodeValue.slice(0,node.nodeValue.length-1);
                    fixTrailingSpace(node);
                    setCursorNodeAndOffset(node,node.nodeValue.length);
                }
                removeIfEmpty(cursorNode);
            }
        }
    }

    // public
    function enterPressed()
    {
        var selection = window.getSelection();
        var node = selection.focusNode;
        var offset = selection.focusOffset;
        if (node != null) {
            ensureValidHierarchy(node);
            if (node.nodeType == Node.TEXT_NODE)
                splitTextBefore(node,offset);
            
            if (isParagraphNode(node)) {
                // Special case for when the cursor is in an empty paragraph (one that simply
                // contains a BR element); in this case the focus node is the paragraph element
                // itself, because there is no text node.
                debug("enterPressed case 1");
                var copy = makeNew(node,null);
                setCursorNodeAndOffset(copy,0,copy,0);
                return;
            }
            
            for (var child = node; child.parentNode != null; child = child.parentNode) {
                if (isParagraphNode(child.parentNode)) {
                    debug("enterPressed case 2");
                    debug("child is \""+getNodeText(child)+"\"");
                    debug("child.parentNode is \""+getNodeText(child.parentNode)+"\"");
                    makeNew(child.parentNode,child);
                    setCursorNodeAndOffset(node,0,node,0);
                    return;
                }
            }
        }
    }

    // public (called from viewport.js)
    function updateCursor()
    {
        if (cursorNode != null) {
            debug("updateCursor: cursorNode = "+cursorNode.nodeName+
                  ", cursorOffset = "+cursorOffset);
            var range = document.createRange();
            range.setStart(cursorNode,cursorOffset);
            range.setEnd(cursorNode,cursorOffset);
            var rects = range.getClientRects();

            var left;
            var top;
            var height;
            
            if ((rects != null) && (rects.length > 0)) {
                left = rects[0].left + window.scrollX;
                top = rects[0].top + window.scrollY;
                height = rects[0].height;
            }
            else {
                var absolute = getAbsoluteOffset(cursorNode);
                left = absolute.offsetLeft;
                top = absolute.offsetTop;            
                height = cursorNode.parentNode.offsetHeight;
            }
            
            createCursorDiv();
            cursorDiv.style.left = left+"px";
            cursorDiv.style.top = top+"px";
            cursorDiv.style.height = height+"px";
            ensurePointVisible(left,top+height/2);
            return;
        }
        destroyCursorDiv();
    }

    window.checkForSelectionChange = checkForSelectionChange;
    window.setVisibleArea = setVisibleArea;
    window.positionCursor = positionCursor;
    window.clearCursor = clearCursor;
    window.moveLeft = moveLeft;
    window.moveRight = moveRight;
    window.insertCharacter = insertCharacter;
    window.deleteCharacter = deleteCharacter;
    window.enterPressed = enterPressed;
    window.updateCursor = updateCursor;

})();
