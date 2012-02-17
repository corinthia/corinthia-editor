function insertAtPosition(position,node)
{
    if (position.node.nodeType == Node.ELEMENT_NODE) {
        if (position.offset == position.node.childNodes.length)
            position.node.appendChild(node);
        else
            position.node.insertBefore(node,position.node.childNodes[position.offset]);
    }
    else if (position.node.nodeType == Node.TEXT_NODE) {
        var newText = document.createTextNode(position.node.nodeValue.slice(position.offset));
        position.node.nodeValue = position.node.nodeValue.slice(0,position.offset);
        position.node.parentNode.insertBefore(newText,position.node.nextSibling);
        position.node.parentNode.insertBefore(node,position.node.nextSibling);
    }
}

function insertTextAtPosition(position,str)
{
    if (position.node.nodeType == Node.ELEMENT_NODE) {
        insertAtPosition(position,document.createTextNode(str));
    }
    else if (position.node.nodeType == Node.TEXT_NODE) {
        position.node.nodeValue = position.node.nodeValue.slice(0,position.offset) + str +
                                  position.node.nodeValue.slice(position.offset);
    }
}

function showRangeAsBrackets(range)
{
    insertTextAtPosition(range.end,"]");
    insertTextAtPosition(range.start,"[");
}

function removeIds()
{
    recurse(document.body);

    function recurse(node)
    {
        if (node.nodeType == Node.ELEMENT_NODE) {
            node.removeAttribute("id");
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }
}

function selectNode(node)
{
    var offset = getOffsetOfNodeInParent(node);
    setSelectionRange(new Range(node.parentNode,offset,node.parentNode,offset+1));
}

function removeWhitespaceAndCommentNodes(node)
{
    if (isWhitespaceTextNode(node) || (node.nodeType == Node.COMMENT_NODE)) {
        node.parentNode.removeChild(node);
    }
    else {
        var next;
        for (var child = node.firstChild; child != null; child = next) {
            next = child.nextSibling;
            removeWhitespaceAndCommentNodes(child);
        }
    }
}

// selectionWrapElement() and selectionUnwrapElement() used to be in formatting.js but have
// now been made obselete by the addition of applyFormattingChanges(). However there are still
// a few tests which use them.
function selectionWrapElement(elementName)
{
    if (elementName == "B")
        applyFormattingChanges(null,{"font-weight": "bold"});
    else if (elementName == "I")
        applyFormattingChanges(null,{"font-style": "italic"});
    else if (elementName == "U")
        applyFormattingChanges(null,{"text-decoration": "underline"});
}

function selectionUnwrapElement(elementName)
{
    if (elementName == "B")
        applyFormattingChanges(null,{"font-weight": null});
    else if (elementName == "I")
        applyFormattingChanges(null,{"font-style": null});
    else if (elementName == "U")
        applyFormattingChanges(null,{"text-decoration": null});
}
