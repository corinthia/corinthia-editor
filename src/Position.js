// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Position;
var Position_prev;
var Position_next;
var Position_trackWhileExecuting;
var Position_closestActualNode;
var Position_okForInsertion;
var Position_okForMovement;
var Position_prevMatch;
var Position_nextMatch;
var Position_closestMatchForwards;
var Position_closestMatchBackwards;
var Position_track;
var Position_untrack;
var Position_rectAtPos;
var Position_displayRectAtPos;
var Position_preferTextPosition;
var Position_preferElementPosition;
var Position_compare;
var Position_atPoint;

(function() {

    // public
    Position = function(node,offset)
    {
        if (node == document.documentElement)
            throw new Error("node is root element");
        Object.defineProperty(this,"self",{value: {}});
        var self = this.self;
        self.this = this;
        self.node = node;
        self.offset = offset;
        self.origOffset = offset;
        self.tracking = 0;
        this.posId = null;
        this.targetX = null;

        Object.defineProperty(this,"node",{
            get: function() { return this.self.node },
            set: setNode,
            enumerable: true });
        Object.defineProperty(this,"offset",{
            get: function() { return this.self.offset },
            set: function(value) { this.self.offset = value },
            enumerable: true});
        Object.defineProperty(this,"origOffset",{
            get: function() { return this.self.origOffset },
            set: function(value) { this.self.origOffset = value },
            enumerable: true});

        Object.preventExtensions(this);
    }

    function actuallyStartTracking(self)
    {
        DOM_addTrackedPosition(self.this);
    }

    function actuallyStopTracking(self)
    {
        DOM_removeTrackedPosition(self.this);
    }

    function startTracking(self)
    {
        if (self.tracking == 0)
            actuallyStartTracking(self);
        self.tracking++;
    }

    function stopTracking(self)
    {
        self.tracking--;
        if (self.tracking == 0)
            actuallyStopTracking(self);
    }

    function setNode(node)
    {
        var self = this.self;
        if (self.tracking > 0)
            actuallyStopTracking(self);

        self.node = node;

        if (self.tracking > 0)
            actuallyStartTracking(self);
    }

    function setNodeAndOffset(self,node,offset)
    {
        self.this.node = node;
        self.this.offset = offset;
    }

    // public
    Position.prototype.toString = function()
    {
        var self = this.self;
        var result;
        if (self.node.nodeType == Node.TEXT_NODE) {
            var extra = "";
            if (self.offset > self.node.nodeValue.length) {
                for (var i = self.node.nodeValue.length; i < self.offset; i++)
                    extra += "!";
            }
            var id = "";
            if (window.debugIds)
                id = self.node._nodeId.replace(/^.*:/,"")+":";
            result = id+JSON.stringify(self.node.nodeValue.slice(0,self.offset)+extra+"|"+
                                       self.node.nodeValue.slice(self.offset));
        }
        else {
            result = "("+nodeString(self.node)+","+self.offset+")";
        }
        if (this.posId != null)
            result = "["+this.posId+"]"+result;
        return result;
    }

    function positionSpecial(pos,forwards,backwards)
    {
        var node = pos.node;
        var offset = pos.offset;

        var prev = node.childNodes[offset-1];
        var next = node.childNodes[offset];

        // Moving left from the start of a caption - go to the end of the table
        if (isTableCaptionNode(node) && backwards && (prev == null))
            return new Position(node.parentNode,node.parentNode.childNodes.length);

        // Moving right from the end of a caption - go after the table
        if (isTableCaptionNode(node) && forwards && (next == null))
            return new Position(node.parentNode.parentNode,DOM_nodeOffset(node.parentNode)+1);

        // Moving left from just after a table - go to the end of the caption (if there is one)
        if ((prev != null) && isTableNode(prev) && backwards) {
            var firstChild = firstChildElement(prev);
            if (isTableCaptionNode(firstChild))
                return new Position(firstChild,firstChild.childNodes.length);
        }

        // Moving right from just before a table - bypass the the caption (if there is one)
        if ((next != null) && isTableNode(next) && forwards) {
            var firstChild = firstChildElement(next);
            if (isTableCaptionNode(firstChild))
                return new Position(next,DOM_nodeOffset(firstChild)+1);
        }

        // Moving right from the end of a table - go to the start of the caption (if there is one)
        if (isTableNode(node) && (next == null) && forwards) {
            var firstChild = firstChildElement(node);
            if (isTableCaptionNode(firstChild))
                return new Position(firstChild,0);
        }

        // Moving left just after a caption node - skip the caption
        if ((prev != null) && isTableCaptionNode(prev) && backwards)
            return new Position(node,offset-1);

        return null;
    }

    // public
    Position_prev = trace(function prev(pos)
    {
        if (pos.node.nodeType == Node.ELEMENT_NODE) {
            var r = positionSpecial(pos,false,true);
            if (r != null)
                return r;
            if (pos.offset == 0) {
                return upAndBack(pos);
            }
            else {
                var child = pos.node.childNodes[pos.offset-1];
                return new Position(child,DOM_maxChildOffset(child));
            }
        }
        else if (pos.node.nodeType == Node.TEXT_NODE) {
            if (pos.offset > 0)
                return new Position(pos.node,pos.offset-1);
            else
                return upAndBack(pos);
        }
        else {
            return null;
        }

        function upAndBack(pos)
        {
            if (pos.node == pos.node.ownerDocument.body)
                return null;
            else
                return new Position(pos.node.parentNode,DOM_nodeOffset(pos.node));
        }
    });

    // public
    Position_next = trace(function next(pos)
    {
        if (pos.node.nodeType == Node.ELEMENT_NODE) {
            var r = positionSpecial(pos,true,false);
            if (r != null)
                return r;
            if (pos.offset == pos.node.childNodes.length)
                return upAndForwards(pos);
            else
                return new Position(pos.node.childNodes[pos.offset],0);
        }
        else if (pos.node.nodeType == Node.TEXT_NODE) {
            if (pos.offset < pos.node.nodeValue.length)
                return new Position(pos.node,pos.offset+1);
            else
                return upAndForwards(pos);
        }
        else {
            return null;
        }

        function upAndForwards(pos)
        {
            if (pos.node == pos.node.ownerDocument.body)
                return null;
            else
                return new Position(pos.node.parentNode,DOM_nodeOffset(pos.node)+1);
        }
    });

    // public
    Position_trackWhileExecuting = trace(function(positions,fun)
    {
        for (var i = 0; i < positions.length; i++)
            startTracking(positions[i].self);
        try {
            return fun();
        }
        finally {
            for (var i = 0; i < positions.length; i++)
                stopTracking(positions[i].self);
        }
    });

    // public
    Position_closestActualNode = trace(function closestActualNode(pos,preferElement)
    {
        var node = pos.node;
        var offset = pos.offset;
        if ((node.nodeType != Node.ELEMENT_NODE) || (node.firstChild == null))
            return node;
        else if (offset == 0)
            return node.firstChild;
        else if (offset >= node.childNodes.length)
            return node.lastChild;

        var prev = node.childNodes[offset-1];
        var next = node.childNodes[offset];
        if (preferElement &&
            (next.nodeType != Node.ELEMENT_NODE) &&
            (prev.nodeType == Node.ELEMENT_NODE)) {
            return prev;
        }
        else {
            return next;
        }
    });

    // public
    Position_okForInsertion = trace(function okForInsertion(pos)
    {
        return Position_okForMovement(pos,true);
    });

    // public
    Position_okForMovement = trace(function okForMovement(pos,insertion)
    {
        var nodeCausesLineBreak = trace(nodeCausesLineBreak);
        var spacesUntilNextContent = trace(spacesUntilNextContent);

        var node = pos.node;
        var offset = pos.offset;

        if (isOpaqueNode(node))
            return false;

        for (var ancestor = node; ancestor != null; ancestor = ancestor.parentNode) {
            if (DOM_upperName(node) == "FIGCAPTION")
                break;
            if (isFigureNode(node))
                return false;
        }

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
                    if (insertion && (node.previousSibling != null) &&
                        isInlineNode(node.previousSibling) &&
                        !isOpaqueNode(node.previousSibling) &&
                        (DOM_upperName(node.previousSibling) != "BR"))
                        return true;
                }
                return false;
            }

            if (insertion)
                return true;

            if (isWhitespaceString(precedingText)) {
                return (haveNextChar &&
                        ((node.previousSibling == null) ||
                         (DOM_upperName(node.previousSibling) == "BR") ||
                         (isParagraphNode(node.previousSibling)) ||
                         (getNodeText(node.previousSibling).match(/\s$/)) ||
                         isItemNumber(node.previousSibling) ||
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

            if ((prevNode != null) && (isTableNode(prevNode) || isFigureNode(prevNode)))
                return true;
            if ((nextNode != null) && (isTableNode(nextNode) || isFigureNode(nextNode)))
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

        function nodeCausesLineBreak(node)
        {
            return ((DOM_upperName(node) == "BR") || !isInlineNode(node));
        };

        function spacesUntilNextContent(node)
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
        };
    });

    Position_prevMatch = trace(function prevCursorPosition(pos,fun)
    {
        do {
            pos = Position_prev(pos);
        } while ((pos != null) && !fun(pos));
        return pos;
    });

    Position_nextMatch = trace(function nextCursorPosition(pos,fun)
    {
        do {
            pos = Position_next(pos);
        } while ((pos != null) && !fun(pos));
        return pos;
    });

    var findEquivalentValidPosition = trace(function findEquivalentValidPosition(pos,fun)
    {
        var node = pos.node;
        var offset = pos.offset;
        if (node.nodeType == Node.ELEMENT_NODE) {
            var before = node.childNodes[offset-1];
            var after = node.childNodes[offset];
            if ((before != null) && (before.nodeType == Node.TEXT_NODE)) {
                var candidate = new Position(before,before.nodeValue.length);
                if (fun(candidate))
                    return candidate;
            }
            if ((after != null) && (after.nodeType == Node.TEXT_NODE)) {
                var candidate = new Position(after,0);
                if (fun(candidate))
                    return candidate;
            }
        }

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
    Position_closestMatchForwards = trace(function closestMatchForwards(pos,fun)
    {
        if (pos == null)
            return null;

        if (!fun(pos))
            pos = findEquivalentValidPosition(pos,fun);

        if (fun(pos))
            return pos;

        var next = Position_nextMatch(pos,fun);
        if (next != null)
            return next;

        var prev = Position_prevMatch(pos,fun);
        if (prev != null)
            return prev;

        return new Position(document.body,document.body.childNodes.length);
    });

    // public
    Position_closestMatchBackwards = trace(function closestMatchBackwards(pos,fun)
    {
        if (pos == null)
            return null;

        if (!fun(pos))
            pos = findEquivalentValidPosition(pos,fun);

        if (fun(pos))
            return pos;

        var prev = Position_prevMatch(pos,fun);
        if (prev != null)
            return prev;

        var next = Position_nextMatch(pos,fun);
        if (next != null)
            return next;

        return new Position(document.body,0);
    });

    Position_track = trace(function track(pos)
    {
        startTracking(pos.self);
    });

    Position_untrack = trace(function untrack(pos)
    {
        stopTracking(pos.self);
    });

    Position_rectAtPos = trace(function rectAtPos(pos)
    {
        if (pos == null)
            return null;
        var range = new Range(pos.node,pos.offset,pos.node,pos.offset);
        var rects = Range_getClientRects(range);

        if ((rects.length > 0) && !rectIsEmpty(rects[0])) {
            return rects[0];
        }

        if (isParagraphNode(pos.node) && (pos.offset == 0)) {
            var rect = pos.node.getBoundingClientRect();
            if (!rectIsEmpty(rect))
                return rect;
        }

        return null;
    });

    Position_displayRectAtPos = trace(function displayRectAtPos(pos)
    {
        var node = pos.node;
        var offset = pos.offset;

        if (node.nodeType == Node.ELEMENT_NODE) {
            if (offset > node.childNodes.length)
                throw new Error("Invalid offset: "+offset+" of "+node.childNodes.length);

            // Cursor is immediately before table -> return table rect
            if ((offset > 0) && isSpecialBlockNode(node.childNodes[offset-1])) {
                var rect = node.childNodes[offset-1].getBoundingClientRect();
                return { left: rect.right, // 0 width
                         right: rect.right,
                         top: rect.top,
                         bottom: rect.bottom,
                         width: 0,
                         height: rect.height };
            }
            // Cursor is immediately after table -> return table rect
            else if ((offset < node.childNodes.length) &&
                     isSpecialBlockNode(node.childNodes[offset])) {
                var rect = node.childNodes[offset].getBoundingClientRect();
                return { left: rect.left,
                         right: rect.left, // 0 width
                         top: rect.top,
                         bottom: rect.bottom,
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
            var rects = Range_getClientRects(range);
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
            var rects = Range_getClientRects(range);
            if ((rects == null) || (rects.length == 0))
                return null;
            var rect = rects[0];
            return { left: rect.left,
                     top: rect.top,
                     width: 0,
                     height: rect.height };
        }
    });

    Position_equal = trace(function equal(a,b)
    {
        if ((a == null) && (b == null))
            return true;
        if ((a != null) && (b != null) &&
            (a.node == b.node) && (a.offset == b.offset))
            return true;
        return false;
    });

    Position_preferTextPosition = trace(function preferTextPosition(pos)
    {
        var node = pos.node;
        var offset = pos.offset;
        if (node.nodeType == Node.ELEMENT_NODE) {
            var before = node.childNodes[offset-1];
            var after = node.childNodes[offset];
            if ((before != null) && (before.nodeType == Node.TEXT_NODE))
                return new Position(before,before.nodeValue.length);
            if ((after != null) && (after.nodeType == Node.TEXT_NODE))
                return new Position(after,0);
        }
        return pos;
    });

    Position_preferElementPosition = trace(function preferElementPosition(pos)
    {
        if (pos.node.nodeType == Node.TEXT_NODE) {
            if (pos.node.parentNode == null)
                throw new Error("Position "+pos+" has no parent node");
            if (pos.offset == 0)
                return new Position(pos.node.parentNode,DOM_nodeOffset(pos.node));
            if (pos.offset == pos.node.nodeValue.length)
                return new Position(pos.node.parentNode,DOM_nodeOffset(pos.node)+1);
        }
        return pos;
    });

    Position_compare = trace(function compare(first,second)
    {
        if ((first.node == second.node) && (first.offset == second.offset))
            return 0;

        var doc = first.node.ownerDocument;
        if ((first.node.parentNode == null) && (first.node != doc.documentElement))
            throw new Error("First node has been removed from document");
        if ((second.node.parentNode == null) && (second.node != doc.documentElement))
            throw new Error("Second node has been removed from document");

        if ((first.node == second.node) && (first.node.nodeType == Node.TEXT_NODE)) {
            if (first.offset <= second.offset)
                return -1;
            else
                return 1;
        }

        var firstParent = null;
        var firstChild = null;
        var secondParent = null;
        var secondChild = null;

        if (second.node.nodeType == Node.ELEMENT_NODE) {
            secondParent = second.node;
            secondChild = second.node.childNodes[second.offset];
        }
        else {
            secondParent = second.node.parentNode;
            secondChild = second.node;
        }

        if (first.node.nodeType == Node.ELEMENT_NODE) {
            firstParent = first.node;
            firstChild = first.node.childNodes[first.offset];
        }
        else {
            firstParent = first.node.parentNode;
            firstChild = first.node;
            if (firstChild == secondChild)
                return 1;
        }

        var firstC = firstChild;
        var firstP = firstParent;
        while (firstP != null) {

            var secondC = secondChild;
            var secondP = secondParent;
            while (secondP != null) {

                if (firstP == secondC)
                    return 1;

                if (firstP == secondP) {
                    // if secondC is last child, firstC must be secondC or come before it
                    if (secondC == null) 
                        return -1;
                    for (var n = firstC; n != null; n = n.nextSibling) {
                        if (n == secondC)
                            return -1;
                    }
                    return 1;
                }

                secondC = secondP;
                secondP = secondP.parentNode;
            }

            firstC = firstP;
            firstP = firstP.parentNode;
        }
        throw new Error("Could not find common ancestor");
    });


    // This function works around a bug in WebKit where caretRangeFromPoint sometimes returns an
    // incorrect node (the last text node in the document). In a previous attempt to fix this bug,
    // we first checked if the point was in the elements bounding rect, but this meant that it
    // wasn't possible to place the cursor at the nearest node, if the click location was not
    // exactly on a node.

    // Now we instead check to see if the result of elementFromPoint is the same as the parent node
    // of the text node returned by caretRangeFromPoint. If it isn't, then we assume that the latter
    // result is incorrect, and return null.

    // In the circumstances where this bug was observed, the last text node in the document was
    // being returned from caretRangeFromPoint in some cases. In the typical case, this is going to
    // be inside a paragraph node, but elementNodeFromPoint was returning the body element. The
    // check we do now comparing the results of the two functions fixes this case, but won't work as
    // intended if the document's last text node is a direct child of the body (as it may be in some
    // HTML documents that users open).

    Position_atPoint = trace(function atPoint(x,y)
    {
        // In general, we can use document.caretRangeFromPoint(x,y) to determine the location of the
        // cursor based on screen coordinates. However, this doesn't work if the screen coordinates
        // are outside the bounding box of the document's body. So when this is true, we find either
        // the first or last non-whitespace text node, calculate a y value that is half-way between
        // the top and bottom of its first or last rect (respectively), and then make a call to
        // caretRangeFromPoint with the same x value but this new y value. This results in the
        // cursor being placed on the first or last line when the user taps outside the document
        // bounds.

        var bodyRect = document.body.getBoundingClientRect();
        var boundaryRect = null;
        if (y <= bodyRect.top)
            boundaryRect = findFirstTextRect();
        else if (y >= bodyRect.bottom) 
            boundaryRect = findLastTextRect();

        if (boundaryRect != null) {
            var boundaryY = boundaryRect.top + boundaryRect.height/2;
            var range = document.caretRangeFromPoint(x,boundaryY);
            if (range != null)
                return new Position(range.startContainer,range.startOffset);
        }

        // We get here if the coordinates are inside the document's bounding rect, or if getting the
        // position from the first or last rect failed for some reason.

        var range = document.caretRangeFromPoint(x,y);
        if (range == null)
            return null;

        var pos = new Position(range.startContainer,range.startOffset);

        if (pos.node.nodeType == Node.ELEMENT_NODE) {
            var prev = pos.node.childNodes[pos.offset-1];
            var next = pos.node.childNodes[pos.offset];

            if ((prev != null) && isImageNode(prev) && elementContainsPoint(prev,x,y))
                return new Position(prev,0);

            if ((next != null) && isImageNode(next) && elementContainsPoint(next,x,y))
                return new Position(next,0);
        }

        pos = adjustPositionForFigure(pos);

        return pos;
    });

    var elementContainsPoint = trace(function elementContainsPoint(element,x,y)
    {
        var rect = element.getBoundingClientRect();
        return ((x >= rect.left) && (x <= rect.right) &&
                (y >= rect.top) && (y <= rect.bottom));
    });

    var findLastTextRect = trace(function findLastTextRect()
    {
        var node = lastDescendant(document.body);

        while ((node != null) && ((node.nodeType != Node.TEXT_NODE) || isWhitespaceTextNode(node)))
            node = prevNode(node);
        
        if (node != null) {
            var domRange = document.createRange();
            domRange.setStart(node,0);
            domRange.setEnd(node,node.nodeValue.length);
            var rects = domRange.getClientRects();
            if ((rects != null) && (rects.length > 0))
                return rects[rects.length-1];
        }
        return null;
    });

    var findFirstTextRect = trace(function findFirstTextRect()
    {
        var node = firstDescendant(document.body);

        while ((node != null) && ((node.nodeType != Node.TEXT_NODE) || isWhitespaceTextNode(node)))
            node = nextNode(node);
        
        if (node != null) {
            var domRange = document.createRange();
            domRange.setStart(node,0);
            domRange.setEnd(node,node.nodeValue.length);
            var rects = domRange.getClientRects();
            if ((rects != null) && (rects.length > 0))
                return rects[0];
        }
        return null;
    });

    var adjustPositionForFigure = trace(function adjustPositionForFigure(position)
    {
        if (position == null)
            return null;
        if (DOM_upperName(position.node) == "FIGURE") {
            var prev = position.node.childNodes[position.offset-1];
            var next = position.node.childNodes[position.offset];
            if ((prev != null) && isImageNode(prev)) {
                position = new Position(position.node.parentNode,
                                        DOM_nodeOffset(position.node)+1);
            }
            else if ((next != null) && isImageNode(next)) {
                position = new Position(position.node.parentNode,
                                        DOM_nodeOffset(position.node));
            }
        }
        return position;
    });

})();
