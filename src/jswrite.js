var CONTAINER_ELEMENTS = new Object();

CONTAINER_ELEMENTS["#document"] = true;
CONTAINER_ELEMENTS["HTML"] = true;
CONTAINER_ELEMENTS["BODY"] = true;
CONTAINER_ELEMENTS["UL"] = true;
CONTAINER_ELEMENTS["OL"] = true;
CONTAINER_ELEMENTS["LI"] = true;
CONTAINER_ELEMENTS["TABLE"] = true;
CONTAINER_ELEMENTS["THEAD"] = true;
CONTAINER_ELEMENTS["TFOOT"] = true;
CONTAINER_ELEMENTS["TBODY"] = true;
CONTAINER_ELEMENTS["TR"] = true;
CONTAINER_ELEMENTS["TH"] = true;
CONTAINER_ELEMENTS["TD"] = true;

var PARAGRAPH_ELEMENTS = new Object();

PARAGRAPH_ELEMENTS["P"] = true;
PARAGRAPH_ELEMENTS["H1"] = true;
PARAGRAPH_ELEMENTS["H2"] = true;
PARAGRAPH_ELEMENTS["H3"] = true;
PARAGRAPH_ELEMENTS["H4"] = true;
PARAGRAPH_ELEMENTS["H5"] = true;
PARAGRAPH_ELEMENTS["H6"] = true;

var HEADING_ELEMENTS = new Object();

HEADING_ELEMENTS["H1"] = true;
HEADING_ELEMENTS["H2"] = true;
HEADING_ELEMENTS["H3"] = true;
HEADING_ELEMENTS["H4"] = true;
HEADING_ELEMENTS["H5"] = true;
HEADING_ELEMENTS["H6"] = true;

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                      General utility functions                                 //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

function isWordChar(c)
{
    return (((c >= "a") && (c <= "z")) ||
            ((c >= "A") && (c <= "Z")) ||
            ((c >= "0") && (c <= "9")));
}

function arrayContains(array,value)
{
    for (var i = 0; i < array.length; i++) {
        if (array[i] == value)
            return true;
    }
    return false;
}

function quoteString(str)
{
    if (str == null)
        return null;

    if (str.indexOf('"') < 0)
        return str;

    var quoted = "";
    for (var i = 0; i < str.length; i++) {
        if (str.charAt(i) == '"')
            quoted += "\\\"";
        else
            quoted += str.charAt(i);
    }
    return quoted;
}

function encodeJSON(obj)
{
    var builder = new StringBuilder();
    encodeJSONRecursive(obj,builder);
    return builder.str;

    function encodeJSONRecursive(obj,builder)
    {
        if (obj instanceof Array) {
            builder.str += "[ ";
            for (var i = 0; i < obj.length; i++) {
                if (i > 0)
                    builder.str += ", ";
                encodeJSONRecursive(obj[i],builder);
            }
            builder.str += " ]";
        }
        else if ((obj instanceof String) || (typeof obj == "string")) {
            builder.str += "\"" + quoteString(obj) + "\"";
        }
        else if (obj instanceof Object) {
            builder.str += "{ ";
            var i = 0;
            for (var name in obj) {
                if (i > 0)
                    builder.str += ", ";
                builder.str += "\"" + quoteString(name) + "\": ";
                encodeJSONRecursive(obj[name],builder);
                i++;
            }
            builder.str += " }";
        }
        else {
            builder.str += obj.toString();
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                          Helper classes                                        //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

function StringBuilder()
{
    this.str = "";
}

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

function Range(start,end)
{
    this.start = start;
    this.end = end;
}

Range.fromSelection = function()
{
    var selection = window.getSelection();

    if (selection.rangeCount == 0)
        return null;

    var r = selection.getRangeAt(0);

    return new Range(new Position(r.startContainer,r.startOffset),
                     new Position(r.endContainer,r.endOffset));
}

Range.prototype = {
    selectWholeWords: function()
    {
        if ((this.start.node.nodeType == Node.TEXT_NODE) &&
            (this.end.node.nodeType == Node.TEXT_NODE)) {
            if (this.isForwards()) {
                // this.start comes before this.end
                this.start.moveToStartOfWord();
                this.end.moveToEndOfWord();
            }
            else {
                // this.end comes before this.end
                this.start.moveToEndOfWord();
                this.end.moveToStartOfWord();
            }
        }
    },

    omitEmptyTextSelection: function()
    {
        this.start.moveForwardIfAtEnd();
        this.end.moveBackwardIfAtStart();
    },

    isForwards: function()
    {
        if (this.start.node == this.end.node)
            return (this.start.offset < this.end.offset);
        else
            return (this.start.node.compareDocumentPosition(this.end.node) ==
                    Node.DOCUMENT_POSITION_FOLLOWING);
    },

    getParagraphNodes: function()
    {
        var result = new Array();
        var node = this.start.node;
        while (!isParagraphNode(node))
            node = node.parentNode;
        while (true) {
            if (isParagraphNode(node))
                result.push(node);
            if (node == this.end.node)
                break;
            node = nextNode(node);
        }
        return result;
    },

    getInlineNodes: function()
    {
        var result = new Array();
        var node = this.start.node;
        while (true) {
            if (isInlineNode(node)) {
                debug("getInlineNodes: "+node.nodeName+" is inline");
                result.push(node);
            }
            else {
                debug("getInlineNodes: "+node.nodeName+" is NOT inline");
            }
            if (node == this.end.node)
                break;
            node = nextNode(node);
        }
        return result;
    },

    getAllNodes: function()
    {
        var result = new Array();
        var node = this.start.node;
        while (true) {
            result.push(node);
            if (node == this.end.node)
                break;
            node = nextNode(node);
        }
        return result;
    },

    setSelection: function()
    {
        window.getSelection().setBaseAndExtent(this.start.node,
                                               this.start.offset,
                                               this.end.node,
                                               this.end.offset);
    },

    ensureRangeValidHierarchy: function()
    {
        var nodes = this.getAllNodes();

        var depths = new Array();
        for (var i = 0; i < nodes.length; i++) {
            var depth = getNodeDepth(nodes[i]);
            if (depths[depth] == null) {
                depths[depth] = new Array();
            }
            depths[depth].push(nodes[i]);
        }

        for (var depth = 0; depth < depths.length; depth++) {
            var firstDepth = true;
            if (depths[depth] != null) {
                for (var i = 0; i < depths[depth].length; i++) {
                    var node = depths[depth][i];
                    if (!isInlineNode(node.parentNode) && isWhitespaceTextNode(node)) {
                        node.parentNode.removeChild(node);
                    }
                    else {
                        ensureValidHierarchy(node,firstDepth);
                    }
                }
                firstDepth = false;
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                          Tree traversal                                        //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

function prevNode(node)
{
    if (node.previousSibling != null) {
        node = node.previousSibling;
        while (node.lastChild != null)
            node = node.lastChild;
        return node;
    }
    else {
        return node.parentNode;
    }
}

function nextNode(node)
{
    if (node.firstChild) {
        return node.firstChild;
    }
    else if (node.nextSibling) {
        return node.nextSibling;
    }
    else {
        while ((node.parentNode != null) && (node.parentNode.nextSibling == null))
            node = node.parentNode;
        if (node.parentNode == null)
            return null;
        else
            return node.parentNode.nextSibling;
    }
}

function prevTextNode(node)
{
    do {
        node = prevNode(node);
    } while ((node != null) && (node.nodeType != Node.TEXT_NODE));
    return node;
}

function nextTextNode(node)
{
    do {
        node = nextNode(node);
    } while ((node != null) && (node.nodeType != Node.TEXT_NODE));
    return node;
}

function firstChildElement(node)
{
    var first = node.firstChild;
    while ((first != null) && (first.nodeType != Node.ELEMENT_NODE))
        first = first.nextSibling;
    return first;
}

function lastChildElement(node)
{
    var last = node.lastChild;
    while ((last != null) && (last.nodeType != Node.ELEMENT_NODE))
        last = last.previousSibling;
    return last;
}

function getNodeDepth(node)
{
    var depth = 0;
    for (; node != null; node = node.parentNode)
        depth++;
    return depth;
}

function isContainerNode(node)
{
    return CONTAINER_ELEMENTS[node.nodeName];
}

function isParagraphNode(node)
{
    return PARAGRAPH_ELEMENTS[node.nodeName];
}

function isHeadingNode(node)
{
    return HEADING_ELEMENTS[node.nodeName];
}

function isInlineNode(node)
{
    return (!isContainerNode(node) && !isParagraphNode(node));
}

function getNodeText(node)
{
    var stringBuilder = new StringBuilder();
    getNodeTextRecursive(stringBuilder,node);
    stringBuilder.str = stringBuilder.str.replace(/\s+/g," ");
    return stringBuilder.str;

    function getNodeTextRecursive(stringBuilder,node)
    {
        if (node.nodeName == "#text") {
            stringBuilder.str += node.nodeValue;
        }
        else {
            for (var c = node.firstChild; c != null; c = c.nextSibling)
                getNodeTextRecursive(stringBuilder,c);
        }
    }
}

function shallowCopyElement(element)
{
    var copy = document.createElement(element.nodeName);
    for (var i = 0; i < element.attributes.length; i++) {
        if (element.attributes[i].nodeName != "id")
            copy.setAttribute(element.attributes[i].nodeName,element.attributes[i].nodeValue);
    }
    return copy;
}

function isWhitespaceTextNode(node)
{
    if (node.nodeType != Node.TEXT_NODE)
        return false;
    var value = node.nodeValue;
    for (var i = 0; i < value.length; i++) {
        var c = value.charAt(i);
        if ((c != " ") && (c != "\t") && (c != "\r") && (c != "\n"))
            return false;
    }
    return true;
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                          Selection                                             //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

var captured = null;

function updateSelection(x,y)
{
    var range = document.caretRangeFromPoint(x,y);
    if (range == null) // Can happen if pointer is outside of WebView
        return;

    captured.end = new Position(range.endContainer,range.endOffset);

    captured.selectWholeWords();

    captured.setSelection();
}

function newSelection(x,y)
{
    window.getSelection().empty();
    var range = document.caretRangeFromPoint(x,y);

    captured = new Range(new Position(range.startContainer,range.startOffset),
                         new Position(range.startContainer,range.startOffset));

    captured.start.moveToStartOfWord();
    captured.end.moveToEndOfWord();

    captured.setSelection();
}

function finishSelection()
{
    reportSelectionFormatting();
}

function emptySelection()
{
    window.getSelection().empty();
}

function disableEditing()
{
    document.body.contentEditable = false;
}

function enableEditing()
{
    document.body.contentEditable = true;
}

function scrollToCursor()
{
    var node = window.getSelection().focusNode;
    if (node != null) {
        var position = getAbsolutePosition(node);
        window.scrollTo(0,position.y);
    }

    function getAbsolutePosition(node)
    {
        var x = 0;
        var y = 0;
        for (; node != null; node = node.parentNode) {
            if ((node.offsetLeft != null) && (node.offsetTop != null)) {
                x += node.offsetLeft;
                y += node.offsetTop;
            }
        }
        return { x: x, y: y };
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                    Mutation event listeners                                    //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

function sectionTitleMaybeChanged(node)
{
    for (var p = node; p != null; p = p.parentNode) {
        if (isHeadingNode(p)) {
            var name = quoteString(getNodeText(p));
            editor.updateSectionName(p.getAttribute("id"),name);
            return;
        }
    }
}

function characterDataModified(e)
{
//    debug("characterDataModified");
    sectionTitleMaybeChanged(e.target);
    ensureValidHierarchy(e.target,true);
}

function isHeadingElement(node)
{
    var name = node.nodeName;
    return ((name.charAt(0) == "H") && (name.length == 2) &&
            (name.charAt(1) >= "1") && (name.charAt(1) <= "6"));
}

function nodeInserted(e)
{
//    if (e.target.nodeType == Node.TEXT_NODE) {
//        debug("nodeInserted "+e.target.nodeName+" \""+e.target.nodeValue+"\""+
//                     " (parent "+e.target.parentNode.nodeName+")");
//    }
//    else {
//        debug("nodeInserted "+e.target.nodeName+
//                     " (parent "+e.target.parentNode.nodeName+")");
//    }

    if (isHeadingElement(e.target)) {
        var name = e.target.nodeName;

        var sectionName = getNodeText(e.target);
        debug("new Section: "+sectionName);

        var level = parseInt(name.slice(1));

        var sectionId = "section"+nextOutlineSectionId;
        e.target.setAttribute("id",sectionId);
        nextOutlineSectionId++;

        var prevSection = findPreviousHeading(e.target);

        if (prevSection != null) {
            var prevSectionId = prevSection.getAttribute("id");
            editor.sectionAdded(quoteString(sectionName),sectionId,level,prevSectionId);
        }
        else {
            editor.sectionAdded(quoteString(sectionName),sectionId,level,"");
        }
    }
    else {
        if (e.target.nodeName == "#text")
            e.target.addEventListener("DOMCharacterDataModified",characterDataModified);

        sectionTitleMaybeChanged(e.target);
        ensureValidHierarchy(e.target,true);
    }

    function findPreviousHeading(node)
    {
        var prevHeading = node.previousSibling;
        while ((prevHeading != null) &&
               !isHeadingElement(prevHeading)) {
            prevHeading = prevHeading.previousSibling;
        }
        return prevHeading;
    }
}

function nodeRemoved(e)
{
//    debug("nodeRemoved "+e.target.nodeName);

    var name = e.target.nodeName;
    if (isHeadingElement(e.target)) {
        editor.sectionRemoved(e.target.getAttribute("id"));
    }
    else {
        sectionTitleMaybeChanged(e.target);
    }
}

function addMutationListeners(node)
{
    if ((node.nodeType == Node.ELEMENT_NODE) && (node.getAttribute("id") == "debug2"))
        return;
    var i;
    for (i = node.firstChild; i != null; i = i.nextSibling)
        addMutationListeners(i);
    if (node.nodeName == "#text") {
        node.addEventListener("DOMCharacterDataModified",characterDataModified);
    }
}

function setupMutation()
{
    addMutationListeners(document.body);
    document.addEventListener("DOMNodeInserted",nodeInserted);
    document.addEventListener("DOMNodeRemoved",nodeRemoved);
}

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

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                          Formatting                                            //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

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

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                           Lists                                                //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

function findLIElements(range)
{
    var listItems = new Array();

    var node = range.start.node;
    while (node != null) {

        addListItems(listItems,node);

        if (node == range.end.node)
            break;

        node = nextNode(node);
    }
    return listItems;

    function addListItems(array,node)
    {
        if (node == null)
            return;

        if (node.nodeName == "LI") {
            if (!arrayContains(array,node))
                array.push(node);
            return;
        }

        if (!isWhitespaceTextNode(node))
            addListItems(array,node.parentNode);
    }
}

function increaseIndent()
{
    var range = Range.fromSelection();
    if (range == null)
        return null;

    // Determine the set of LI nodes that are part of the selection
    // Note that these could be spread out all over the place, e.g. in different lists, some in
    // table cells etc
    var listItems = findLIElements(range);

    // For each LI node that is not the first in the list, move it to the child list of
    // its previous sibling (creating the child list if necessary)

    for (var i = 0; i < listItems.length; i++) {
        var li = listItems[i];
        var prevLi = li.previousSibling;
        while ((prevLi != null) && (prevLi.nodeName != "LI"))
            prevLi = prevLi.previousSibling;
        // We can only increase the indentation of the current list item C if there is another
        // list item P immediately preceding C. In this case, C becomes a child of another list
        // L, where L is inside P. L may already exist, or we may need to create it.
        if (prevLi != null) {
            var prevList = lastDescendentList(prevLi);
            var childList = firstDescendentList(li);
            var childListContainer = null;
            if (childList != null) {
                // childList may be contained inside one or more wrapper elements, in which
                // case we set childListContainer to point to the wrapper element that is a
                // child of li. Otherwise childListContainer will just be childList.
                childListContainer = childList;
                while (childListContainer.parentNode != li)
                    childListContainer = childListContainer.parentNode;
            }

            if (prevList != null) {
                prevList.appendChild(li);
                if (childList != null) {
                    while (childList.firstChild != null)
                        prevList.appendChild(childList.firstChild);
                    li.removeChild(childListContainer);
                    // alert("Case 1: prevList and childList");
                }
                else {
                    // alert("Case 2: prevList and no childList");
                }
            }
            else {
                var newList;
                if (childList != null) {
                    // alert("Case 3: no prevList but childList");
                    newList = childList;
                    prevLi.appendChild(childListContainer);
                }
                else {
                    // alert("Case 4: no prevList and no childList");
                    if (li.parentNode.nodeName == "UL")
                        newList = document.createElement("UL");
                    else
                        newList = document.createElement("OL");
                    prevLi.appendChild(newList);
                }
                newList.insertBefore(li,newList.firstChild);
            }
        }
    }

    range.setSelection();

    function firstDescendentList(node)
    {
        while (true) {
            var node = firstChildElement(node);
            if (node == null)
                return null;
            if ((node.nodeName == "UL") || (node.nodeName == "OL"))
                return node;
        }
    }

    function lastDescendentList(node)
    {
        while (true) {
            var node = lastChildElement(node);
            if (node == null)
                return null;
            if ((node.nodeName == "UL") || (node.nodeName == "OL"))
                return node;
        }
    }
}

function decreaseIndent()
{
    var range = Range.fromSelection();
    if (range == null)
        return null;

    // Determine the set of LI nodes that are part of the selection
    // Note that these could be spread out all over the place, e.g. in different lists, some in
    // table cells etc
    var listItems = findLIElements(range);

    // Remove from consideration any list items that are not inside a nested list
    var i = 0;
    while (i < listItems.length) {
        var node = listItems[i];
        var container = findContainingListItem(node.parentNode);
        if (container == null)
            listItems.splice(i,1);
        else
            i++;
    }

    // Remove from consideration any list items that have an ancestor that is going to
    // be moved
    var i = 0;
    var changed;
    while (i < listItems.length) {
        var node = listItems[i];

        var ancestorToBeRemoved = false;
        for (var ancestor = node.parentNode; ancestor != null; ancestor = ancestor.parentNode) {
            if (arrayContains(listItems,ancestor))
                ancestorToBeRemoved = true;
        }

        if (ancestorToBeRemoved)
            listItems.splice(i,1);
        else
            i++;
    }

    // For LI nodes that are in a top-level list, change them to regular paragraphs
    // For LI nodes that are part of a nested list, move them to the parent (this requires
    // splitting the child list in two)
    for (var i = 0; i < listItems.length; i++) {
        var node = listItems[i];
        var parentList = node.parentNode;
        var following = node.nextSibling;
        var container = findContainingListItem(node.parentNode);

        // We can only decrease the indentation of a list node if the list it is in is itself
        // inside another list

        if (following != null) {
            var secondHalf;
            if (parentList.nodeName == "UL")
                secondHalf = document.createElement("UL");
            else
                secondHalf = document.createElement("OL");

            var copy = secondHalf;

            for (var p = parentList.parentNode; p != container; p = p.parentNode) {
                var pcopy = shallowCopyElement(p);
                pcopy.appendChild(copy);
                copy = pcopy;
            }

            node.appendChild(copy);

            while (following != null) {
                var next = following.nextSibling;
                secondHalf.appendChild(following);
                following = next;
            }
        }

        container.parentNode.insertBefore(node,container.nextSibling);
        if (firstChildElement(parentList) == null) {
            parentList.parentNode.removeChild(parentList);
        }
    }

    range.setSelection();

    function findContainingListItem(node)
    {
        if (node == null)
            return null;

        if (node.nodeName == "LI")
            return node;

        return findContainingListItem(node.parentNode);
    }
}

function removeAdjacentWhitespace(node)
{
    while ((node.previousSibling != null) && (isWhitespaceTextNode(node.previousSibling)))
        node.parentNode.removeChild(node.previousSibling);
    while ((node.nextSibling != null) && (isWhitespaceTextNode(node.nextSibling)))
        node.parentNode.removeChild(node.nextSibling);
}

function getListOperationNodes(range)
{
    debug("getListOperationNodes");
    var dca = null;
    for (var ds = range.start.node; ds != null; ds = ds.parentNode) {
        for (var de = range.end.node; de != null; de = de.parentNode) {
            if (ds.parentNode == de.parentNode) {
                dca = ds.parentNode;
                break;
            }
        }
        if (dca != null)
            break;
    }

    while (!isContainerNode(dca)) {
        dca = dca.parentNode;
        ds = ds.parentNode;
        de = de.parentNode;
    }

    var nodes = new Array();

    // If, after moving up the tree until dca is a container node, a single node is selected,
    // check if it is wholly contained within a single list item. If so, select just that
    // list item.
    if (ds == de) {
        for (var ancestor = dca; ancestor != null; ancestor = ancestor.parentNode) {
            if (ancestor.nodeName == "LI") {
                nodes.push(ancestor);
                return nodes;
            }
        }
    }

    for (var child = ds; child != de.nextSibling; child = child.nextSibling) {
        if ((child.nodeName == "UL") || (child.nodeName == "OL")) {
            for (var gc = child.firstChild; gc != null; gc = gc.nextSibling) {
                if (!isWhitespaceTextNode(gc))
                    nodes.push(gc);
            }
        }
        else {
            if (!isWhitespaceTextNode(child))
                nodes.push(child);
        }
    }
    return nodes;
}

function clearList()
{
    debug("clearList()");

    var range = Range.fromSelection();
    if (range == null) {
        debug("no selection");
        return;
    }

    var nodes = getListOperationNodes(range);

    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.nodeName == "LI") {
            var li = node;
            var list = li.parentNode;
            var insertionPoint = null;

            removeAdjacentWhitespace(li);

            if (li.previousSibling == null) {
                debug("setList null: case 1");

                insertionPoint = list;
            }
            else if (li.nextSibling == null) {
                debug("setList null: case 2");
                insertionPoint = list.nextSibling;
            }
            else {
                debug("setList null: case 3");

                var secondList = shallowCopyElement(list);
                list.parentNode.insertBefore(secondList,list.nextSibling);
                while (li.nextSibling != null) {
                    secondList.appendChild(li.nextSibling);
                    removeAdjacentWhitespace(li);
                }

                insertionPoint = secondList;
            }

            while (li.firstChild != null) {
                if (isWhitespaceTextNode(li.firstChild)) {
                    li.removeChild(li.firstChild);
                }
                else if (isInlineNode(li.firstChild)) {
                    var p = document.createElement("p");
                    p.appendChild(li.firstChild);
                    list.parentNode.insertBefore(p,insertionPoint);
                }
                else {
                    list.parentNode.insertBefore(li.firstChild,insertionPoint);
                }
            }

            list.removeChild(li);

            if (list.firstChild == null)
                list.parentNode.removeChild(list);
        }
    }

    range.setSelection();
}

function setList(type)
{
    var range = Range.fromSelection();
    if (range == null) {
        debug("no selection");
        return;
    }

    var nodes = getListOperationNodes(range);

    // Set list to UL or OL

    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var next;
        var prev;
        var li = null;
        var oldList = null;
        var listInsertionPoint;

        if ((node.nodeName == "LI") && (node.parentNode.nodeName == type)) {
            // Already in the correct type of list; don't need to do anything
            continue;
        }

        if ((node.nodeName == "LI")) {
            li = node;
            var list = li.parentNode;

            removeAdjacentWhitespace(list);
            prev = list.previousSibling;
            next = list.nextSibling;


            debug("setList "+type+" (list item): prev "+prev+" next "+next);

            removeAdjacentWhitespace(li);

            if (li.previousSibling == null) {
                debug("setList "+type+" (list item): case 1");

                listInsertionPoint = list;
                next = null;
            }
            else if (li.nextSibling == null) {
                debug("setList "+type+" (list item): case 2");
                listInsertionPoint = list.nextSibling;
                prev = null;
            }
            else {
                debug("setList "+type+" (list item): case 3");

                var secondList = shallowCopyElement(list);
                list.parentNode.insertBefore(secondList,list.nextSibling);
                while (li.nextSibling != null) {
                    secondList.appendChild(li.nextSibling);
                    removeAdjacentWhitespace(li);
                }

                listInsertionPoint = secondList;

                prev = null;
                next = null;
            }

            node = list;
            oldList = list;
        }
        else {
            removeAdjacentWhitespace(node);
            prev = node.previousSibling;
            next = node.nextSibling;
            listInsertionPoint = node;
        }

        var list;
        var itemInsertionPoint;

        if ((prev != null) &&
            (prev.nodeName == type)) {
            debug("setList "+type+": case 1");
            list = prev;
            itemInsertionPoint = null;
        }
        else if ((next != null) &&
                 (next.nodeName == type)) {
            debug("setList "+type+": case 2");
            list = next;
            itemInsertionPoint = list.firstChild;
        }
        else {
            debug("setList "+type+": case 3");
            list = document.createElement(type);
            node.parentNode.insertBefore(list,listInsertionPoint);
            itemInsertionPoint = null;
        }

        if (li != null) {
            list.insertBefore(li,itemInsertionPoint);
        }
        else {
            var li = document.createElement("LI");
            list.insertBefore(li,itemInsertionPoint);
            li.appendChild(node);
        }


        if ((oldList != null) && (oldList.firstChild == null))
            oldList.parentNode.removeChild(oldList);

        // Merge with adjacent list
        removeAdjacentWhitespace(list);
        if ((list.nextSibling != null) && (list.nextSibling.nodeName == type)) {
            var followingList = list.nextSibling;
            while (followingList.firstChild != null) {
                if (isWhitespaceTextNode(followingList.firstChild))
                    followingList.removeChild(followingList.firstChild);
                else
                    list.appendChild(followingList.firstChild);
            }
            followingList.parentNode.removeChild(followingList);
        }
    }

    range.setSelection();
    return;
}

function setUnorderedList()
{
    debug("setUnorderedList()");
    setList("UL");
}

function setOrderedList()
{
    debug("setOrderedList()");
    setList("OL");
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                          Outline                                               //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

var nextOutlineSectionId = 0;

function getOutline()
{
    var found = 0;
    var list = new Array();
    for (var child = document.body.firstChild; child != null; child = child.nextSibling) {
        var name = child.nodeName;
        if (isHeadingElement(child)) {
            list.push({"sectionId": "section"+nextOutlineSectionId,
                       "level": parseInt(name.slice(1)),
                       "name": getNodeText(child) });

            child.setAttribute("id","section"+nextOutlineSectionId);
            nextOutlineSectionId++;
            found++;
        }
    }
    editor.setOutline(list);
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                           Keyboard input and cursor management                                 //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

var prevSelectionNode = null;
var prevSelectionOffset = null;

function checkForSelectionChange()
{
    var selection = window.getSelection();
    if ((selection.focusNode != prevSelectionNode) || (selection.focusOffset != prevSelectionOffset))
        destroyCursorDiv();
    prevSelectionNode = selection.focusNode;
    prevSelectionOffset = selection.focusOffset;
}

// These variables keep track of the portion of the window that is visible on screen (i.e. not
// hidden by the keyboard). We need to keep track of these since scrollIntoViewIfNeeded() does not
// take into account the presence of the keyboard on screen, and every time we move the cursor we
// want to make sure it is visible *above* the keyboard.

var visibleAreaWidth = null;
var visibleAreaHeight = null;

function setVisibleArea(width,height)
{
    visibleAreaWidth = width;
    visibleAreaHeight = height;
    updateCursor();
}

function ensurePointVisible(x,y)
{
    var relX = x - window.scrollX;
    var relY = y - window.scrollY;    
    if ((relX < 0) || (relX >= visibleAreaWidth) || (relY < 0) || (relY >= visibleAreaHeight))
        window.scrollTo(x-visibleAreaWidth/2,y-visibleAreaHeight/2);
}

// We use these instead of selection.focusNode and selection.focusOffset, because the latter has
// a bug where the offset can't be at the end of a space.

var cursorNode = null;
var cursorOffset = null;
var cursorDiv = null;

function createCursorDiv()
{
    if (cursorDiv == null) {
        cursorDiv = document.createElement("DIV");
        cursorDiv.style.position = "absolute";
        cursorDiv.style.width = "2px";
        cursorDiv.style.backgroundColor = "blue";
        cursorDiv.style.opacity = "50%";
        document.body.appendChild(cursorDiv);
    }
}

function destroyCursorDiv()
{
    if (cursorDiv != null) {
        cursorDiv.parentNode.removeChild(cursorDiv);
        cursorDiv = null;
    }
}

function getAbsoluteOffset(node)
{
    var offsetLeft = 0;
    var offsetTop = 0;
    for (; node != null; node = node.parentNode) {
        if (node.offsetLeft != null)
            offsetLeft += node.offsetLeft;
        if (node.offsetTop != null)
            offsetTop += node.offsetTop;
    }
    return { offsetLeft: offsetLeft, offsetTop: offsetTop };
}

function updateCursor()
{
    if (cursorNode != null) {
        debug("updateCursor: cursorNode = "+cursorNode.nodeName+
              ", cursorOffset = "+cursorOffset);
        var range = document.createRange();
        range.setStart(cursorNode,cursorOffset);
        range.setEnd(cursorNode,cursorOffset);
        var rects = range.getClientRects();

        var left;
        var top;
        var height;
        
        if ((rects != null) && (rects.length > 0)) {
            left = rects[0].left + window.scrollX;
            top = rects[0].top + window.scrollY;
            height = rects[0].height;
        }
        else {
            var absolute = getAbsoluteOffset(cursorNode);
            left = absolute.offsetLeft;
            top = absolute.offsetTop;            
            height = cursorNode.parentNode.offsetHeight;
        }
        
        createCursorDiv();
        cursorDiv.style.left = left+"px";
        cursorDiv.style.top = top+"px";
        cursorDiv.style.height = height+"px";
        ensurePointVisible(left,top+height/2);
        return;
    }
    destroyCursorDiv();
}

function setCursorNodeAndOffset(node,offset)
{
    cursorNode = node;
    cursorOffset = offset;
    
    var selection = window.getSelection();
    selection.setBaseAndExtent(cursorNode,cursorOffset,cursorNode,cursorOffset);
    // setBaseAndExtent may actually record a different base node/offset, so make sure that's
    // what we're comparing with in setBaseAndExtent()
    prevSelectionNode = selection.baseNode;
    prevSelectionOffset = selection.baseOffset;
    
    reportSelectionFormatting();
    updateCursor();
}

function positionCursor(x,y)
{
    var zoom = getZoom();
    var range = document.caretRangeFromPoint(x/zoom,y/zoom);
    if (range == null)
        return;
    setCursorNodeAndOffset(range.startContainer,range.startOffset);
}

function moveLeft()
{
    if (cursorNode == null)
        return;
    if ((cursorNode.nodeType == Node.TEXT_NODE) && (cursorOffset > 0)) {
        var newOffset = cursorOffset - 1;
        setCursorNodeAndOffset(cursorNode,newOffset,cursorNode,newOffset);
    }
    else {
        var node = cursorNode;
        do {
            node = prevTextNode(node);
        } while ((node != null) && isWhitespaceTextNode(node) && (node.nodeValue.length > 0));
        if (node != null) {
            var length = node.nodeValue.length;
            setCursorNodeAndOffset(node,length,node,length);
        }
    }
}

function moveRight()
{
    if (cursorNode == null) {
        return;
    }
    if ((cursorNode.nodeType == Node.TEXT_NODE) &&
        (cursorOffset < cursorNode.nodeValue.length)) {
        var newOffset = cursorOffset + 1;
        setCursorNodeAndOffset(cursorNode,newOffset,cursorNode,newOffset);
    }
    else {
        var node = cursorNode;
        do {
            node = nextTextNode(node);
        } while ((node != null) && isWhitespaceTextNode(node) && (node.nodeValue.length > 0));
        if (node != null)
            setCursorNodeAndOffset(node,0,node,0);
    }
}

function insertCharacter(character)
{
    if (cursorNode == null)
        return;
    var node = cursorNode;
    var offset = cursorOffset;
    if (node.nodeType != Node.TEXT_NODE) {
        do {
            node = nextTextNode(node);
            offset = 0;
        } while ((node != null) && isWhitespaceTextNode(node));
    }
    if (node != null) {
        node.insertData(offset,character);
        setCursorNodeAndOffset(node,offset+1,node,offset+1);
    }
    updateCursor();
}

function removeIfEmpty(node)
{
    if (node == null)
        return;
    var parent = node.parentNode;
    if (node.nodeType == Node.TEXT_NODE) {
        if (node.nodeValue.length == 0) {
            parent.removeChild(node);
            removeIfEmpty(parent);
        }
    }
    else if (node.nodeType == Node.ELEMENT_NODE) {
        var haveContent = false;
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            if (!isWhitespaceTextNode(child)) {
                haveContent = true;
                break;
            }
        }
        if (!haveContent) {
            parent.removeChild(node);
            removeIfEmpty(parent);
        }
    }
}

function fixTrailingSpace(node)
{
    if ((node.nodeValue.length > 0) && (node.nodeValue.charAt(node.nodeValue.length-1) == " "))
        node.nodeValue = node.nodeValue.slice(0,node.nodeValue.length-1) + "\u00a0";
}

function isFirstInParagraph(node)
{
    while ((node != null) && isInlineNode(node)) {
        if (node.previousSibling != null)
            return false;
        node = node.parentNode;
    }
    return true;
}

function getParagraph(node)
{
    while ((node != null) && isInlineNode(node)) {
        node = node.parentNode;
    }
    return node;
}

function deleteCharacter()
{
    if (cursorNode == null)
        return;
    if ((cursorNode.nodeType == Node.TEXT_NODE) && (cursorOffset > 0)) {
        cursorNode.nodeValue = cursorNode.nodeValue.slice(0,cursorOffset-1) +
                               cursorNode.nodeValue.slice(cursorOffset);
        fixTrailingSpace(cursorNode);
        setCursorNodeAndOffset(cursorNode,cursorOffset-1);
    }
    else {
        if (isFirstInParagraph(cursorNode)) {
            var paragraph = getParagraph(cursorNode);
            if ((paragraph != null) && (paragraph.previousSibling != null)) {
                var prev = paragraph.previousSibling;
                
                while ((prev != null) && isWhitespaceTextNode(prev)) {
                    var prev2 = prev.previousSibling;
                    prev.parentNode.removeChild(prev);
                    prev = prev2;
                }
                
                if ((prev != null) && (prev.nodeType == Node.ELEMENT_NODE)) {
                    while (paragraph.firstChild != null)
                        prev.appendChild(paragraph.firstChild);
                    paragraph.parentNode.removeChild(paragraph);
                }
                updateCursor();
            }
        }
        else {
            var node = cursorNode;
            do {
                node = prevTextNode(node);
            } while ((node != null) && isWhitespaceTextNode(node));
            if (node != null) {
                node.nodeValue = node.nodeValue.slice(0,node.nodeValue.length-1);
                fixTrailingSpace(node);
                setCursorNodeAndOffset(node,node.nodeValue.length);
            }
            removeIfEmpty(cursorNode);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                          General                                               //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

function getZoom()
{
    return window.outerWidth/window.innerWidth;
}

function getOrCreateHead()
{
    var html = document.documentElement;
    for (var child = html.firstChild; child != null; child = child.nextSibling) {
        if (child.nodeName == "HEAD")
            return child;
    }
    var head = document.createElement("HEAD");
    html.insertBefore(head,html.firstChild);
    return head;
}

var viewportMetaElement = null;

function setViewportWidth(width)
{
    if (viewportMetaElement == null) {
        var head = getOrCreateHead();
        for (var child = head.firstChild; child != null; child = child.nextSibling) {
            if ((child.nodeName == "META") && (child.getAttribute("name") == "viewport")) {
                viewportMetaElement = child;
                break;
            }
        }
        if (viewportMetaElement == null) {
            viewportMetaElement = document.createElement("META");
            viewportMetaElement.setAttribute("name","viewport");
            head.appendChild(viewportMetaElement);
        }
    }
    viewportMetaElement.setAttribute("content","width = "+width);
    updateCursor();
}

function getStyles()
{
    var list = new Array();
    for (var i = 0; i < document.styleSheets.length; i++) {
        var sheet = document.styleSheets[i];
        // debug(sheet);
//        alert("here");
//        alert("sheet = "+sheet);
        var str = "";
        for (name in sheet)
            str += name+"\n";
//        alert("Sheet properties:\n"+str);
//        alert("sheet.rules = "+sheet.rules);
        for (var j = 0; j < sheet.cssRules.length; j++) {
            var rule = sheet.cssRules[j];
            // debug("  (applies to "+rule.selectorText+")");
            if (rule.type == CSSRule.STYLE_RULE) {
                // debug("  "+rule.cssText);
                // for (k = 0; k < rule.style.length; k++)
                //     debug("    "+rule.style[k]+" "+rule.style.getPropertyValue(rule.style[k]));

                var obj = new Object();
                obj.selector = rule.selectorText;
                for (k = 0; k < rule.style.length; k++)
                    obj[rule.style[k]] = rule.style.getPropertyValue(rule.style[k]);
                list.push(obj);
            }
        }
    }
    editor.setStyles(encodeJSON(list));
}

function jumpToSection(sectionId)
{
    var section = document.getElementById(sectionId);
    var location = webkitConvertPointFromNodeToPage(section,
                                                    new WebKitPoint(0,0));
    window.scrollTo(0,location.y);
}

function getHTML()
{
    try {
        var serializer = new XMLSerializer();
        var xml = serializer.serializeToString(document);
        editor.getHTMLResponse(xml);
    }
    catch (e) {
        editor.getHTMLError(e.toString());
    }
}

function enterPressed()
{
    var selection = window.getSelection();
    var node = selection.focusNode;
    var offset = selection.focusOffset;
    if (node != null) {
        ensureValidHierarchy(node);
        if (node.nodeType == Node.TEXT_NODE)
            splitTextBefore(node,offset);

        if (isParagraphNode(node)) {
            // Special case for when the cursor is in an empty paragraph (one that simply
            // contains a BR element); in this case the focus node is the paragraph element
            // itself, because there is no text node.
            debug("enterPressed case 1");
            var copy = makeNew(node,null);
            setCursorNodeAndOffset(copy,0,copy,0);
            return;
        }

        for (var child = node; child.parentNode != null; child = child.parentNode) {
            if (isParagraphNode(child.parentNode)) {
                debug("enterPressed case 2");
                debug("child is \""+getNodeText(child)+"\"");
                debug("child.parentNode is \""+getNodeText(child.parentNode)+"\"");
                makeNew(child.parentNode,child);
                setCursorNodeAndOffset(node,0,node,0);
                return;
            }
        }
    }


}

function makeNew(paragraph,child)
{
    var copy = shallowCopyElement(paragraph);

    removeAdjacentWhitespace(paragraph);

    // If the cursor is in the last paragraph of a list item, we need to
    // add another list item rather than another paragraph
    if (paragraph.parentNode.nodeName == "LI") {
        var li = paragraph.parentNode;
        var liCopy = shallowCopyElement(li);
        li.parentNode.insertBefore(liCopy,li.nextSibling);
        liCopy.appendChild(copy);

        // For list items, we want to put all futher paragraphs inside the old list item
        // inside the new one as well
        var follow = paragraph.nextSibling;
        while (follow != null) {
            var next = follow.nextSibling;
            liCopy.appendChild(follow);
            follow = next;
        }
    }
    else {
        paragraph.parentNode.insertBefore(copy,paragraph.nextSibling);
    }

    while (child != null) {
        var next = child.nextSibling;
        copy.appendChild(child);
        child = next;
    }

    fixEmptyParagraph(copy);
    fixEmptyParagraph(paragraph);
    return copy;
}

// An empty paragraph does not get shown and cannot be edited. We can fix this by adding
// a BR element as a child
function fixEmptyParagraph(paragraph)
{
    if (getNodeText(paragraph) == "")
        paragraph.appendChild(document.createElement("BR"));
}

function keydown(e)
{
    if (e.keyCode == '\r'.charCodeAt(0)) {
        e.preventDefault();
        enterPressed();
    }
}

// Remove the temporary <script> element that was added to the document to execute this file
// so it's not saved with the document
var initscript = document.getElementById("initscript");
if (initscript != null) {
    initscript.parentNode.removeChild(initscript);
}

var jsInitOk = false;
try {
    document.onclick = reportSelectionFormatting;
//    document.body.contentEditable = true;
//    document.body.style.padding = "15%";
    document.body.style.padding = "5%";
    document.body.style.textAlign = "justify";
    window.onkeydown = keydown;

    setupMutation();
    getOutline();
    getStyles();
    jsInitOk = true;
}
catch (e) {
    editor.jsInterfaceInitError(e.stack);
}

if (jsInitOk)
    editor.jsInterfaceInitFinished();
