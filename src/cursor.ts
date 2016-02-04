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

import Clipboard = require("./clipboard");
import DOM = require("./dom");
import ElementTypes = require("./elementTypes");
import Formatting = require("./formatting");
import Hierarchy = require("./hierarchy");
import Outline = require("./outline");
import Position = require("./position");
import Range = require("./range");
import Selection = require("./selection");
import Styles = require("./styles");
import Traversal = require("./traversal");
import Types = require("./types");
import UndoManager = require("./undo");
import Util = require("./util");

var cursorX = null;

export function ensurePositionVisible(pos,center?) {
    // If we can't find the cursor rect for some reason, just don't do anything.
    // This is better than using an incorrect position or throwing an exception.
    var rect = Position.displayRectAtPos(pos)
    if (rect != null) {
        var extraSpace = 4;

        var cursorTop = rect.top + window.scrollY - extraSpace;
        var cursorBottom = rect.top + rect.height + window.scrollY + extraSpace;

        var windowTop = window.scrollY;
        var windowBottom = window.scrollY + window.innerHeight;

        if (center) {
            var newY = Math.floor(cursorTop + rect.height/2 - window.innerHeight/2);
            window.scrollTo(window.scrollX,newY);
        }
        else if (cursorTop < windowTop) {
            window.scrollTo(window.scrollX,cursorTop);
        }
        else if (cursorBottom > windowBottom) {
            window.scrollTo(window.scrollX,cursorBottom - window.innerHeight);
        }
    }
}

// public
export function ensureCursorVisible(center?) {
    var selRange = Selection.get();
    if (selRange != null)
        ensurePositionVisible(selRange.end,center);
}

export function scrollDocumentForY(y) {
    var absY = window.scrollY + y;
    if (absY-44 < window.scrollY) {
        window.scrollTo(window.scrollX,absY-44);
        y = absY - window.scrollY;
    }
    else if (absY+44 >= window.scrollY + window.innerHeight) {
        window.scrollTo(window.scrollX,absY+44 - window.innerHeight);
        y = absY - window.scrollY;
    }
    return y;
}

// public
export function positionCursor(x,y,wordBoundary) {
    if (UndoManager.groupType() != "Cursor movement")
        UndoManager.newGroup("Cursor movement");

    y = scrollDocumentForY(y);

    var result = null;
    var position = Position.atPoint(x,y);
    if (position == null)
        return null;

    var node = Position.closestActualNode(position);
    for (; node != null; node = node.parentNode) {
        var type = node._type;
        if ((type == ElementTypes.HTML_A) &&
            (node.hasAttribute("href")) &&
            (result == null)) {

            var arange = new Range.Range(node,0,node,node.childNodes.length);
            var rects = Range.getClientRects(arange);
            var insideLink = false;
            for (var i = 0; i < rects.length; i++) {
                if (Util.rectContainsPoint(rects[i],x,y))
                    insideLink = true;
            }

            if (insideLink) {
                var href = node.getAttribute("href");
                if ((href != null) && (href.charAt(0) == "#")) {
                    if (Types.isInTOC(node))
                        result = "intocreference-"+href.substring(1);
                    else
                        result = "inreference";
                }
                else {
                    result = "inlink";
                }
            }
        }
        else if ((type == ElementTypes.HTML_IMG) && (result == null)) {
            for (var anc = node; anc != null; anc = anc.parentNode) {
                if (anc._type == ElementTypes.HTML_FIGURE) {
                    result = "infigure";
                    break;
                }
            }
        }
        else if (Types.isAutoCorrectNode(node) && (result == null)) {
            result = "incorrection";
        }
        else if (Types.isTOCNode(node)) {
            var rect = node.getBoundingClientRect();
            if (x >= rect.left + rect.width/2)
                position = new Position.Position(node.parentNode,DOM.nodeOffset(node)+1);
            else
                position = new Position.Position(node.parentNode,DOM.nodeOffset(node));
            break;
        }
    }

    var position = Position.closestMatchForwards(position,Position.okForMovement);
    if ((position != null) && Types.isOpaqueNode(position.node))
        position = Position.nextMatch(position,Position.okForMovement);
    if (position == null)
        return false;

    var selectionRange = Selection.get();
    var samePosition = ((selectionRange != null) && Range.isEmpty(selectionRange) &&
                        (position.node == selectionRange.start.node) &&
                        (position.offset == selectionRange.start.offset));
    if (samePosition && (result == null))
        result = "same";

    if (wordBoundary) {
        var startOfWord = Selection.posAtStartOfWord(position);
        var endOfWord = Selection.posAtEndOfWord(position);
        if ((startOfWord.node != position.node) || (startOfWord.node != position.node))
            throw new Error("Word boundary in different node");
        var distanceBefore = position.offset - startOfWord.offset;
        var distanceAfter = endOfWord.offset - position.offset;
        if (distanceBefore <= distanceAfter)
            position = startOfWord;
        else
            position = endOfWord;
    }

    set(position.node,position.offset);
    return result;
}

// public
export function getCursorPosition() {
    var selRange = Selection.get();
    if (selRange == null)
        return null;

    // FIXME: in the cases where this is called from Objective C, test what happens if we
    // return a null rect
    var rect = Position.displayRectAtPos(selRange.end);
    if (rect == null)
        return null;

    var left = rect.left + window.scrollX;
    var top = rect.top + window.scrollY;
    var height = rect.height;
    return { x: left, y: top, width: 0, height: height };
}

// public
export function moveLeft() {
    var range = Selection.get();
    if (range == null)
        return;

    var pos = Position.prevMatch(range.start,Position.okForMovement);
    if (pos != null)
        set(pos.node,pos.offset);
    ensureCursorVisible();
}

// public
export function moveRight() {
    var range = Selection.get();
    if (range == null)
        return;

    var pos = Position.nextMatch(range.start,Position.okForMovement);
    if (pos != null)
        set(pos.node,pos.offset);
    ensureCursorVisible();
}

// public
export function moveToStartOfDocument() {
    var pos = new Position.Position(document.body,0);
    pos = Position.closestMatchBackwards(pos,Position.okForMovement);
    set(pos.node,pos.offset);
    ensureCursorVisible();
}

// public
export function moveToEndOfDocument() {
    var pos = new Position.Position(document.body,document.body.childNodes.length);
    pos = Position.closestMatchForwards(pos,Position.okForMovement);
    set(pos.node,pos.offset);
    ensureCursorVisible();
}

// An empty paragraph does not get shown and cannot be edited. We can fix this by adding
// a BR element as a child
// public
export function updateBRAtEndOfParagraph(node) {
    var paragraph = node;
    while ((paragraph != null) && !Types.isParagraphNode(paragraph))
        paragraph = paragraph.parentNode;
    if (paragraph != null) {

        var br = null;
        var last = paragraph;
        do {

            var child = last;
            while ((child != null) && Traversal.isWhitespaceTextNode(child))
                child = child.previousSibling;

            if ((child != null) && (child._type == ElementTypes.HTML_BR))
                br = child;

            last = last.lastChild;

        } while ((last != null) && Types.isInlineNode(last));

        if (Util.nodeHasContent(paragraph)) {
            // Paragraph has content: don't want BR at end
            if (br != null) {
                DOM.deleteNode(br);
            }
        }
        else {
            // Paragraph consists only of whitespace: must have BR at end
            if (br == null) {
                br = DOM.createElement(document,"BR");
                DOM.appendChild(paragraph,br);
            }
        }
    }
}

// public
export function insertReference(itemId) {
    var a = DOM.createElement(document,"A");
    DOM.setAttribute(a,"href","#"+itemId);
    Clipboard.pasteNodes([a]);
}

// public
export function insertLink(text,url) {
    var a = DOM.createElement(document,"A");
    DOM.setAttribute(a,"href",url);
    DOM.appendChild(a,DOM.createTextNode(document,text));
    Clipboard.pasteNodes([a]);
}

var nbsp = String.fromCharCode(160);

function spaceToNbsp(pos) {
    var node = pos.node;
    var offset = pos.offset;

    if ((node.nodeType == Node.TEXT_NODE) && (offset > 0) &&
        (Util.isWhitespaceString(node.nodeValue.charAt(offset-1)))) {
        // Insert first, to preserve any tracked positions
        DOM.insertCharacters(node,offset-1,nbsp);
        DOM.deleteCharacters(node,offset,offset+1);
    }
}

function nbspToSpace(pos) {
    var node = pos.node;
    var offset = pos.offset;

    if ((node.nodeType == Node.TEXT_NODE) && (offset > 0) &&
        (node.nodeValue.charAt(offset-1) == nbsp)) {
        // Insert first, to preserve any tracked positions
        DOM.insertCharacters(node,offset-1," ");
        DOM.deleteCharacters(node,offset,offset+1);
    }
}

function checkNbsp() {
    Selection.preserveWhileExecuting(function() {
        var selRange = Selection.get();
        if (selRange != null)
            nbspToSpace(selRange.end);
    });
}

function isPosAtStartOfParagraph(pos) {
    if ((pos.node.nodeType == Node.ELEMENT_NODE) && (pos.offset == 0) &&
        !Types.isInlineNode(pos.node)) {
        return true;
    }



    while (pos != null) {
        if (pos.node.nodeType == Node.ELEMENT_NODE) {
            if ((pos.offset == 0) && !Types.isInlineNode(pos.node))
                return true;
            else
                pos = Position.prev(pos);
        }
        else if (pos.node.nodeType == Node.TEXT_NODE) {
            if (pos.offset > 0)
                return false;
            else
                pos = Position.prev(pos);
        }
        else {
            return false;
        }
    }

    return false;
}

// public
export function insertCharacter(str,allowInvalidPos,allowNoParagraph) {
    var firstInsertion = (UndoManager.groupType() != "Insert text");

    if (firstInsertion)
        UndoManager.newGroup("Insert text",checkNbsp);

    if (str == "-") {
        var preceding = getPrecedingWord();
        if (preceding.match(/[0-9]\s*$/))
            str = String.fromCharCode(0x2013); // en dash
        else if (preceding.match(/\s+$/))
            str = String.fromCharCode(0x2014); // em dash
    }

    var selRange = Selection.get();
    if (selRange == null)
        return;

    if (!Range.isEmpty(selRange)) {
        Selection.deleteContents(true);
        selRange = Selection.get();
    }
    var pos = selRange.start;
    pos = Position.preferTextPosition(pos);
    if ((str == " ") && isPosAtStartOfParagraph(pos))
        return;
    if (!allowInvalidPos && !Position.okForInsertion(pos)) {
        var elemPos = Position.preferElementPosition(pos);
        if (Position.okForInsertion(elemPos)) {
            pos = elemPos;
        }
        else {
            var oldPos = pos;
            pos = Position.closestMatchForwards(selRange.start,Position.okForInsertion);
            var difference = new Range.Range(oldPos.node,oldPos.offset,pos.node,pos.offset);
            difference = Range.forwards(difference);
            Position.trackWhileExecuting([pos],function() {
                if (!Range.hasContent(difference)) {
                    Selection.deleteRangeContents(difference,true);
                }
            });
        }
    }
    var node = pos.node;
    var offset = pos.offset;

    if ((str == " ") &&
        !firstInsertion &&
        (node.nodeType == Node.TEXT_NODE) &&
        (offset > 0) &&
        (node.nodeValue.charAt(offset-1) == nbsp)) {

        if (!node.nodeValue.substring(0,offset).match(/\.\s+$/)) {
            DOM.deleteCharacters(node,offset-1,offset);
            DOM.insertCharacters(node,offset-1,".");
        }
    }

    if (Util.isWhitespaceString(str) && (node.nodeType == Node.TEXT_NODE) && (offset > 0)) {
        var prevChar = node.nodeValue.charAt(offset-1);
        if (Util.isWhitespaceString(prevChar) || (prevChar == nbsp)) {
            Selection.update();
            ensureCursorVisible();
            return;
        }
    }

    nbspToSpace(pos);

    // If the user enters two double quotes in succession (open and close), replace them with
    // just one plain double quote character
    if ((str == "”") && (node.nodeType == Node.TEXT_NODE) &&
        (offset > 0) && (node.nodeValue.charAt(offset-1) == "“")) {
        DOM.deleteCharacters(node,offset-1,offset);
        offset--;
        str = "\"";
    }

    if (node.nodeType == Node.ELEMENT_NODE) {
        var emptyTextNode = DOM.createTextNode(document,"");
        if (offset >= node.childNodes.length)
            DOM.appendChild(node,emptyTextNode);
        else
            DOM.insertBefore(node,emptyTextNode,node.childNodes[offset]);
        node = emptyTextNode;
        offset = 0;
    }

    if (str == " ")
        DOM.insertCharacters(node,offset,nbsp);
    else
        DOM.insertCharacters(node,offset,str);

            // must be done *after* inserting the text
    if (!allowNoParagraph) {
        switch (node.parentNode._type) {
        case ElementTypes.HTML_CAPTION:
        case ElementTypes.HTML_FIGCAPTION:
            // Do nothing
            break;
        default:
            Hierarchy.ensureInlineNodesInParagraph(node,true);
            break;
        }
    }

    offset += str.length;

    pos = new Position.Position(node,offset);
    Position.trackWhileExecuting([pos],function() {
        Formatting.mergeWithNeighbours(pos.node,Formatting.MERGEABLE_INLINE);
    });

    set(pos.node,pos.offset);
    Range.trackWhileExecuting(Selection.get(),function() {
        updateBRAtEndOfParagraph(pos.node);
    });

    Selection.update();
    ensureCursorVisible();
}

function tryDeleteEmptyCaption(pos) {
    var caption = Position.captionAncestor(pos);
    if ((caption == null) || Util.nodeHasContent(caption))
        return false;

    var container = Position.figureOrTableAncestor(pos);
    if (container == null)
        return false;

    set(container.parentNode,DOM.nodeOffset(container)+1);
    Selection.preserveWhileExecuting(function() {
        DOM.deleteNode(caption);
    });

    return true;
}

function tryDeleteEmptyNote(pos) {
    var note = Position.noteAncestor(pos);
    if ((note == null) || Util.nodeHasContent(note))
        return false;

    var parent = note.parentNode;
    set(note.parentNode,DOM.nodeOffset(note)+1);
    Selection.preserveWhileExecuting(function() {
        DOM.deleteNode(note);
    });

    return true;
}

// public
export function deleteCharacter() {
    if (UndoManager.groupType() != "Delete text")
        UndoManager.newGroup("Delete text",checkNbsp);

    Selection.preferElementPositions();
    var selRange = Selection.get();
    if (selRange == null)
        return;

    if (!Range.isEmpty(selRange)) {
        Selection.deleteContents(true);
    }
    else {
        var currentPos = selRange.start;

        // Special cases of pressing backspace after a table, figure, TOC, hyperlink,
        // footnote, or endnote. For each of these we delete the whole thing.
        var back = Position.closestMatchBackwards(currentPos,Position.okForMovement);
        if ((back != null) && (back.node.nodeType == Node.ELEMENT_NODE) && (back.offset > 0)) {
            var prevNode = back.node.childNodes[back.offset-1];
            if (Types.isSpecialBlockNode(prevNode)) {
                var p = DOM.createElement(document,"P");
                DOM.insertBefore(prevNode.parentNode,p,prevNode);
                DOM.deleteNode(prevNode);
                updateBRAtEndOfParagraph(p);
                set(p,0);
                ensureCursorVisible();
                return;
            }
            if ((prevNode._type == ElementTypes.HTML_A) || Types.isNoteNode(prevNode)) {
                set(back.node,back.offset-1);
                Selection.preserveWhileExecuting(function() {
                    DOM.deleteNode(prevNode);
                });
                return;
            }
        }

        // Backspace inside an empty figure or table caption
        if (tryDeleteEmptyCaption(currentPos))
            return;

        currentPos = Position.preferTextPosition(currentPos);
        var prevPos = Position.prevMatch(currentPos,Position.okForMovement);

        // Backspace inside or just after a footnote or endnote
        if (tryDeleteEmptyNote(currentPos))
            return;
        if ((prevPos != null) && tryDeleteEmptyNote(prevPos))
            return;

        if (prevPos != null) {
            var startBlock = firstBlockAncestor(Position.closestActualNode(prevPos));
            var endBlock = firstBlockAncestor(Position.closestActualNode(selRange.end));
            if ((startBlock != endBlock) &&
                Types.isParagraphNode(startBlock) && !Util.nodeHasContent(startBlock)) {
                DOM.deleteNode(startBlock);
                set(selRange.end.node,selRange.end.offset)
            }
            else {
                var range = new Range.Range(prevPos.node,prevPos.offset,
                                      selRange.end.node,selRange.end.offset);
                Selection.deleteRangeContents(range,true);
            }
        }
    }

    selRange = Selection.get();
    if (selRange != null)
        spaceToNbsp(selRange.end);
    Selection.update();
    ensureCursorVisible();

    function firstBlockAncestor(node) {
        while (Types.isInlineNode(node))
            node = node.parentNode;
        return node;
    }
}

// public
export function enterPressed() {
    UndoManager.newGroup("New paragraph");

    Selection.preferElementPositions();
    var selRange = Selection.get();
    if (selRange == null)
        return;

    Range.trackWhileExecuting(selRange,function() {
        if (!Range.isEmpty(selRange))
            Selection.deleteContents(true);
    });

    // Are we inside a figure or table caption? If so, put an empty paragraph directly after it
    var inCaption = false;
    var inFigCaption = false;
    var closestNode = Position.closestActualNode(selRange.start);
    for (var ancestor = closestNode; ancestor != null; ancestor = ancestor.parentNode) {
        switch (ancestor._type) {
        case ElementTypes.HTML_CAPTION:
            inCaption = true;
            break;
        case ElementTypes.HTML_FIGCAPTION:
            inFigCaption = true;
            break;
        case ElementTypes.HTML_TABLE:
        case ElementTypes.HTML_FIGURE:
            if ((inCaption && (ancestor._type == ElementTypes.HTML_TABLE)) ||
                (inFigCaption && (ancestor._type == ElementTypes.HTML_FIGURE))) {
                var p = DOM.createElement(document,"P");
                DOM.insertBefore(ancestor.parentNode,p,ancestor.nextSibling);
                updateBRAtEndOfParagraph(p);
                Selection.set(p,0,p,0);
                return;
            }
            break;
        }
    }

    // Are we inside a footnote or endnote? If so, move the cursor immediately after it
    var note = null;
    if (selRange.start.node.nodeType == Node.TEXT_NODE) {
        note = Position.noteAncestor(selRange.start);
    }
    else {
        // We can't use Position.noteAncestor in this case, because we want to to break
        // the paragraph *before* the note, not after
        var checkNode = selRange.start.node;
        for (var anc = checkNode; anc != null; anc = anc.parentNode) {
            if (Types.isNoteNode(anc)) {
                note = anc;
                break;
            }
        }
    }
    if (note != null) {
        var noteOffset = DOM.nodeOffset(note);
        selRange = new Range.Range(note.parentNode,noteOffset+1,note.parentNode,noteOffset+1);
    }

    var check = Position.preferElementPosition(selRange.start);
    if (check.node.nodeType == Node.ELEMENT_NODE) {
        var before = check.node.childNodes[check.offset-1];
        var after = check.node.childNodes[check.offset];
        if (((before != null) && Types.isSpecialBlockNode(before)) ||
            ((after != null) && Types.isSpecialBlockNode(after))) {
            var p = DOM.createElement(document,"P");
            DOM.insertBefore(check.node,p,check.node.childNodes[check.offset]);
            updateBRAtEndOfParagraph(p);
            set(p,0);
            ensureCursorVisible();
            return;
        }
    }

    Range.trackWhileExecuting(selRange,function() {
        Range.ensureInlineNodesInParagraph(selRange);
        Range.ensureValidHierarchy(selRange);
    });

    var pos = selRange.start;

    var detail = Range.detail(selRange);
    switch (detail.startParent._type) {
    case ElementTypes.HTML_OL:
    case ElementTypes.HTML_UL: {
        var li = DOM.createElement(document,"LI");
        DOM.insertBefore(detail.startParent,li,detail.startChild);

        set(li,0);
        ensureCursorVisible();
        return;
    }
    }

    if (Types.isAutoCorrectNode(pos.node)) {
        pos = Position.preferTextPosition(pos);
        selRange.start = selRange.end = pos;
    }

    Range.trackWhileExecuting(selRange,function() {

        // If we're directly in a container node, add a paragraph, so we have something to
        // split.
        if (Types.isContainerNode(pos.node) && (pos.node._type != ElementTypes.HTML_LI)) {
            var p = DOM.createElement(document,"P");
            DOM.insertBefore(pos.node,p,pos.node.childNodes[pos.offset]);
            pos = new Position.Position(p,0);
        }

        var blockToSplit = getBlockToSplit(pos);
        var stopAt = blockToSplit.parentNode;

        if (positionAtStartOfHeading(pos)) {
            var container = getContainerOrParagraph(pos.node);
            pos = new Position.Position(container,0);
            pos = Formatting.movePreceding(pos,function(n) { return (n == stopAt); },true);
        }
        else if (pos.node.nodeType == Node.TEXT_NODE) {
            pos = Formatting.splitTextAfter(pos,function(n) { return (n == stopAt); },true);
        }
        else {
            pos = Formatting.moveFollowing(pos,function(n) { return (n == stopAt); },true);
        }
    });

    set(pos.node,pos.offset);
    selRange = Selection.get();

    Range.trackWhileExecuting(selRange,function() {
        if ((pos.node.nodeType == Node.TEXT_NODE) && (pos.node.nodeValue.length == 0)) {
            DOM.deleteNode(pos.node);
        }

        var detail = Range.detail(selRange);

        // If a preceding paragraph has become empty as a result of enter being pressed
        // while the cursor was in it, then update the BR at the end of the paragraph
        var start = detail.startChild ? detail.startChild : detail.startParent;
        for (var ancestor = start; ancestor != null; ancestor = ancestor.parentNode) {
            var prev = ancestor.previousSibling;
            if ((prev != null) && Types.isParagraphNode(prev) && !Util.nodeHasContent(prev)) {
                DOM.deleteAllChildren(prev);
                updateBRAtEndOfParagraph(prev);
                break;
            }
            else if ((prev != null) && (prev._type == ElementTypes.HTML_LI) && !Util.nodeHasContent(prev)) {
                var next;
                for (var child = prev.firstChild; child != null; child = next) {
                    next = child.nextSibling;
                    if (Traversal.isWhitespaceTextNode(child))
                        DOM.deleteNode(child);
                    else
                        updateBRAtEndOfParagraph(child);
                }
                break;
            }
        }

        for (var ancestor = start; ancestor != null; ancestor = ancestor.parentNode) {

            if (Types.isParagraphNode(ancestor)) {
                var nextSelector = Styles.nextSelectorAfter(ancestor);
                if (nextSelector != null) {
                    var nextElementName = null;
                    var nextClassName = null;


                    var dotIndex = nextSelector.indexOf(".");
                    if (dotIndex >= 0) {
                        nextElementName = nextSelector.substring(0,dotIndex);
                        nextClassName = nextSelector.substring(dotIndex+1);
                    }
                    else {
                        nextElementName = nextSelector;
                    }

                    ancestor = DOM.replaceElement(ancestor,nextElementName);
                    DOM.removeAttribute(ancestor,"id");
                    DOM.setAttribute(ancestor,"class",nextClassName);
                }
            }

            if (Types.isParagraphNode(ancestor) && !Util.nodeHasContent(ancestor)) {
                updateBRAtEndOfParagraph(prev);
                break;
            }
            else if ((ancestor._type == ElementTypes.HTML_LI) && !Util.nodeHasContent(ancestor)) {
                DOM.deleteAllChildren(ancestor);
                break;
            }
        }

        updateBRAtEndOfParagraph(Range.singleNode(selRange));
    });

    Selection.set(selRange.start.node,selRange.start.offset,
                  selRange.end.node,selRange.end.offset);
    cursorX = null;
    ensureCursorVisible();

    function getBlockToSplit(pos) {
        var blockToSplit = null;
        for (var n = pos.node; n != null; n = n.parentNode) {
            if (n._type == ElementTypes.HTML_LI) {
                blockToSplit = n;
                break;
            }
        }
        if (blockToSplit == null) {
            blockToSplit = pos.node;
            while (Types.isInlineNode(blockToSplit))
                blockToSplit = blockToSplit.parentNode;
        }
        return blockToSplit;
    }

    function getContainerOrParagraph(node) {
        while ((node != null) && Types.isInlineNode(node))
            node = node.parentNode;
        return node;
    }

    function positionAtStartOfHeading(pos) {
        var container = getContainerOrParagraph(pos.node);
        if (Types.isHeadingNode(container)) {
            var startOffset = 0;
            if (Types.isOpaqueNode(container.firstChild))
                startOffset = 1;
            var range = new Range.Range(container,startOffset,pos.node,pos.offset);
            return !Range.hasContent(range);
        }
        else
            return false;
    }
}

export function getPrecedingWord() {
    var selRange = Selection.get();
    if ((selRange == null) && !Range.isEmpty(selRange))
        return "";

    var node = selRange.start.node;
    var offset = selRange.start.offset;
    if (node.nodeType != Node.TEXT_NODE)
        return "";

    return node.nodeValue.substring(0,offset);
}

export function getAdjacentNodeWithType(type) {
    var selRange = Selection.get();
    var pos = Position.preferElementPosition(selRange.start);
    var node = pos.node;
    var offset = pos.offset;

    while (true) {

        if (node._type == type)
            return node;

        if (node.nodeType == Node.ELEMENT_NODE) {
            var before = node.childNodes[offset-1];
            if ((before != null) && (before._type == type))
                return before;

            var after = node.childNodes[offset];
            if ((after != null) && (after._type == type))
                return after;
        }

        if (node.parentNode == null)
            return null;

        offset = DOM.nodeOffset(node);
        node = node.parentNode;
    }
}

export function getLinkProperties() {
    var a = getAdjacentNodeWithType(ElementTypes.HTML_A);
    if (a == null)
        return null;

    return { href: a.getAttribute("href"),
             text: Traversal.getNodeText(a) };
}

export function setLinkProperties(properties) {
    var a = getAdjacentNodeWithType(ElementTypes.HTML_A);
    if (a == null)
        return null;

    Selection.preserveWhileExecuting(function() {
        DOM.setAttribute(a,"href",properties.href);
        DOM.deleteAllChildren(a);
        DOM.appendChild(a,DOM.createTextNode(document,properties.text));
    });
}

export function setReferenceTarget(itemId) {
    var a = getAdjacentNodeWithType(ElementTypes.HTML_A);
    if (a != null)
        Outline.setReferenceTarget(a,itemId);
}

// Deletes the current selection contents and ensures that the cursor is located directly
// inside the nearest container element, i.e. not inside a paragraph or inline node. This
// is intended for preventing things like inserting a table of contants inside a heading
export function makeContainerInsertionPoint() {
    var selRange = Selection.get();
    if (selRange == null)
        return;

    if (!Range.isEmpty(selRange)) {
        Selection.deleteContents();
        selRange = Selection.get();
    }

    var parent;
    var previousSibling;
    var nextSibling;

    if (selRange.start.node.nodeType == Node.ELEMENT_NODE) {
        parent = selRange.start.node;
        nextSibling = selRange.start.node.childNodes[selRange.start.offset];
    }
    else {
        if (selRange.start.offset > 0)
            Formatting.splitTextBefore(selRange.start);
        parent = selRange.start.node.parentNode;
        nextSibling = selRange.start.node;
    }

    var offset = DOM.nodeOffset(nextSibling,parent);

    if (Types.isContainerNode(parent)) {
        set(parent,offset);
        return;
    }

    if ((offset > 0) && Types.isItemNumber(parent.childNodes[offset-1]))
        offset--;

    Formatting.moveFollowing(new Position.Position(parent,offset),Types.isContainerNode);
    Formatting.movePreceding(new Position.Position(parent,offset),Types.isContainerNode);

    offset = 0;
    while (!Types.isContainerNode(parent)) {
        var old = parent;
        offset = DOM.nodeOffset(parent);
        parent = parent.parentNode;
        DOM.deleteNode(old);
    }

    set(parent,offset);
    cursorX = null;
}

export function set(node,offset,keepCursorX?) {
    Selection.set(node,offset,node,offset);
    if (!keepCursorX)
        cursorX = null;
}

function moveRangeOutsideOfNote(range) {
    var node = range.start.node;
    var offset = range.start.offset;

    for (var anc = node; anc != null; anc = anc.parentNode) {
        if (Types.isNoteNode(anc) && (anc.parentNode != null)) {
            node = anc.parentNode;
            offset = DOM.nodeOffset(anc)+1;
            return new Range.Range(node,offset,node,offset);
        }
    }

    return range;
}

function insertNote(className,content) {
    var footnote = DOM.createElement(document,"span");
    DOM.setAttribute(footnote,"class",className);
    DOM.appendChild(footnote,DOM.createTextNode(document,content));

    var range = Selection.get();
    range = moveRangeOutsideOfNote(range);
    Formatting.splitAroundSelection(range,false);

    // If we're part-way through a text node, splitAroundSelection will give us an
    // empty text node between the before and after text. For formatting purposes that's
    // fine (not sure if necessary), but when inserting a footnote or endnote we want
    // to avoid this as it causes problems with cursor movement - specifically, the cursor
    // is allowed to go inside the empty text node, and this doesn't show up in the correct
    // position on screen.
    var pos = range.start;
    if ((pos.node._type == ElementTypes.HTML_TEXT) &&
        (pos.node.nodeValue.length == 0)) {
        var empty = pos.node;
        pos = new Position.Position(empty.parentNode,DOM.nodeOffset(empty));
        DOM.deleteNode(empty);
    }
    else {
        pos = Position.preferElementPosition(pos);
    }

    DOM.insertBefore(pos.node,footnote,pos.node.childNodes[pos.offset]);
    Selection.set(footnote,0,footnote,footnote.childNodes.length);
    updateBRAtEndOfParagraph(footnote);
}

export function insertFootnote(content) {
    insertNote("footnote",content);
}

export function insertEndnote(content) {
    insertNote("endnote",content);
}
