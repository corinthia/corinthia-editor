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

Range.prototype = {
    selectWholeWords: function()
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
    },

    omitEmptyTextSelection: function()
    {
        this.start.moveForwardIfAtEnd();
        this.end.moveBackwardIfAtStart();
    },

    isForwards: function()
    {
        if (this.start.node == this.end.node)
            return (this.start.offset < this.end.offset);
        else
            return (this.start.node.compareDocumentPosition(this.end.node) ==
                    Node.DOCUMENT_POSITION_FOLLOWING);
    },

    getParagraphNodes: function()
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
    },

    getInlineNodes: function()
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
    },

    getAllNodes: function()
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
    },

    setSelection: function()
    {
        window.getSelection().setBaseAndExtent(this.start.node,
                                               this.start.offset,
                                               this.end.node,
                                               this.end.offset);
    },

    ensureRangeValidHierarchy: function()
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
}
