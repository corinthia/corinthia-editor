// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Text_analyseParagraph;

var Paragraph_runFromOffset;
var Paragraph_runFromNode;

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

})();
