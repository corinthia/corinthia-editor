function oldInsertCharacter(character)
{
    var selectionRange = Selection_getSelectionRange();
    if (selectionRange == null)
        return;

    if (!selectionRange.isEmpty())
        Selection_deleteSelectionContents();
    var pos = selectionRange.start;
    var node = pos.node;
    var offset = pos.offset;

    if (node.nodeType == Node.ELEMENT_NODE) {
        var prev = node.childNodes[offset-1];
        var next = node.childNodes[offset];
        var emptyTextNode = DOM_createTextNode(document,"");
        if (offset >= node.childNodes.length)
            DOM_appendChild(node,emptyTextNode);
        else
            DOM_insertBefore(node,emptyTextNode,node.childNodes[offset]);
        node = emptyTextNode;
        offset = 0;
    }

    DOM_insertCharacters(node,offset,character);
    Selection_setEmptySelectionAt(node,offset+1,node,offset+1);
}

function showValidPositions()
{
    var validPositions = new Array();
    var pos = new Position(document.body,0);
    while (pos != null) {
        if (Cursor_isValidCursorPosition(pos)) {
//            debug("Valid position: "+pos);
            validPositions.push(pos);
        }
        pos = pos.next();
    }

    Position.trackWhileExecuting(validPositions,function() {
//        for (var i = 0; i < validPositions.length; i++) {
        for (var i = validPositions.length-1; i >= 0; i--) {
            var pos = validPositions[i];
            Selection_setEmptySelectionAt(pos.node,pos.offset);
            oldInsertCharacter('.');
        }
    });
}

function flattenTreeToString(node)
{
    var result = new Array();
    recurse(node);
    return result.join("").replace(/\n/g," ");

    function recurse(node)
    {
        if (node.nodeType == Node.TEXT_NODE) {
            result.push(node.nodeValue);
        }
        else if (DOM_upperName(node) == "IMG") {
            result.push("I");
        }
        else if (isOpaqueNode(node)) {
            result.push("O");
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                recurse(child);
            }
        }
    }
}

function findCursorPositionErrors(text)
{
    var detail = "";
    for (var i = 0; i < text.length; i++) {
        var prevChar = (i > 0) ? text.charAt(i-1) : null;
        var nextChar = (i < text.length-1) ? text.charAt(i+1) : null;
        var curChar = text.charAt(i);

        if (curChar == '.') {
            if ((prevChar == '.') || (nextChar == '.')) {
                // Two positions not separated by a space or character
                detail += "^";
            }
            else if ((prevChar != null) && (nextChar != null) &&
                     isWhitespaceString(prevChar) && isWhitespaceString(nextChar)) {
                // A position between two spaces
                detail += "^";
            }
            else {
                // OK
                detail += " ";
            }
        }
        else if (!isWhitespaceString(curChar)) {
            if ((prevChar != '.') || (nextChar != '.'))
                detail += "^";
            else
                detail += " ";
        }
    }
    return detail;
}

function checkCursorPositions(node)
{
    var text = flattenTreeToString(document.body);
    var detail = findCursorPositionErrors(text);
    return text+"\n"+detail;
}

function addEmptyTextNode(parent)
{
    var text = DOM_createTextNode(document,"");
    DOM_appendChild(parent,text);
}
