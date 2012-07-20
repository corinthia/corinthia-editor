// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Text_analyseParagraph;
var Text_posAbove;
var Text_posBelow;
var Text_posAtStartOfWord;
var Text_posAtEndOfWord;
var Text_closestPosBackwards;
var Text_closestPosForwards;

var Paragraph_runFromOffset;
var Paragraph_runFromNode;
var Paragraph_positionAtOffset;
var Paragraph_getRunRects;

(function() {

    function Paragraph(node,runs,text)
    {
        this.node = node;
        this.runs = runs;
        this.text = text;
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

    var findFirstAndLast = trace(function findFirstAndLast(initial)
    {
        if (isInlineNode(initial)) {
            var topInline = initial;
            while ((topInline.parentNode != null) && isInlineNode(topInline.parentNode))
                topInline = topInline.parentNode;

            var first = topInline;
            var last = topInline;

            while ((first.previousSibling != null) && isInlineNode(first.previousSibling))
                first = first.previousSibling;

            while ((last.nextSibling != null) && isInlineNode(last.nextSibling))
                last = last.nextSibling;

            return { first: first, last: last };
        }
        else if (initial.firstChild == null) {
            return null;
        }
        else {
            return { first: initial.firstChild, last: initial.lastChild };
        }
    });

    Text_analyseParagraph = trace(function analyseParagraph(initial)
    {
        var strings = new Array();
        var runs = new Array();
        var offset = 0;

        var pair = findFirstAndLast(initial);
        if (pair == null)
            return null;

        for (var cur = pair.first; cur != pair.last.nextSibling; cur = cur.nextSibling)
            recurse(cur);

        var text = strings.join("");
        return new Paragraph(pair.first.parentNode,runs,text);

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
        while (true) {
            pos = Text_closestPosBackwards(pos);
            if (pos == null)
                return;

            var paragraph = Text_analyseParagraph(pos.node);
            if (paragraph == null)
                return;

            var rects = Paragraph_getRunRects(paragraph);

            var bottom = null;
            for (var i = 0; i < rects.length; i++) {
                if (rects[i].bottom <= cursorRect.top) {
                    if ((bottom == null) || (bottom < rects[i].bottom))
                        bottom = rects[i].bottom;
                }
            }

            for (var i = 0; i < rects.length; i++) {
                if ((rects[i].bottom == bottom) &&
                    (cursorX >= rects[i].left) &&
                    (cursorX <= rects[i].right)) {

                    var newPos = positionAtPoint(cursorX,rects[i].top + rects[i].height/2);
                    if (newPos != null)
                        return newPos;
                }
            }


            var rightMost = null;
            for (var i = 0; i < rects.length; i++) {
                if (rects[i].bottom == bottom) {
                    if ((rightMost == null) || (rightMost.right < rects[i].right))
                        rightMost = rects[i];
                }
            }

            if (rightMost != null) {
                var newPos = positionAtPoint(rightMost.right,rightMost.top + rightMost.height/2);
                if (newPos != null)
                    return newPos;
            }

            debug("still here!");
            pos = new Position(pos.node.parentNode,DOM_nodeOffset(pos.node));
        }
    });

    Text_posBelow = trace(function posBelow(pos)
    {
    });

    Text_posAtStartOfWord = trace(function posAtStartOfWord(pos)
    {
        while (true) {
            pos = Text_closestPosBackwards(pos);
            if (pos == null)
                return;

            var paragraph = Text_analyseParagraph(pos.node);
            if (paragraph == null)
                return;

            var run = Paragraph_runFromNode(paragraph,pos.node);
            var offset = pos.offset + run.start;

            var before = paragraph.text.substring(0,offset);
            var beforeWord = before.replace(/[^\s]+$/,"");

            if (beforeWord.length == before.length) {
                // Already at start of word; go to start of previous word in this paragraph
                beforeWord = before.replace(/[^\s]+\s+$/,"");
                if (beforeWord.length == before.length) {
                    // Already at start of paragraph, go to previous non-empty paragraph, if any
                    pos = new Position(pos.node.parentNode,DOM_nodeOffset(pos.node));
                    continue;
                }
            }

            return Paragraph_positionAtOffset(paragraph,beforeWord.length);
        }
    });

    Text_posAtEndOfWord = trace(function posAtEndOfWord(pos)
    {
        while (true) {
            pos = Text_closestPosForwards(pos);
            if (pos == null)
                return;

            var paragraph = Text_analyseParagraph(pos.node);
            if (paragraph == null)
                return;

            var run = Paragraph_runFromNode(paragraph,pos.node);
            var offset = pos.offset + run.start;

            var after = paragraph.text.substring(offset);
            var afterWord = after.replace(/^[^\s]+/,"");

            if (afterWord.length == after.length) {
                // Already at end of word; go to end of next word in this paragraph
                afterWord = after.replace(/^\s+[^\s]+/,"");
                if (afterWord.length == after.length) {
                    // Already at end of paragraph, go to next non-empty paragraph, if any
                    pos = new Position(pos.node.parentNode,DOM_nodeOffset(pos.node)+1);
                    continue;
                }
            }

            return Paragraph_positionAtOffset(paragraph,paragraph.text.length-afterWord.length);
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

})();
