// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Location;
var Position;
var Position_trackWhileExecuting;
var Position_okForInsertion;
var Position_okForMovement;
var Position_prevMatch;
var Position_nextMatch;
var Position_closestMatchForwards;
var Position_closestMatchBackwards;
var Position_track;
var Position_untrack;
var Position_rectAtPos;
var Position_preferTextPosition;
var Position_preferElementPosition;
var Position_compare;

(function() {

    // public
    Location = function(parent,child)
    {
        this.parent = parent;
        this.child = child;
    }

    // public
    Location.prototype.toString = function()
    {
        return "("+nodeString(this.parent)+","+nodeString(this.child)+")";
    }

    // public
    Position = function(node,offset)
    {
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
    Position.prototype.moveForwardIfAtEnd = function()
    {
        var self = this.self;
        var node = self.node;
        var offset = self.offset;
        var changed = false;
        while (node != document.body) {
            if (((node.nodeType == Node.TEXT_NODE) && (offset == node.nodeValue.length)) ||
                ((node.nodeType == Node.ELEMENT_NODE) && (offset == node.childNodes.length))) {
                offset = DOM_nodeOffset(node)+1;
                node = node.parentNode;
                changed = true;
            }
            else {
                break;
            }
        }
        if (changed)
            setNodeAndOffset(self,node,offset);
        return changed;
    }

    // public
    Position.prototype.moveBackwardIfAtStart = function()
    {
        var self = this.self;
        var node = self.node;
        var offset = self.offset;
        var changed = false;
        while ((node != document.body) && (offset == 0)) {
            offset = DOM_nodeOffset(node);
            node = node.parentNode;
            changed = true;
        }
        if (changed)
            setNodeAndOffset(self,node,offset);
        return changed;
    }

    // public
    Position.prototype.toLocation = function()
    {
        var self = this.self;
        if ((self.node.nodeType == Node.ELEMENT_NODE) && (self.node.firstChild != null)) {
            if (self.offset >= self.node.childNodes.length)
                return new Location(self.node,null);
            else
                return new Location(self.node,self.node.childNodes[self.offset]);
        }
        else {
            return new Location(self.node.parentNode,self.node);
        }
    }

    // public
    Position.prototype.toDefinitePosition = function()
    {
        var self = this.self;
        if (self.node.nodeType == Node.ELEMENT_NODE) {
            if (self.offset < self.node.childNodes.length)
                return new Position(self.node.childNodes[self.offset],0);
            var nextNode = nextNodeAfter(self.node);
            if (nextNode != null)
                return new Position(nextNode,0);
            else
                return null;
        }
        else {
            return new Position(self.node,self.offset);
        }
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
    Position.prototype.prev = function()
    {
        if (this.node.nodeType == Node.ELEMENT_NODE) {
            var r = positionSpecial(this,false,true);
            if (r != null)
                return r;
            if (this.offset == 0) {
                return upAndBack(this);
            }
            else {
                var child = this.node.childNodes[this.offset-1];
                return new Position(child,DOM_maxChildOffset(child));
            }
        }
        else if (this.node.nodeType == Node.TEXT_NODE) {
            if (this.offset > 0)
                return new Position(this.node,this.offset-1);
            else
                return upAndBack(this);
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
    }

    // public
    Position.prototype.next = function()
    {
        if (this.node.nodeType == Node.ELEMENT_NODE) {
            var r = positionSpecial(this,true,false);
            if (r != null)
                return r;
            if (this.offset == this.node.childNodes.length)
                return upAndForwards(this);
            else
                return new Position(this.node.childNodes[this.offset],0);
        }
        else if (this.node.nodeType == Node.TEXT_NODE) {
            if (this.offset < this.node.nodeValue.length)
                return new Position(this.node,this.offset+1);
            else
                return upAndForwards(this);
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
    }

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
    Position.prototype.closestActualNode = function(preferElement)
    {
        var node = this.node;
        var offset = this.offset;
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
    }

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

        for (var ancestor = node; ancestor != document.body; ancestor = ancestor.parentNode) {
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
            pos = pos.prev();
        } while ((pos != null) && !fun(pos));
        return pos;
    });

    Position_nextMatch = trace(function nextCursorPosition(pos,fun)
    {
        do {
            pos = pos.next();
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

})();
