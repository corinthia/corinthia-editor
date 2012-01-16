function Range(start,end)
{
    this.start = start;
    this.end = end;
}

Range.fromSelection = function()
{
    var selection = window.getSelection();

    if (selection.rangeCount == 0)
        return null;

    var r = selection.getRangeAt(0);

    return new Range(new Position(r.startContainer,r.startOffset),
                     new Position(r.endContainer,r.endOffset));
}

Range.prototype.selectWholeWords = function()
{
    if ((this.start.node.nodeType == Node.TEXT_NODE) &&
        (this.end.node.nodeType == Node.TEXT_NODE)) {
        if (this.isForwards()) {
            // this.start comes before this.end
            this.start.moveToStartOfWord();
            this.end.moveToEndOfWord();
        }
        else {
            // this.end comes before this.end
            this.start.moveToEndOfWord();
            this.end.moveToStartOfWord();
        }
    }
}

Range.prototype.omitEmptyTextSelection = function()
{
    this.start.moveForwardIfAtEnd();
    this.end.moveBackwardIfAtStart();
}

Range.prototype.isForwards = function()
{
    if (this.start.node == this.end.node)
        return (this.start.offset < this.end.offset);
    else
        return (this.start.node.compareDocumentPosition(this.end.node) ==
                Node.DOCUMENT_POSITION_FOLLOWING);
}

Range.prototype.getParagraphNodes = function()
{
    var result = new Array();
    var node = this.start.node;
    while (!isParagraphNode(node))
        node = node.parentNode;
    while (true) {
        if (isParagraphNode(node))
            result.push(node);
        if (node == this.end.node)
            break;
        node = nextNode(node);
    }
    return result;
}

Range.prototype.getInlineNodes = function()
{
    var result = new Array();
    var node = this.start.node;
    while (true) {
        if (isInlineNode(node)) {
            debug("getInlineNodes: "+node.nodeName+" is inline");
            result.push(node);
        }
        else {
            debug("getInlineNodes: "+node.nodeName+" is NOT inline");
        }
        if (node == this.end.node)
            break;
        node = nextNode(node);
    }
    return result;
}

Range.prototype.getAllNodes = function()
{
    var result = new Array();
    var node = this.start.node;
    while (true) {
        result.push(node);
        if (node == this.end.node)
            break;
        node = nextNode(node);
    }
    return result;
}

Range.prototype.setSelection = function()
{
    window.getSelection().setBaseAndExtent(this.start.node,
                                           this.start.offset,
                                           this.end.node,
                                           this.end.offset);
}

Range.prototype.ensureRangeValidHierarchy = function()
{
    var nodes = this.getAllNodes();
    
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
                if (!isInlineNode(node.parentNode) && isWhitespaceTextNode(node)) {
                    node.parentNode.removeChild(node);
                }
                else {
                    ensureValidHierarchy(node,firstDepth);
                }
            }
            firstDepth = false;
        }
    }
}

Range.prototype.getSelectedNodes = function()
{
    var result = new Array();

    var startNode = this.start.node;
    var startOffset = this.start.offset;
    var endNode = this.end.node;
    var endOffset = this.end.offset;

    // If the end node is contained within the start node, change the start node to the first
    // node in document order that is not an ancestor of the end node
    while (isAncestor(startNode,endNode) &&
           (startNode != endNode) &&
           (startNode.firstChild != null)) {
        startNode = startNode.firstChild;
    }

    if (startNode == endNode) {
        result.push(startNode);
        return result;
    }

    // Find common ancestor
    var common = null;
    var startAncestor = null;
    var endAncestor = null;
    for (var startA = startNode; startA != null; startA = startA.parentNode) {
        for (var endA = endNode; endA != null; endA = endA.parentNode) {
            if ((startA.parentNode != null) && (startA.parentNode == endA.parentNode)) {
                startAncestor = startA;
                endAncestor = endA;
                common = startA.parentNode;
                break;
            }
        }
        if (common != null)
            break;
    }

    if (common == null)
        return result;

    var top = startNode;
    do {
        result.push(top);
        while ((top.nextSibling == null) && (top.parentNode != common))
            top = top.parentNode;
        if (top.parentNode != common)
            top = top.nextSibling;
    } while (top.parentNode != common);
    
    for (var middle = startAncestor.nextSibling;
         (middle != null) && (middle != endAncestor);
         middle = middle.nextSibling) {
        result.push(middle);
    }

    var bottom = endNode;
    do {
        result.push(bottom);
        while ((bottom.previousSibling == null) && (bottom.parentNode != common))
            bottom = bottom.parentNode;
        if (bottom.parentNode != bottom)
            bottom = bottom.previousSibling;
    } while (bottom.parentNode != common);

    return result;

    function isAncestor(ancestor,descendant)
    {
        while ((descendant != null) && (descendant != ancestor))
            descendant = descendant.parentNode;
        return (descendant == ancestor);
    }
}

Range.prototype.getClientRects = function()
{
    if (!this.isForwards())
        return new Array();

    var nodes = this.getSelectedNodes();

    // WebKit in iOS 5.0 has a bug where if the selection spans multiple paragraphs, the complete
    // rect for paragraphs other than the first is returned, instead of just the portions of it
    // that are actually in the range. To get around this problem, we go through each text node
    // individually and collect all the rects.
    var result = new Array();
    var domRange = document.createRange();
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
