function Position(node,offset)
{
    this.node = node;
    this.offset = offset;
    this.origOffset = offset;
}

Position.prototype = {
    moveToStartOfWord: function() {
        var text = this.node.nodeValue;
        this.offset = this.origOffset;
        while ((this.offset > 0) && isWordChar(text.charAt(this.offset-1)))
            this.offset--;
    },

    moveToEndOfWord: function() {
        var text = this.node.nodeValue;
        var length = text.length;
        this.offset = this.origOffset;
        while ((this.offset < length) && isWordChar(text.charAt(this.offset)))
            this.offset++;
    },

    moveForwardIfAtEnd: function() {
        if ((this.node.nodeType == Node.TEXT_NODE) &&
            (this.offset == this.node.nodeValue.length)) {
            var next = nextTextNode(this.node);
            if (next != null) {
                this.node = next;
                this.offset = 0;
                // debug("Moved start to "+this.toString()+"\n");
            }
        }
    },

    moveBackwardIfAtStart: function() {
        if ((this.node.nodeType == Node.TEXT_NODE) &&
            (this.offset == 0)) {
            var prev = prevTextNode(this.node);
            if (prev != null) {
                this.node = prev;
                this.offset = this.node.nodeValue.length;
                // debug("Moved end to "+this.toString()+"\n");
            }
        }
    },

    toString: function() {
        return this.node.nodeName+" \""+
               this.node.nodeValue+"\" offset "+
               this.offset;
    }
};
