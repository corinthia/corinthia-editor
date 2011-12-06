////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                          Styles                                                //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

function click(e)
{
    var node = window.getSelection().focusNode;
    var offset = window.getSelection().focusOffset;
    var style = "";
    while (node != null) {
        if ((node.nodeName == "H1") ||
            (node.nodeName == "H2") ||
            (node.nodeName == "H3") ||
            (node.nodeName == "H4") ||
            (node.nodeName == "H5") ||
            (node.nodeName == "H6")) {
            style = node.nodeName;
            break;
        }
        node = node.parentNode;
    }
    editor.reportStyle(style);

    reportSelectionFormatting();
}

// Enforce the restriction that any path from the root to a given node must be of the form
//    container+ paragraph inline
// or container+ paragraph
// or container+
function ensureValidHierarchy(node,recursive)
{
    if ((node == null) || (node == document.body))
        return;

    if (node.parentNode == null)
        throw new Error("Node "+node.nodeName+" \""+node.nodeValue+"\" has been removed");

    if (recursive)
        ensureValidHierarchy(node.parentNode,true);

    if (isContainerNode(node) || isParagraphNode(node)) {
        if (!isContainerNode(node.parentNode)) {
            debug("ensureValidHierarchy case 1 ("+getNodeText(node)+")"+
                  " "+node.nodeName+" inside "+node.parentNode.nodeName);

            removeAdjacentWhitespace(node);
            movePrecedingSiblingsToOtherNode(node,isContainerNode);
            moveFollowingSiblingsToOtherNode(node,isContainerNode);

            var remove = new Array();
            var child = node;
            while (!isContainerNode(child.parentNode))
                child = child.parentNode;
            child.parentNode.insertBefore(node,child);
            child.parentNode.removeChild(child);
        }
    }
    else { // inline node
        if (isContainerNode(node.parentNode)) {
            // Wrap this node in a P element

            var before = node.previousSibling;
            var after = node.nextSibling;

            var p = document.createElement("P");
//            p.style.border = "4px dashed red"; // debug
            node.parentNode.insertBefore(p,node);

            while ((before != null) && isInlineNode(before)) {
                var n = before;
                before = before.previousSibling;
                p.insertBefore(n,p.firstChild);
            }

            p.appendChild(node);

            while ((after != null) && isInlineNode(after)) {
                var n = after;
                after = after.nextSibling;
                p.appendChild(n);
            }
        }
    }
}

function setStyle(name)
{
    // FIXME: handle the case where there are multiple paragraphs selected.
    // We need to update the style of each of them

    var cursorNode = window.getSelection().focusNode;
    var cursorOffset = window.getSelection().focusOffset;

    ensureValidHierarchy(cursorNode,true);
    var styleElement = getParagraphNode(cursorNode);

    if (styleElement != null) {
        debug("replacing with "+name);
        var newElement = document.createElement(name);
        styleElement.parentNode.insertBefore(newElement,styleElement);
        styleElement.parentNode.removeChild(styleElement);
        while (styleElement.firstChild != null)
            newElement.appendChild(styleElement.firstChild);
        window.getSelection().setPosition(cursorNode,cursorOffset);
    }
    else {
        alert("No style element!");
    }

    return;

    function getParagraphNode(node)
    {
        for (var p = node; p != null; p = p.parentNode) {
            if (isParagraphNode(p))
                return p;
        }
        return null;
    }
}

function setStyleElement(cssText)
{
//    alert(cssText);

    // Get the head element, or create it if it doesn't already exist
    var heads = document.getElementsByTagName("HEAD");
    var head;
    if (heads.length == 0) {
        head = document.createElement("HEAD");
        document.documentElement.appendChild(head);
    }
    else {
        head = heads[0];
    }

    // Remove all existing style elements
    var removed = 0;
    var next;
    for (var child = head.firstChild; child; child = next) {
        var next = child.nextSibling;
        if (child.nodeName == "STYLE") {
            head.removeChild(child);
            removed++;
        }
    }

    // Add the new style element
    var style = document.createElement("STYLE");
    style.setAttribute("type","text/css");
    style.appendChild(document.createTextNode(cssText));
    head.appendChild(style);
}
