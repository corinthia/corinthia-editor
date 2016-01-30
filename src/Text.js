// This file is part of the Corinthia project (http://corinthia.io).
//
// See the COPYRIGHT.txt file distributed with this work for
// information regarding copyright ownership.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function(api) {

    var Text = api.Text; // export

    var DOM = api.DOM; // import
    var Paragraph = api.Paragraph; // import
    var Position = api.Position; // import
    var Traversal = api.Traversal; // import
    var Types = api.Types; // import
    var Util = api.Util; // import

    function ParagraphInfo(node,startOffset,endOffset,runs,text) {
        this.node = node;
        this.startOffset = startOffset;
        this.endOffset = endOffset;
        this.runs = runs;
        this.text = text;

        Object.defineProperty(this,"first",{
            get: function() { throw new Error("Attempt to access first property of Position") },
            set: function() {},
            enumerable: true });
        Object.defineProperty(this,"last",{
            get: function() { throw new Error("Attempt to access last property of Position") },
            set: function() {},
            enumerable: true });
    }

    function Run(node,start,end) {
        this.node = node;
        this.start = start;
        this.end = end;
    }

    // In this code, we represent a paragraph by its first and last node. Normally, this will be
    // the first and last child of a paragraph-level element (e.g. p or h1), but this scheme also
    // represent a sequence of inline nodes between two paragraph or container nodes, e.g.
    //
    // <p>...</p> Some <i>inline</i> nodes <p>...</p>

    Text.findParagraphBoundaries = function(pos) {
        Position.assertValid(pos);
        var startOffset = pos.offset;
        var endOffset = pos.offset;
        var node = pos.node;

        while (Types.isInlineNode(node)) {
            startOffset = DOM.nodeOffset(node);
            endOffset = DOM.nodeOffset(node)+1;
            node = node.parentNode;
        }

        if (node.nodeType != Node.ELEMENT_NODE)
            throw new Error("Not an element node: "+Util.nodeString(node));

        while ((startOffset > 0) && Types.isInlineNode(node.childNodes[startOffset-1]))
            startOffset--;
        while ((endOffset < node.childNodes.length) && Types.isInlineNode(node.childNodes[endOffset]))
            endOffset++;

        return { node: node, startOffset: startOffset, endOffset: endOffset };
    }

    Text.analyseParagraph = function(pos) {
        var initial = pos.node;
        var strings = new Array();
        var runs = new Array();
        var offset = 0;

        var boundaries = Text.findParagraphBoundaries(pos);
        if (boundaries == null)
            return null;

        for (var off = boundaries.startOffset; off < boundaries.endOffset; off++)
            recurse(boundaries.node.childNodes[off]);

        var text = strings.join("");

        return new ParagraphInfo(boundaries.node,boundaries.startOffset,boundaries.endOffset,runs,text);

        function recurse(node) {
            if (node.nodeType == Node.TEXT_NODE) {
                strings.push(node.nodeValue);
                var start = offset;
                var end = offset + node.nodeValue.length;
                runs.push(new Run(node,start,end));
                offset += node.nodeValue.length;
            }
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }

    Text.posAbove = function(pos,cursorRect,cursorX) {
        if (cursorX == null)
            cursorX = pos.targetX;
        pos = Position.closestMatchBackwards(pos,Position.okForMovement);
        if (cursorRect == null) {
            cursorRect = Position.rectAtPos(pos);
            if (cursorRect == null)
                return null;
        }

        if (cursorX == null) {
            cursorX = cursorRect.left;
        }

        while (true) {
            pos = Position.closestMatchBackwards(pos,Position.okForMovement);
            if (pos == null)
                return null;

            var paragraph = Text.analyseParagraph(pos);
            if (paragraph == null)
                return null;

            var rects = Paragraph.getRunOrFallbackRects(paragraph,pos);

            rects = rects.filter(function (rect) {
                return (rect.bottom <= cursorRect.top);
            });



            var bottom = findLowestBottom(rects);

            rects = rects.filter(function (rect) { return (rect.bottom == bottom); });

            // Scroll previous line into view, if necessary
            var top = findHighestTop(rects);
            if (top < 0) {
                var offset = -top;
                window.scrollBy(0,-offset);
                rects = offsetRects(rects,0,offset);
            }

            for (var i = 0; i < rects.length; i++) {
                if ((cursorX >= rects[i].left) && (cursorX <= rects[i].right)) {
                    var newPos = Position.atPoint(cursorX,rects[i].top + rects[i].height/2);
                    if (newPos != null) {
                        newPos = Position.closestMatchBackwards(newPos,Position.okForInsertion);
                        newPos.targetX = cursorX;
                        return newPos;
                    }
                }
            }

            var rightMost = findRightMostRect(rects);
            if (rightMost != null) {
                var newPos = Position.atPoint(rightMost.right,rightMost.top + rightMost.height/2);
                if (newPos != null) {
                    newPos = Position.closestMatchBackwards(newPos,Position.okForInsertion);
                    newPos.targetX = cursorX;
                    return newPos;
                }
            }


            pos = new Position.Position(paragraph.node,paragraph.startOffset);
            pos = Position.prevMatch(pos,Position.okForMovement);
        }
    }

    var findHighestTop = function(rects) {
        var top = null;
        for (var i = 0; i < rects.length; i++) {
            if ((top == null) || (top > rects[i].top))
                top = rects[i].top;
        }
        return top;
    }

    var findLowestBottom = function(rects) {
        var bottom = null;
        for (var i = 0; i < rects.length; i++) {
            if ((bottom == null) || (bottom < rects[i].bottom))
                bottom = rects[i].bottom;
        }
        return bottom;
    }

    var findRightMostRect = function(rects) {
        var rightMost = null;
        for (var i = 0; i < rects.length; i++) {
            if ((rightMost == null) || (rightMost.right < rects[i].right))
                rightMost = rects[i];
        }
        return rightMost;
    }

    var offsetRects = function(rects,offsetX,offsetY) {
        var result = new Array();
        for (var i = 0; i < rects.length; i++) {
            result.push({ top: rects[i].top + offsetY,
                          bottom: rects[i].bottom + offsetY,
                          left: rects[i].left + offsetX,
                          right: rects[i].right + offsetX,
                          width: rects[i].width,
                          height: rects[i].height });
        }
        return result;
    }

    Text.posBelow = function(pos,cursorRect,cursorX) {
        if (cursorX == null)
            cursorX = pos.targetX;
        pos = Position.closestMatchForwards(pos,Position.okForMovement);
        if (cursorRect == null) {
            cursorRect = Position.rectAtPos(pos);
            if (cursorRect == null)
                return null;
        }

        if (cursorX == null) {
            cursorX = cursorRect.left;
        }


        while (true) {
            pos = Position.closestMatchForwards(pos,Position.okForMovement);
            if (pos == null)
                return null;

            var paragraph = Text.analyseParagraph(pos);
            if (paragraph == null)
                return null;

            var rects = Paragraph.getRunOrFallbackRects(paragraph,pos);

            rects = rects.filter(function (rect) {
                return (rect.top >= cursorRect.bottom);
            });

            var top = findHighestTop(rects);

            rects = rects.filter(function (rect) { return (rect.top == top); });

            // Scroll next line into view, if necessary
            var bottom = findLowestBottom(rects);
            if (bottom > window.innerHeight) {
                var offset = window.innerHeight - bottom;
                window.scrollBy(0,-offset);
                rects = offsetRects(rects,0,offset);
            }

            for (var i = 0; i < rects.length; i++) {
                if ((cursorX >= rects[i].left) && (cursorX <= rects[i].right)) {
                    var newPos = Position.atPoint(cursorX,rects[i].top + rects[i].height/2);
                    if (newPos != null) {
                        newPos = Position.closestMatchForwards(newPos,Position.okForInsertion);
                        newPos.targetX = cursorX;
                        return newPos;
                    }
                }
            }

            var rightMost = findRightMostRect(rects);
            if (rightMost != null) {
                var newPos = Position.atPoint(rightMost.right,rightMost.top + rightMost.height/2);
                if (newPos != null) {
                    newPos = Position.closestMatchForwards(newPos,Position.okForInsertion);
                    newPos.targetX = cursorX;
                    return newPos;
                }
            }

            pos = new Position.Position(paragraph.node,paragraph.endOffset);
            pos = Position.nextMatch(pos,Position.okForMovement);
        }
    }

    Text.closestPosBackwards = function(pos) {
        if (Traversal.isNonWhitespaceTextNode(pos.node))
            return pos;
        var node;
        if ((pos.node.nodeType == Node.ELEMENT_NODE) && (pos.offset > 0)) {
            node = pos.node.childNodes[pos.offset-1];
            while (node.lastChild != null)
                node = node.lastChild;
        }
        else {
            node = pos.node;
        }
        while ((node != null) && (node != document.body) && !Traversal.isNonWhitespaceTextNode(node))
            node = Traversal.prevNode(node);

        if ((node == null) || (node == document.body))
            return null;
        else
            return new Position.Position(node,node.nodeValue.length);
    }

    Text.closestPosForwards = function(pos) {
        if (Traversal.isNonWhitespaceTextNode(pos.node))
            return pos;
        var node;
        if ((pos.node.nodeType == Node.ELEMENT_NODE) && (pos.offset < pos.node.childNodes.length)) {
            node = pos.node.childNodes[pos.offset];
            while (node.firstChild != null)
                node = node.firstChild;
        }
        else {
            node = Traversal.nextNodeAfter(pos.node);
        }
        while ((node != null) && !Traversal.isNonWhitespaceTextNode(node)) {
            var old = Util.nodeString(node);
            node = Traversal.nextNode(node);
        }

        if (node == null)
            return null;
        else
            return new Position.Position(node,0);
    }

    Text.closestPosInDirection = function(pos,direction) {
        if ((direction == "forward") ||
            (direction == "right") ||
            (direction == "down")) {
            return Text.closestPosForwards(pos);
        }
        else {
            return Text.closestPosBackwards(pos);
        }
    }

    function toStartOfParagraph(pos) {
        pos = Position.closestMatchBackwards(pos,Position.okForMovement);
        if (pos == null)
            return null;
        var paragraph = Text.analyseParagraph(pos);
        if (paragraph == null)
            return null;

        var newPos = new Position.Position(paragraph.node,paragraph.startOffset);
        return Position.closestMatchForwards(newPos,Position.okForMovement);
    }

    function toEndOfParagraph(pos) {
        pos = Position.closestMatchForwards(pos,Position.okForMovement);
        if (pos == null)
            return null;
        var paragraph = Text.analyseParagraph(pos);
        if (paragraph == null)
            return null;

        var newPos = new Position.Position(paragraph.node,paragraph.endOffset);
        return Position.closestMatchBackwards(newPos,Position.okForMovement);
    }

    function toStartOfLine(pos) {
        var posRect = Position.rectAtPos(pos);
        if (posRect == null) {
            pos = Text.closestPosBackwards(pos);
            posRect = Position.rectAtPos(pos);
            if (posRect == null) {
                return null;
            }
        }

        while (true) {
            var check = Position.prevMatch(pos,Position.okForMovement);
            var checkRect = Position.rectAtPos(check); // handles check == null case
            if (checkRect == null)
                return pos;
            if ((checkRect.bottom <= posRect.top) || (checkRect.top >= posRect.bottom))
                return pos;
            pos = check;
        }
    }

    function toEndOfLine(pos) {
        var posRect = Position.rectAtPos(pos);
        if (posRect == null) {
            pos = Text.closestPosForwards(pos);
            posRect = Position.rectAtPos(pos);
            if (posRect == null) {
                return null;
            }
        }

        while (true) {
            var check = Position.nextMatch(pos,Position.okForMovement);
            var checkRect = Position.rectAtPos(check); // handles check == null case
            if (checkRect == null)
                return pos;
            if ((checkRect.bottom <= posRect.top) || (checkRect.top >= posRect.bottom))
                return pos;
            pos = check;
        }
    }

    Text.toStartOfBoundary = function(pos,boundary) {
        if (boundary == "paragraph")
            return toStartOfParagraph(pos);
        else if (boundary == "line")
            return toStartOfLine(pos);
        else
            throw new Error("Unsupported boundary: "+boundary);
    }

    Text.toEndOfBoundary = function(pos,boundary) {
        if (boundary == "paragraph")
            return toEndOfParagraph(pos);
        else if (boundary == "line")
            return toEndOfLine(pos);
        else
            throw new Error("Unsupported boundary: "+boundary);
    }

})(globalAPI);
