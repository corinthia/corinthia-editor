function SelectionFormatting()
{
    this.bold = false;
    this.italic = false;
    this.underline = false;
    this.linethrough = false;
    this.overline = false;
    this.typewriter = false;
    this.ul = false;
    this.ol = false;
    this.inBrackets = false;
    this.inQuote = false;
}

function checkBracketsAndQuotes(node,offset,formatting)
{
    var haveClosingBracket = false;
    var haveClosingQuote = false;
    while ((node != null) && (isInlineNode(node))) {
        if (node.nodeType == Node.TEXT_NODE) {
            for (var i = offset-1; i >= 0; i--) {
                switch (node.nodeValue.charCodeAt(i)) {
                    case 0x28: // opening (
                        if (!haveClosingBracket)
                            formatting.inBrackets = true;
                        break;
                    case 0x29: // closing )
                        haveClosingBracket = true;
                        break;
                    case 0x201C: // opening "
                        if (!haveClosingQuote)
                            formatting.inQuote = true;
                        break;
                    case 0x201D: // closing "
                        haveClosingQuote = true;
                        break;
                }
            }
        }

        node = prevNode(node);
        
        if (node.nodeType == Node.TEXT_NODE)
            offset = node.nodeValue.length;
        else
            offset = 0;
    }
}

function reportSelectionFormatting()
{
    var selection = window.getSelection();
    var formatting = new SelectionFormatting();
    if (selection.baseNode != null) {
        var node = selection.baseNode;
        while (node != null) {
            detectFormatting(formatting,node);

            if (node == selection.extentNode)
                break;

            node = nextNode(node);
        }
        checkBracketsAndQuotes(selection.baseNode,selection.baseOffset,formatting);
    }
    editor.reportFormatting(formatting);

    function detectFormatting(formatting,node)
    {
        if (node == null)
            return;

        if (node.nodeName == "B")
            formatting.bold = true;
        if (node.nodeName == "I")
            formatting.italic = true;
        if (node.nodeName == "U")
            formatting.underline = true;
        if (node.nodeName == "TT")
            formatting.typewriter = true;
        if (node.nodeName == "UL")
            formatting.ul = true;
        if (node.nodeName == "OL")
            formatting.ol = true;

        detectFormatting(formatting,node.parentNode);
    }
}

function wrapNode(node,elementName)
{
    var wrapper = document.createElement(elementName);
    node.parentNode.insertBefore(wrapper,node);
    wrapper.appendChild(node);
}

function splitAroundSelection(range)
{
    range.omitEmptyTextSelection();
    range.ensureRangeValidHierarchy();

    if ((range.start.node.nodeType == Node.TEXT_NODE) &&
        (range.start.offset > 0)) {
        splitTextBefore(range.start.node,range.start.offset);
        if (range.end.node == range.start.node)
            range.end.offset -= range.start.offset;
        range.start.offset = 0;
    }
    else {
        movePrecedingSiblingsToOtherNode(range.start.node,isParagraphNode);
    }

    if ((range.end.node.nodeType == Node.TEXT_NODE) &&
        (range.end.offset < range.end.node.nodeValue.length)) {
        splitTextAfter(range.end.node,range.end.offset);
    }
    else {
        moveFollowingSiblingsToOtherNode(range.end.node,isParagraphNode);
    }
}

function splitTextBefore(node,offset)
{
    var before = document.createTextNode(node.nodeValue.slice(0,offset));

    node.parentNode.insertBefore(before,node);
    node.nodeValue = node.nodeValue.slice(offset);

    movePrecedingSiblingsToOtherNode(node,isParagraphNode);
}

function splitTextAfter(node,offset)
{
    var after = document.createTextNode(node.nodeValue.slice(offset));

    node.parentNode.insertBefore(after,node.nextSibling);
    node.nodeValue = node.nodeValue.slice(0,offset);

    moveFollowingSiblingsToOtherNode(node,isParagraphNode);
}

function movePrecedingSiblingsToOtherNode(child,parentCheckFn)
{
    var parent = child.parentNode;
    if (parentCheckFn(parent) || (parent == document.body))
        return;
    if (child.previousSibling == null)
        return;

    var parentCopy = shallowCopyElement(parent);
    parent.parentNode.insertBefore(parentCopy,parent);

    while (child.previousSibling != null)
        parentCopy.insertBefore(child.previousSibling,parentCopy.firstChild);

    movePrecedingSiblingsToOtherNode(child.parentNode,parentCheckFn)
}

function moveFollowingSiblingsToOtherNode(child,parentCheckFn)
{
    var parent = child.parentNode;
    if (parentCheckFn(parent) || (parent == document.body))
        return;
    if (child.nextSibling == null)
        return;

    var parentCopy = shallowCopyElement(parent);
    parent.parentNode.insertBefore(parentCopy,parent.nextSibling);

    while (child.nextSibling != null)
        parentCopy.appendChild(child.nextSibling);

    moveFollowingSiblingsToOtherNode(child.parentNode,parentCheckFn)
}

// "Wraps" a selection in a given element, i.e. ensures that all inline nodes that are part of
// the selection have an ancestor of the given element type, e.g. B or UL. If the selection starts
// or ends part-way through a text node, the text node(s) are split and the operation is applied
// only to the portion of the text that is actually selected.
function selectionWrapElement(elementName)
{
    debug("selectionWrapElement "+elementName);
    var range = selectionUnwrapElement(elementName);

    if ((range == null) ||
        ((range.start.node == range.end.node) && (range.start.offset == range.end.offset))) {
        debug("selectionWrapElement: no range");
        return null;
    }
    splitAroundSelection(range);

    var inlineNodes = range.getInlineNodes();
    for (var i = 0; i < inlineNodes.length; i++) {
        var node = inlineNodes[i];
        ensureValidHierarchy(node,true);

        // splitAroundSelection() ensured that there is a child element of the current paragraph
        // that is wholly contained within the selection. It is this element that we will wrap.
        // Note that this part of the selection might already be wrapped in the requested
        // element; so we include a check to avoid double-wrapping.
        for (var p = node; p.parentNode != null; p = p.parentNode) {
            if ((p.nodeName != elementName) && isParagraphNode(p.parentNode)) {
                wrapNode(p,elementName);
                break;
            }
        }
    }

    mergeRange(range);

    range.setSelection();
    reportSelectionFormatting();
    return range;
}

function mergeRange(range)
{
    var node = range.start.node;
    var last = nextNode(range.end.node);
    while (node != null) {
        checkMerge(range,node);

        if (node == last)
            break;

        node = nextNode(node);
    }

    function checkMerge(range,node)
    {
        if (node == null)
            return;

        if ((node.previousSibling != null) &&
            (node.nodeType == Node.TEXT_NODE) &&
            (node.previousSibling.nodeType == Node.TEXT_NODE)) {

//            debug("Merging \""+node.previousSibling.nodeValue+"\" and \""+
//                         node.nodeValue+"\"");

            node.nodeValue = node.previousSibling.nodeValue + node.nodeValue;

            if (range.start.node == node.previousSibling)
                range.start.node = node;
            else if (range.start.node == node)
                range.start.offset += node.previousSibling.nodeValue.length;

            if (range.end.node == node.previousSibling)
                range.end.node = node;
            else if (range.end.node == node)
                range.end.offset += node.previousSibling.nodeValue.length;

            node.parentNode.removeChild(node.previousSibling);
            checkMerge(range,node);
            var next = nextNode(node);
            if (next != null)
                checkMerge(range,next);
        }
        else if ((node.previousSibling != null) &&
                 (node.nodeType == Node.ELEMENT_NODE) &&
                 (node.previousSibling.nodeType == Node.ELEMENT_NODE) &&
                 elementsMergable(node,node.previousSibling)) {

//            debug("Merging \""+node.previousSibling.nodeName+"\" and \""+
//                         node.nodeName+"\"");
            var origFirst = node.firstChild;
            while (node.previousSibling.lastChild != null)
                node.insertBefore(node.previousSibling.lastChild,node.firstChild);
            node.parentNode.removeChild(node.previousSibling);
            checkMerge(range,origFirst);
        }

        checkMerge(range,node.parentNode);
    }

    function elementsMergable(a,b)
    {
        if (isInlineNode(a) && isInlineNode(b) &&
            (a.nodeName == b.nodeName) &&
            (a.attributes.length == b.attributes.length)) {
            for (var i = 0; i < a.attributes.length; i++) {
                var attrName = a.attributes[i].nodeName;
                if (a.getAttribute(attrName) != b.getAttribute(attrName))
                    return false;
            }
            return true;
        }

        return false;
    }
}

// For all nodes in the selection, remove any ancestor nodes with the given name from the tree
// (replacing them with their children)
function selectionUnwrapElement(elementName)
{
    debug("selectionUnwrapElement "+elementName);
    var range = Range.fromSelection();
    if ((range == null) ||
        ((range.start.node == range.end.node) && (range.start.offset == range.end.offset)))
        return null;
    splitAroundSelection(range);

    var node = range.start.node;
    while (node != null) {
        var next = nextNode(node);
        if (node.nodeType == Node.TEXT_NODE)
            unwrapSingle(node,elementName);
        if (node == range.end.node)
            break;
        node = next;
    }

    mergeRange(range);

    range.setSelection();
    debug("\n");

    function unwrapSingle(node,elementName)
    {
        if (node == null)
            return;

        var parent = node.parentNode;
        if (node.nodeName == elementName) {
            // We found the node we're looking for. Move all of its children to its parent
            // and then remove the node
            while (node.firstChild != null)
                node.parentNode.insertBefore(node.firstChild,node);
            node.parentNode.removeChild(node);
        }

        unwrapSingle(parent,elementName);
    }

    reportSelectionFormatting();
    return range;
}

function selectionWrapStyle(name,value)
{
    reportSelectionFormatting();
}

function selectionUnwrapStyle(name,value)
{
    reportSelectionFormatting();
}
