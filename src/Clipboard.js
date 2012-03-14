(function() {

    // public
    function cut()
    {
        var content = copy();
        Selection.deleteSelectionContents();
        return content;
    }

    // public
    function copy()
    {
        var html = "";
        var text = "";

        return { "text/html": html,
                 "text/plain": text };
    }

    // public
    function pasteText(text)
    {
        var textNode = DOM.createTextNode(document,text);
        var nodes = [textNode];
        pastNodes(nodes);
    }

    // public
    function pasteHTML(html)
    {
        var div = DOM.createElement(document,"DIV");
        div.innerHTML = html;

        var nodes = new Array();
        for (var child = div.firstChild; child != null; child = child.nextSibling)
            nodes.push(child);

        pasteNodes(nodes);
    }

    function pasteNodes(nodes)
    {
        Selection.deleteSelectionContents();
        var pos = selection.start;
        var node = pos.node;
        var offset = pos.offset;

        var parent;
        var before;
        if (node.nodeType == Node.ELEMENT_NODE) {
            parent = node;
            before = node.childNodes[offset];
        }
        else {
            splitTextBefore(node,offset);
            parent = node.parentNode;
            before = node;
        }
        for (var i = 0; i < nodes.length; i++)
            DOM.insertBefore(parent,nodes[i],before);
    }

    function pasteImage(href)
    {
        // FIXME
    }

    window.Clipboard = new Object();
    Clipboard.cut = cut;
    Clipboard.copy = copy;
    Clipboard.pasteText = pasteText;
    Clipboard.pasteHTML = pasteHTML;

})();
