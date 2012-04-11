// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Range;

(function() {

    Range = function(startNode,startOffset,endNode,endOffset)
    {
        this.start = new Position(startNode,startOffset);
        this.end = new Position(endNode,endOffset);
    }

    function copy()
    {
        return new Range(this.start.node,this.start.offset,
                         this.end.node,this.end.offset);
    }


    function isEmpty()
    {
        return ((this.start.node == this.end.node) &&
                (this.start.offset == this.end.offset));
    }

    Range.prototype.toString = function()
    {
        return this.start.toString() + " - " + this.end.toString();
    }

    function trackWhileExecuting(fun)
    {
        Position.trackWhileExecuting([this.start,this.end],fun);
    }

    function expand()
    {
        var doc = this.start.node.ownerDocument;
        while ((this.start.offset == 0) && (this.start.node != doc.body)) {
            var offset = DOM_nodeOffset(this.start.node);
            this.start.node = this.start.node.parentNode;
            this.start.offset = offset;
        }

        while ((this.end.offset == DOM_maxChildOffset(this.end.node)) &&
               (this.end.node != doc.body)) {
            var offset = DOM_nodeOffset(this.end.node);
            this.end.node = this.end.node.parentNode;
            this.end.offset = offset+1;
        }
    }

    function omitEmptyTextSelection()
    {
        if (!this.start.moveBackwardIfAtStart())
            this.start.moveForwardIfAtEnd()
        if (!this.end.moveBackwardIfAtStart())
            this.end.moveForwardIfAtEnd()
    }

    function isForwards()
    {
        var doc = this.start.node.ownerDocument;
        if ((this.start.node.parentNode == null) && (this.start.node != doc.documentElement))
            throw new Error("Range.isForwards "+this+": start node has been removed from document");
        if ((this.end.node.parentNode == null) && (this.end.node != doc.documentElement))
            throw new Error("Range.isForwards "+this+": end node has been removed from document");

        var start = this.start;
        var end = this.end;

        if ((start.node == end.node) && (start.node.nodeType == Node.TEXT_NODE))
            return (end.offset >= start.offset);

        var startParent = null;
        var startChild = null;
        var endParent = null;
        var endChild = null;

        if (end.node.nodeType == Node.ELEMENT_NODE) {
            endParent = end.node;
            endChild = end.node.childNodes[end.offset];
        }
        else {
            endParent = end.node.parentNode;
            endChild = end.node;
        }

        if (start.node.nodeType == Node.ELEMENT_NODE) {
            startParent = start.node;
            startChild = start.node.childNodes[start.offset];
        }
        else {
            startParent = start.node.parentNode;
            startChild = start.node;
            if (startChild == endChild)
                return false;
        }

        var startC = startChild;
        var startP = startParent;
        while (startP != null) {

            var endC = endChild;
            var endP = endParent;
            while (endP != null) {

                if (startP == endC)
                    return false;

                if (startP == endP) {
                    if (endC == null) // endC is last child, so startC must be endC or come before it
                        return true;
                    for (var n = startC; n != null; n = n.nextSibling) {
                        if (n == endC)
                            return true;
                    }
                    return false;
                }

                endC = endP;
                endP = endP.parentNode;
            }

            startC = startP;
            startP = startP.parentNode;
        }
        throw new Error("Could not find common ancestor");
    }

    function getInlineNodes(atLeastOne)
    {
        var all = this.getAllNodes(atLeastOne);
        var result = new Array();
        for (var i = 0; i < all.length; i++) {
            if (isInlineNode(all[i]))
                result.push(all[i]);
        }
        return result;
    }

    function getAllNodes(atLeastOne)
    {
        var result = new Array();
        var outermost = this.getOutermostNodes(atLeastOne);
        for (var i = 0; i < outermost.length; i++)
            addRecursive(outermost[i]);
        return result;

        function addRecursive(node)
        {
            result.push(node);
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                addRecursive(child);
        }
    }

    function singleNode()
    {
        return this.start.closestActualNode();
    }

    function ensureRangeValidHierarchy()
    {
        var range = this;
        this.trackWhileExecuting(function() {
            var nodes = range.getAllNodes(true);
            
            var depths = new Array();
            for (var i = 0; i < nodes.length; i++) {
                var depth = getNodeDepth(nodes[i]);
                if (depths[depth] == null) {
                    depths[depth] = new Array();
                }
                depths[depth].push(nodes[i]);
            }
            
            for (var depth = 0; depth < depths.length; depth++) {
                var firstDepth = true;
                if (depths[depth] != null) {
                    for (var i = 0; i < depths[depth].length; i++) {
                        var node = depths[depth][i];
                        Hierarchy_ensureValidHierarchy(node,firstDepth);
                    }
                    firstDepth = false;
                }
            }
        });
    };

    function forwards()
    {
        if (this.isForwards()) {
            return this;
        }
        else {
            var reverse = new Range(this.end.node,this.end.offset,this.start.node,this.start.offset);
            if (!reverse.isForwards())
                throw new Error("Both range "+this+" and its reverse are not forwards");
            return reverse;
        }
    }

    function detail()
    {
        if (!this.isForwards()) {
            var reverse = new Range(this.end.node,this.end.offset,this.start.node,this.start.offset);
            if (!reverse.isForwards())
                throw new Error("Both range "+this+" and its reverse are not forwards");
            return reverse.detail();
        }

        var detail = new Object();
        var start = this.start;
        var end = this.end;

        // Start location
        if (start.node.nodeType == Node.ELEMENT_NODE) {
            detail.startParent = start.node;
            detail.startChild = start.node.childNodes[start.offset];
        }
        else {
            detail.startParent = start.node.parentNode;
            detail.startChild = start.node;
        }

        // End location
        if (end.node.nodeType == Node.ELEMENT_NODE) {
            detail.endParent = end.node;
            detail.endChild = end.node.childNodes[end.offset];
        }
        else if (end.offset == 0) {
            detail.endParent = end.node.parentNode;
            detail.endChild = end.node;
        }
        else {
            detail.endParent = end.node.parentNode;
            detail.endChild = end.node.nextSibling;
        }

        // Common ancestor
        var startP = detail.startParent;
        var startC = detail.startChild;
        while (startP != null) {
            var endP = detail.endParent;
            var endC = detail.endChild
            while (endP != null) {
                if (startP == endP) {
                    detail.commonAncestor = startP;
                    detail.startAncestor = startC;
                    detail.endAncestor = endC;
                    // Found it
                    return detail;
                }
                endC = endP;
                endP = endP.parentNode;
            }
            startC = startP;
            startP = startP.parentNode;
        }
        throw new Error("Start and end of range have no common ancestor");
    }

    function getOutermostNodes(atLeastOne,info)
    {
        var beforeNodes = new Array();
        var middleNodes = new Array();
        var afterNodes = new Array();

        if (info != null) {
            info.beginning = beforeNodes;
            info.middle = middleNodes;
            info.end = afterNodes;
        }

        if (this.isEmpty())
            return atLeastOne ? [this.singleNode()] : [];

        // Note: start and end are *points* - they are always *in between* nodes or characters, never
        // *at* a node or character.
        // Everything after the end point is excluded from the selection
        // Everything after the start point, but before the end point, is included in the selection

        // We use (parent,child) pairs so that we have a way to represent a point that comes after all
        // the child nodes in a container - in which case the child is null. The parent, however, is
        // always non-null;

        var detail = this.detail();
        if (detail.commonAncestor == null)
            return atLeastOne ? [this.singleNode()] : [];
        var startParent = detail.startParent;
        var startChild = detail.startChild;
        var endParent = detail.endParent;
        var endChild = detail.endChild;
        var commonParent = detail.commonAncestor;
        var startAncestor = detail.startAncestor;
        var endAncestor = detail.endAncestor;

        // Add start nodes
        var topParent = startParent;
        var topChild = startChild;
        while (topParent != commonParent) {
            if (topChild != null)
                beforeNodes.push(topChild);

            while (((topChild == null) || (topChild.nextSibling == null)) &&
                   (topParent != commonParent)) {
                topChild = topParent;
                topParent = topParent.parentNode;
            }
            if (topParent != commonParent)
                topChild = topChild.nextSibling;
        }

        // Add middle nodes
        if (startAncestor != endAncestor) {
            var c = startAncestor;
            if ((c != null) && (c != startChild))
                c = c.nextSibling;
            for (; c != endAncestor; c = c.nextSibling)
                middleNodes.push(c);
        }

        // Add end nodes
        var bottomParent = endParent;
        var bottomChild = endChild;
        while (true) {

            while ((getPreviousSibling(bottomParent,bottomChild) == null) &&
                   (bottomParent != commonParent)) {
                bottomChild = bottomParent;
                bottomParent = bottomParent.parentNode;
            }
            if (bottomParent != commonParent)
                bottomChild = getPreviousSibling(bottomParent,bottomChild);

            if (bottomParent == commonParent)
                break;

            afterNodes.push(bottomChild);
        }
        afterNodes = afterNodes.reverse();

        var result = new Array();

        Array.prototype.push.apply(result,beforeNodes);
        Array.prototype.push.apply(result,middleNodes);
        Array.prototype.push.apply(result,afterNodes);

        if (result.length == 0)
            return atLeastOne ? [this.singleNode()] : [];
        else
            return result;

        function getPreviousSibling(parent,child)
        {
            if (child != null)
                return child.previousSibling;
            else if (parent.lastChild != null)
                return parent.lastChild;
            else
                return null;
        }

        function isAncestorLocation(ancestorParent,ancestorChild,
                                    descendantParent,descendantChild)
        {
            while ((descendantParent != null) &&
                   ((descendantParent != ancestorParent) || (descendantChild != ancestorChild))) {
                descendantChild = descendantParent;
                descendantParent = descendantParent.parentNode;
            }

            return ((descendantParent == ancestorParent) &&
                    (descendantChild == ancestorChild));
        }
    }

    function getClientRects()
    {
        var nodes = this.getOutermostNodes(true);

        // WebKit in iOS 5.0 has a bug where if the selection spans multiple paragraphs, the complete
        // rect for paragraphs other than the first is returned, instead of just the portions of it
        // that are actually in the range. To get around this problem, we go through each text node
        // individually and collect all the rects.
        var result = new Array();
        var doc = this.start.node.ownerDocument;
        var domRange = doc.createRange();
        for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
            var node = nodes[nodeIndex];
            if (node.nodeType == Node.TEXT_NODE) {
                var startOffset = (node == this.start.node) ? this.start.offset : 0;
                var endOffset = (node == this.end.node) ? this.end.offset : node.nodeValue.length;
                domRange.setStart(node,startOffset);
                domRange.setEnd(node,endOffset);
                var rects = domRange.getClientRects();
                for (var rectIndex = 0; rectIndex < rects.length; rectIndex++)
                    result.push(rects[rectIndex]);
            }
            else if (node.nodeType == Node.ELEMENT_NODE) {
                result.push(node.getBoundingClientRect());
            }
        }
        return result;
    }

    function cloneContents()
    {
        var cloneMap = new NodeMap();
        var detail = this.detail();
        var cloneRoot = DOM_cloneNode(detail.commonAncestor,false);
        cloneMap.put(detail.commonAncestor,cloneRoot);
        var outermost = this.getOutermostNodes();
        for (var i = 0; i < outermost.length; i++) {

            var node = outermost[i];
            if (node.nodeType == Node.TEXT_NODE) {
                // FIXME: do this without modifying nodeValue
                var saved = node.nodeValue;
                if ((node == this.start.node) && (node == this.end.node)) {
                    node.nodeValue = node.nodeValue.slice(this.start.offset,this.end.offset);
                }
                else if (node == this.start.node) {
                    node.nodeValue = node.nodeValue.slice(this.start.offset);
                }
                else if (node == this.end.node) {
                    node.nodeValue = node.nodeValue.slice(0,this.end.offset);
                }
                add(outermost[i],true);
                node.nodeValue = saved;
            }
            else {
                add(outermost[i],true);
            }
        }

        var result = new Array();
        for (var child = cloneRoot.firstChild; child != null; child = child.nextSibling)
            result.push(child);

        return result;

        function add(node,deep)
        {
            if (cloneMap.containsKey(node))
                return cloneMap.get(node);

            var clone = DOM_cloneNode(node,deep);
            cloneMap.put(node,clone);
            if (node.parentNode == detail.commonAncestor) {
                DOM_appendChild(cloneRoot,clone);
            }
            else {
                var parentClone = add(node.parentNode,false);
                DOM_appendChild(parentClone,clone);
            }
            return clone;
        }
    }

    Range.prototype.copy = trace(copy);
    Range.prototype.isEmpty = trace(isEmpty);
    Range.prototype.trackWhileExecuting = trace(trackWhileExecuting);
    Range.prototype.expand = trace(expand);
    Range.prototype.omitEmptyTextSelection = trace(omitEmptyTextSelection);
    Range.prototype.isForwards = trace(isForwards);
    Range.prototype.getInlineNodes = trace(getInlineNodes);
    Range.prototype.getAllNodes = trace(getAllNodes);
    Range.prototype.singleNode = trace(singleNode);
    Range.prototype.ensureRangeValidHierarchy = trace(ensureRangeValidHierarchy);
    Range.prototype.forwards = trace(forwards);
    Range.prototype.detail = trace(detail);
    Range.prototype.getOutermostNodes = trace(getOutermostNodes);
    Range.prototype.getClientRects = trace(getClientRects);
    Range.prototype.cloneContents = trace(cloneContents);

})();
