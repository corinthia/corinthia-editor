// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Location;
var Position;

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
    Position.prototype.closestActualNode = function()
    {
        var node = this.node;
        var offset = this.offset;
        if ((node.nodeType != Node.ELEMENT_NODE) || (node.firstChild == null))
            return node;
        else if (offset >= node.childNodes.length)
            return node.lastChild;
        else
            return node.childNodes[offset];
    }

    Location = Location;
    Position = Position;

})();
