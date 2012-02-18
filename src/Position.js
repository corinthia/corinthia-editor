// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function() {

    // public
    function Location(parent,child)
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
    function Position(node,offset)
    {
        Object.defineProperty(this,"self",{value: {}});
        var self = this.self;
        self.this = this;
        self.node = node;
        self.offset = offset;
        self.origOffset = offset;
        self.tracking = 0;
        self.insertionListener = null;
        self.removalListener = null;
        self.moving = false;

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

    Position.nodeBeingMoved = null; // FIXME: make this private
    var ignoreEvents = 0;
    Position.trackedPositions = new Array(); // FIXME: make this private

    function addTrackedPosition(self)
    {
        Position.trackedPositions.push(self.this);
    }

    function removeTrackedPosition(self)
    {
        for (var i = 0; i < Position.trackedPositions.length; i++) {
            if (Position.trackedPositions[i] == self.this) {
                Position.trackedPositions.splice(i,1);
                return;
            }
        }
        throw new Error("removeTrackedPosition: position not found");
    }

    function nodeInserted(self,event)
    {
        if (ignoreEvents > 0)
            return;

        if ((event.target == self.node) && self.moving) {
            setNodeAndOffset(self,event.relatedNode,getOffsetOfNodeInParent(event.target));
            self.moving = false;
        }
        else if (event.relatedNode == self.node) {
            var offset = getOffsetOfNodeInParent(event.target);
            if (offset < self.offset)
                self.offset++;
        }
    }

    function nodeWillBeRemoved(self,event)
    {
        if (ignoreEvents > 0)
            return;

        if (event.relatedNode == self.node) {
            var offset = getOffsetOfNodeInParent(event.target);
            if ((Position.nodeBeingMoved == event.target) && (offset == self.offset)) {
                setNodeAndOffset(self,event.target,0);
                self.moving = true;
            }
            else {
                if (offset < self.offset)
                    self.offset--;
            }
        }
        else if ((event.target == self.node) && (Position.nodeBeingMoved != event.target)) {
            var offset = getOffsetOfNodeInParent(event.target);
            setNodeAndOffset(self,self.node.parentNode,offset);
        }
    }

    function characterDataModified(self,event)
    {
        if (ignoreEvents > 0)
            return;

        if (event.target == self.node) {
            var oldOffset = self.offset;
            var prevValue = event.prevValue;
            var newValue = event.newValue;

            var commonStart = 0;
            var commonEnd = 0;

            while ((commonStart < prevValue.length) && (commonStart < newValue.length) &&
                   (prevValue.charCodeAt(commonStart) == newValue.charCodeAt(commonStart)))
                commonStart++;

            while ((commonEnd < prevValue.length) &&
                   (commonEnd < newValue.length) &&
                   (prevValue.charCodeAt(prevValue.length - commonEnd - 1) ==
                    newValue.charCodeAt(newValue.length - commonEnd - 1)))
                commonEnd++;

            var realCommonStart = commonStart;
            var realCommonEnd = commonEnd;

            if (realCommonStart > newValue.length - commonEnd)
                realCommonStart = newValue.length - commonEnd;
            if (realCommonStart > prevValue.length - commonEnd)
                realCommonStart = prevValue.length - commonEnd;

            if (realCommonEnd > newValue.length - commonStart)
                realCommonEnd = newValue.length - commonStart;
            if (realCommonEnd > prevValue.length - commonStart)
                realCommonEnd = prevValue.length - commonStart;

            commonStart = realCommonStart;
            commendEnd = realCommonEnd;

            var prevDifferent = prevValue.length - commonStart - commonEnd;
            var newDifferent = newValue.length - commonStart - commonEnd;

            if (newValue.length < prevValue.length) {
                if ((self.offset > commonStart + newDifferent) &&
                    (self.offset < commonStart + prevDifferent)) {
                    self.offset = commonStart + newDifferent;
                }
                else if (self.offset >= commonStart + prevDifferent) {
                    self.offset -= (prevDifferent - newDifferent);
                }
            }
            else if (newValue.length > prevValue.length) {
                if ((newDifferent > 0) && (prevDifferent > 0) &&
                    (self.offset >= prevValue.length - commonEnd))
                    self.offset = newValue.length - (prevValue.length - self.offset);
                else if (self.offset > commonStart + prevDifferent)
                    self.offset += (newDifferent - prevDifferent);
            }
        }
    }

    function actuallyStartTracking(self)
    {
        self.insertionListener = function (event) { nodeInserted(self,event); };
        self.removalListener = function (event) { nodeWillBeRemoved(self,event); };
        self.characterDataListener = function(event) { characterDataModified(self,event); }
        self.node.addEventListener("DOMNodeInserted",self.insertionListener,false);
        self.node.addEventListener("DOMNodeRemoved",self.removalListener,false);
        if (self.node.nodeType == Node.TEXT_NODE) {
            self.node.addEventListener("DOMCharacterDataModified",
                                       self.characterDataListener,false);
        }
    }

    function actuallyStopTracking(self)
    {
        self.node.removeEventListener("DOMNodeInserted",self.insertionListener,false);
        self.node.removeEventListener("DOMNodeRemoved",self.removalListener,false);
        if (self.node.nodeType == Node.TEXT_NODE) {
            self.node.removeEventListener("DOMCharacterDataModified",
                                          self.characterDataListener,false);
        }
        self.insertionListener = null;
        self.removalListener = null;
        self.characterDataListener = null;
    }

    function startTracking(self)
    {
        if (self.tracking == 0) {
            addTrackedPosition(self);
            actuallyStartTracking(self);
        }
        self.tracking++;
    }

    function stopTracking(self)
    {
        self.tracking--;
        if (self.tracking == 0) {
            actuallyStopTracking(self);
            removeTrackedPosition(self);
        }
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
    Position.prototype.moveToStartOfWord = function()
    {
        var self = this.self;
        var text = self.node.nodeValue;
        self.offset = self.origOffset;
        while ((self.offset > 0) && isWordChar(text.charAt(self.offset-1)))
            self.offset--;
    }

    // public
    Position.prototype.moveToEndOfWord = function()
    {
        var self = this.self;
        var text = self.node.nodeValue;
        var length = text.length;
        self.offset = self.origOffset;
        while ((self.offset < length) && isWordChar(text.charAt(self.offset)))
            self.offset++;
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
                offset = getOffsetOfNodeInParent(node)+1;
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
            offset = getOffsetOfNodeInParent(node);
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
        if (self.node.nodeType == Node.TEXT_NODE) {
            var extra = "";
            if (self.offset > self.node.nodeValue.length) {
                for (var i = self.node.nodeValue.length; i < self.offset; i++)
                    extra += "!";
            }
            var id = "";
            if (window.debugIds)
                id = self.node._nodeId.replace(/^.*:/,"")+":";
            return id+JSON.stringify(self.node.nodeValue.slice(0,self.offset)+extra+"|"+
                                     self.node.nodeValue.slice(self.offset));
        }
        else {
            return "("+nodeString(self.node)+","+self.offset+")";
        }
    }

    // public
    Position.prototype.prev = function()
    {
        if (this.node.nodeType == Node.ELEMENT_NODE) {
            if (this.offset == 0) {
                return upAndBack(this);
            }
            else {
                var child = this.node.childNodes[this.offset-1];
                return new Position(child,maxNodeOffset(child));
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
                return new Position(pos.node.parentNode,getOffsetOfNodeInParent(pos.node));
        }
    }

    // public
    Position.prototype.next = function()
    {
        if (this.node.nodeType == Node.ELEMENT_NODE) {
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
                return new Position(pos.node.parentNode,getOffsetOfNodeInParent(pos.node)+1);
        }
    }

    // public
    Position.trackWhileExecuting = function(positions,fun)
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
    }

    // public
    Position.ignoreEventsWhileExecuting = function(fun)
    {
        ignoreEvents++;
        try {
            return fun();
        }
        finally {
            ignoreEvents--;
        }
    }

    window.Location = Location;
    window.Position = Position;

})();
