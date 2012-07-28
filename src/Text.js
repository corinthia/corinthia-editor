// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Text_findParagraphBoundaries;
var Text_analyseParagraph;
var Text_posAbove;
var Text_posBelow;
var Text_closestPosBackwards;
var Text_closestPosForwards;
var Text_closestPosInDirection;

var Paragraph_runFromOffset;
var Paragraph_runFromNode;
var Paragraph_positionAtOffset;
var Paragraph_offsetAtPosition;
var Paragraph_getRunRects;
var Paragraph_getRunOrFallbackRects;

var Text_toStartOfBoundary;
var Text_toEndOfBoundary;

(function() {

    function Paragraph(node,startOffset,endOffset,runs,text)
    {
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

    function Run(node,start,end)
    {
        this.node = node;
        this.start = start;
        this.end = end;
    }

    // In this code, we represent a paragraph by its first and last node. Normally, this will be
    // the first and last child of a paragraph-level element (e.g. p or h1), but this scheme also
    // represent a sequence of inline nodes between two paragraph or container nodes, e.g.
    //
    // <p>...</p> Some <i>inline</i> nodes <p>...</p>

    Text_findParagraphBoundaries = trace(function findParagraphBoundaries(pos)
    {
        var startOffset = pos.offset;
        var endOffset = pos.offset;
        var node = pos.node;

        while (isInlineNode(node)) {
            startOffset = DOM_nodeOffset(node);
            endOffset = DOM_nodeOffset(node)+1;
            node = node.parentNode;
        }

        if (node.nodeType != Node.ELEMENT_NODE)
            throw new Error("Not an element node: "+nodeString(node));

        while ((startOffset > 0) && isInlineNode(node.childNodes[startOffset-1]))
            startOffset--;
        while ((endOffset < node.childNodes.length) && isInlineNode(node.childNodes[endOffset]))
            endOffset++;

        return { node: node, startOffset: startOffset, endOffset: endOffset };
    });

    Text_analyseParagraph = trace(function analyseParagraph(pos)
    {
        var initial = pos.node;
        var strings = new Array();
        var runs = new Array();
        var offset = 0;

        var boundaries = Text_findParagraphBoundaries(pos);
        if (boundaries == null)
            return null;

        for (var off = boundaries.startOffset; off < boundaries.endOffset; off++)
            recurse(boundaries.node.childNodes[off]);

        var text = strings.join("");

        return new Paragraph(boundaries.node,boundaries.startOffset,boundaries.endOffset,runs,text);

        function recurse(node)
        {
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
    });

    Text_posAbove = trace(function posAbove(pos,cursorRect,cursorX)
    {
        if (cursorX == null)
            cursorX = pos.targetX;
        pos = Position_closestMatchBackwards(pos,Position_okForMovement);
        if (cursorRect == null) {
            cursorRect = Position_rectAtPos(pos);
            if (cursorRect == null)
                return null;
        }

        if (cursorX == null) {
            cursorX = cursorRect.left;
        }

        while (true) {
            pos = Position_closestMatchBackwards(pos,Position_okForMovement);
            if (pos == null)
                return null;

            var paragraph = Text_analyseParagraph(pos);
            if (paragraph == null)
                return null;

            var rects = Paragraph_getRunOrFallbackRects(paragraph,pos);

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
                    var newPos = positionAtPoint(cursorX,rects[i].top + rects[i].height/2);
                    if (newPos != null) {
                        newPos = Position_closestMatchBackwards(newPos,Position_okForInsertion);
                        newPos.targetX = cursorX;
                        return newPos;
                    }
                }
            }

            var rightMost = findRightMostRect(rects);
            if (rightMost != null) {
                var newPos = positionAtPoint(rightMost.right,rightMost.top + rightMost.height/2);
                if (newPos != null) {
                    newPos = Position_closestMatchBackwards(newPos,Position_okForInsertion);
                    newPos.targetX = cursorX;
                    return newPos;
                }
            }


            pos = new Position(paragraph.node,paragraph.startOffset);
            pos = Position_prevMatch(pos,Position_okForMovement);
        }
    });

    var findHighestTop = trace(function findHighestTop(rects)
    {
        var top = null;
        for (var i = 0; i < rects.length; i++) {
            if ((top == null) || (top > rects[i].top))
                top = rects[i].top;
        }
        return top;
    });

    var findLowestBottom = trace(function findLowestBottom(rects)
    {
        var bottom = null;
        for (var i = 0; i < rects.length; i++) {
            if ((bottom == null) || (bottom < rects[i].bottom))
                bottom = rects[i].bottom;
        }
        return bottom;
    });

    var findRightMostRect = trace(function findRightMost(rects)
    {
        var rightMost = null;
        for (var i = 0; i < rects.length; i++) {
            if ((rightMost == null) || (rightMost.right < rects[i].right))
                rightMost = rects[i];
        }
        return rightMost;
    });

    var offsetRects = trace(function offsetRects(rects,offsetX,offsetY)
    {
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
    });

    // FIXME: temp: for debugging purposes
/*
    var addRect = trace(function addRect(rect,color)
    {
        if (color == null)
            color = "blue";
        var div = DOM_createElement(document,"DIV");
        div.style.position = "absolute";
        div.style.left = rect.left+"px";
        div.style.top = rect.top+"px";
        if (rect.width != null)
            div.style.width = rect.width+"px";
        if (rect.height != null)
            div.style.height = rect.height+"px";
        div.style.borderWidth = 2;
        div.style.borderColor = color;
        div.style.borderStyle = "solid";
        DOM_appendChild(document.body,div);
        return div;
    });

    var addRectWithAnnotation = trace(function addRectWithAnnotation(rect,annotation,color)
    {
        addRect(rect,color);
        var annotationRect = {
            left: rect.right + 10,
            top: rect.top,
            width: 50,
        };
        var annotationDiv = addRect(annotationRect,"black");
        var textNode = DOM_createTextNode(document,annotation);
        annotationDiv.style.fontFamily = "sans-serif";
        annotationDiv.style.fontSize = "8pt";
        annotationDiv.style.fontWeight = "bold";
        annotationDiv.style.backgroundColor = "#f0f0f0";
        DOM_appendChild(annotationDiv,textNode);
    });
*/

    Text_posBelow = trace(function posBelow(pos,cursorRect,cursorX)
    {
        if (cursorX == null)
            cursorX = pos.targetX;
        pos = Position_closestMatchForwards(pos,Position_okForMovement);
        if (cursorRect == null) {
            cursorRect = Position_rectAtPos(pos);
            if (cursorRect == null)
                return null;
        }

        if (cursorX == null) {
            cursorX = cursorRect.left;
        }


        while (true) {
            pos = Position_closestMatchForwards(pos,Position_okForMovement);
            if (pos == null)
                return null;

            var paragraph = Text_analyseParagraph(pos);
            if (paragraph == null)
                return null;

            var rects = Paragraph_getRunOrFallbackRects(paragraph,pos);

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
                    var newPos = positionAtPoint(cursorX,rects[i].top + rects[i].height/2);
                    if (newPos != null) {
                        newPos = Position_closestMatchForwards(newPos,Position_okForInsertion);
                        newPos.targetX = cursorX;
                        return newPos;
                    }
                }
            }

            var rightMost = findRightMostRect(rects);
            if (rightMost != null) {
                var newPos = positionAtPoint(rightMost.right,rightMost.top + rightMost.height/2);
                if (newPos != null) {
                    newPos = Position_closestMatchForwards(newPos,Position_okForInsertion);
                    newPos.targetX = cursorX;
                    return newPos;
                }
            }

            pos = new Position(paragraph.node,paragraph.endOffset);
            pos = Position_nextMatch(pos,Position_okForMovement);
        }
    });

    Text_closestPosBackwards = trace(function closestPosBackwards(pos)
    {
        if (isNonWhitespaceTextNode(pos.node))
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
        while ((node != null) && (node != document.body) && !isNonWhitespaceTextNode(node))
            node = prevNode(node);

        if ((node == null) || (node == document.body))
            return null;
        else
            return new Position(node,node.nodeValue.length);
    });

    Text_closestPosForwards = trace(function closestPosForwards(pos)
    {
        if (isNonWhitespaceTextNode(pos.node))
            return pos;
        var node;
        if ((pos.node.nodeType == Node.ELEMENT_NODE) && (pos.offset < pos.node.childNodes.length)) {
            node = pos.node.childNodes[pos.offset];
            while (node.firstChild != null)
                node = node.firstChild;
        }
        else {
            node = nextNodeAfter(pos.node);
        }
        while ((node != null) && !isNonWhitespaceTextNode(node)) {
            var old = nodeString(node);
            node = nextNode(node);
        }

        if (node == null)
            return null;
        else
            return new Position(node,0);
    });

    Text_closestPosInDirection = trace(function closestPosInDirection(pos,direction)
    {
        if ((direction == "forward") ||
            (direction == "right") ||
            (direction == "down")) {
            return Text_closestPosForwards(pos);
        }
        else {
            return Text_closestPosBackwards(pos);
        }
    });

    Paragraph_runFromOffset = trace(function runFromOffset(paragraph,offset)
    {
        if (paragraph.runs.length == 0)
            throw new Error("Paragraph has no runs");
        for (var i = 0; i < paragraph.runs.length; i++) {
            var run = paragraph.runs[i];
            if ((offset >= run.start) && (offset < run.end))
                return run;
            if ((i == paragraph.runs.length-1) && (offset == run.end))
                return run;
        }
    });

    Paragraph_runFromNode = trace(function runFromNode(paragraph,node)
    {
        for (var i = 0; i < paragraph.runs.length; i++) {
            if (paragraph.runs[i].node == node)
                return paragraph.runs[i];
        }
        throw new Error("Run for node "+nodeString(node)+" not found");
    });

    Paragraph_positionAtOffset = trace(function positionAtOffset(paragraph,offset)
    {
        var run = Paragraph_runFromOffset(paragraph,offset);
        if (run == null)
            throw new Error("Run at offset "+offset+" not found");
        return new Position(run.node,offset-run.start);
    });

    Paragraph_offsetAtPosition = trace(function offsetAtPosition(paragraph,pos)
    {
        var run = Paragraph_runFromNode(paragraph,pos.node);
        return run.start + pos.offset;
    });

    Paragraph_getRunRects = trace(function getRunRects(paragraph)
    {
        var rects = new Array();
        for (var i = 0; i < paragraph.runs.length; i++) {
            var run = paragraph.runs[i];
            var runRange = new Range(run.node,0,run.node,run.node.nodeValue.length);
            var runRects = runRange.getClientRects();
            Array.prototype.push.apply(rects,runRects);
        }
        return rects;
    });

    Paragraph_getRunOrFallbackRects = trace(function getRunOrFallbackRects(paragraph,pos)
    {
        var rects = Paragraph_getRunRects(paragraph);
        if ((rects.length == 0) && (paragraph.node.nodeType == Node.ELEMENT_NODE)) {
            if (isBlockNode(paragraph.node) &&
                (paragraph.startOffset == 0) &&
                (paragraph.endOffset == paragraph.node.childNodes.length)) {
                rects = [paragraph.node.getBoundingClientRect()];
            }
            else {
                var beforeNode = paragraph.node.childNodes[paragraph.startOffset-1];
                var afterNode = paragraph.node.childNodes[paragraph.endOffset];
                if ((afterNode != null) && isBlockNode(afterNode)) {
                    rects = [afterNode.getBoundingClientRect()];
                }
                else if ((beforeNode != null) && isBlockNode(beforeNode)) {
                    rects = [beforeNode.getBoundingClientRect()];
                }
            }
        }
        return rects;
    });

    var toStartOfParagraph = trace(function posAtStartOfParagraph(pos)
    {
        pos = Position_closestMatchBackwards(pos,Position_okForMovement);
        if (pos == null)
            return null;
        var paragraph = Text_analyseParagraph(pos);
        if (paragraph == null)
            return null;

        var newPos = new Position(paragraph.node,paragraph.startOffset);
        return Position_closestMatchForwards(newPos,Position_okForMovement);
    });

    var toEndOfParagraph = trace(function posAtEndOfParagraph(pos)
    {
        pos = Position_closestMatchForwards(pos,Position_okForMovement);
        if (pos == null)
            return null;
        var paragraph = Text_analyseParagraph(pos);
        if (paragraph == null)
            return null;

        var newPos = new Position(paragraph.node,paragraph.endOffset);
        return Position_closestMatchBackwards(newPos,Position_okForMovement);
    });

    var toStartOfLine = trace(function toStartOfLine(pos)
    {
        var posRect = Position_rectAtPos(pos);
        if (posRect == null) {
            pos = Text_closestPosBackwards(pos);
            posRect = Position_rectAtPos(pos);
            if (posRect == null) {
                return null;
            }
        }

        while (true) {
            var check = Position_prevMatch(pos,Position_okForMovement);
            var checkRect = Position_rectAtPos(check); // handles check == null case
            if (checkRect == null)
                return pos;
            if ((checkRect.bottom <= posRect.top) || (checkRect.top >= posRect.bottom))
                return pos;
            pos = check;
        }
    });

    var toEndOfLine = trace(function toEndOfLine(pos)
    {
        var posRect = Position_rectAtPos(pos);
        if (posRect == null) {
            pos = Text_closestPosForwards(pos);
            posRect = Position_rectAtPos(pos);
            if (posRect == null) {
                return null;
            }
        }

        while (true) {
            var check = Position_nextMatch(pos,Position_okForMovement);
            var checkRect = Position_rectAtPos(check); // handles check == null case
            if (checkRect == null)
                return pos;
            if ((checkRect.bottom <= posRect.top) || (checkRect.top >= posRect.bottom))
                return pos;
            pos = check;
        }
    });

    Text_toStartOfBoundary = trace(function toStartOfBoundary(pos,boundary)
    {
        if (boundary == "paragraph")
            return toStartOfParagraph(pos);
        else if (boundary == "line")
            return toStartOfLine(pos);
        else
            throw new Error("Unsupported boundary: "+boundary);
    });

    Text_toEndOfBoundary = trace(function toEndOfBoundary(pos,boundary)
    {
        if (boundary == "paragraph")
            return toEndOfParagraph(pos);
        else if (boundary == "line")
            return toEndOfLine(pos);
        else
            throw new Error("Unsupported boundary: "+boundary);
    });

})();
