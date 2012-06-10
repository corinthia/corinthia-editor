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

    function ensureRangeInlineNodesInParagraph()
    {
        var range = this;
        this.trackWhileExecuting(function() {
            var nodes = range.getAllNodes(true);
            for (var i = 0; i < nodes.length; i++)
                Hierarchy_ensureInlineNodesInParagraph(nodes[i]);
        });
    }

    function ensureRangeValidHierarchy(allowDirectInline)
    {
        var range = this;
        this.trackWhileExecuting(function() {
            var nodes = range.getAllNodes(true);
            for (var i = 0; i < nodes.length; i++)
                Hierarchy_ensureValidHierarchy(nodes[i],true,allowDirectInline);
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

        // WebKit in iOS 5.0 and 5.1 has a bug where if the selection spans multiple paragraphs,
        // the complete rect for paragraphs other than the first is returned, instead of just the
        // portions of it that are actually in the range. To get around this problem, we go through
        // each text node individually and collect all the rects.
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
        var nodeSet = new NodeSet();
        var ancestorSet = new NodeSet();
        var detail = this.detail();
        var outermost = this.getOutermostNodes();
        var range = this;

        for (var i = 0; i < outermost.length; i++) {
            nodeSet.add(outermost[i]);
            for (var node = outermost[i]; node != null; node = node.parentNode)
                ancestorSet.add(node);
        }

        var clone = recurse(detail.commonAncestor);

        var ancestor = detail.commonAncestor;
        while (isInlineNode(ancestor)) {
            var ancestorClone = DOM_cloneNode(ancestor.parentNode,false);
            DOM_appendChild(ancestorClone,clone);
            ancestor = ancestor.parentNode;
            clone = ancestorClone;
        }

        var childArray = new Array();
        for (var child = clone.firstChild; child != null; child = child.nextSibling)
            childArray.push(child);
        Formatting_pushDownInlineProperties(childArray);

        return childArray;

        function recurse(parent)
        {
            var clone = DOM_cloneNode(parent,false);
            for (var child = parent.firstChild; child != null; child = child.nextSibling) {
                if (nodeSet.contains(child)) {
                    if ((child.nodeType == Node.TEXT_NODE) &&
                        (child == range.start.node) &&
                        (child == range.end.node)) {
                        var substring = child.nodeValue.substring(range.start.offset,
                                                                  range.end.offset);
                        DOM_appendChild(clone,DOM_createTextNode(document,substring));
                    }
                    else if ((child.nodeType == Node.TEXT_NODE) &&
                             (child == range.start.node)) {
                        var substring = child.nodeValue.substring(range.start.offset);
                        DOM_appendChild(clone,DOM_createTextNode(document,substring));
                    }
                    else if ((child.nodeType == Node.TEXT_NODE) &&
                             (child == range.end.node)) {
                        var substring = child.nodeValue.substring(0,range.end.offset);
                        DOM_appendChild(clone,DOM_createTextNode(document,substring));
                    }
                    else {
                        DOM_appendChild(clone,DOM_cloneNode(child,true));
                    }
                }
                else if (ancestorSet.contains(child)) {
                    DOM_appendChild(clone,recurse(child));
                }
            }
            return clone;
        }
    }

    function hasContent()
    {
        var start = this.start;
        var end = this.end;

        var outermost = this.getOutermostNodes();
        for (var i = 0; i < outermost.length; i++) {

            if ((outermost[i].nodeType == Node.TEXT_NODE) && (outermost == start.node)) {
                if (!isWhitespaceString(start.node.nodeValue.substring(start.offset)))
                    return true;
            }
            else if ((outermost[i].nodeType == Node.TEXT_NODE) && (outermost == end.node)) {
                if (!isWhitespaceString(end.node.nodeValue.substring(0,end.node.offset)))
                    return true;
            }
            else {
                if (nodeHasContent(outermost[i]))
                    return true;
            }
        }

        return false;
    }

    function findMatchingNodes(predicate)
    {
        var resultArray = new Array();
        var resultSet = new NodeSet();
        var all = this.getAllNodes();
        for (var i = 0; i < all.length; i++)
            recurse(all[i]);
        return resultArray;

        // Process parents before children, ensuring nodes are in document order
        function recurse(node)
        {
            if (node == null)
                return;
            recurse(node.parentNode);
            if (!resultSet.contains(node) && predicate(node)) {
                resultArray.push(node);
                resultSet.add(node);
            }
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
    Range.prototype.ensureRangeInlineNodesInParagraph = trace(ensureRangeInlineNodesInParagraph);
    Range.prototype.ensureRangeValidHierarchy = trace(ensureRangeValidHierarchy);
    Range.prototype.forwards = trace(forwards);
    Range.prototype.detail = trace(detail);
    Range.prototype.getOutermostNodes = trace(getOutermostNodes);
    Range.prototype.getClientRects = trace(getClientRects);
    Range.prototype.cloneContents = trace(cloneContents);
    Range.prototype.hasContent = trace(hasContent);
    Range.prototype.findMatchingNodes = trace(findMatchingNodes);

})();
