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

// FIXME: ensure updateFormatting() is called after any cursor/selection changes
// FIXME: test capitalisation of on-screen keyboard at start of sentence

(function(api) {

    var Input = api.Input; // export

    var Cursor = api.Cursor; // import
    var DOM = api.DOM; // import
    var Paragraph = api.Paragraph; // import
    var Position = api.Position; // import
    var Range = api.Range; // import
    var Selection = api.Selection; // import
    var Text = api.Text; // import

    // function idebug(str) {
    //    debug(str);
    // }

    var forwardSelection = true;
    var positions = new Object();
    var BaseIdNull = 0;
    var BaseIdDocumentStart = 1;
    var BaseIdDocumentEnd = 2;
    var BaseIdSelectionStart = 3;
    var BaseIdSelectionEnd = 4;
    var firstDynamicPosId = 5;
    var nextPosId = firstDynamicPosId;

    function addPosition(pos) {
        if (pos == null)
            return 0;
        var copy = new Position.Position(pos.node,pos.offset);
        copy.targetX = pos.targetX;
        pos = copy;
        pos.posId = nextPosId++;
        positions[pos.posId] = pos;
        Position.track(pos);
        return pos.posId;
    }

    Input.addPosition = addPosition;

    function getPosition(posId) {
        if (posId instanceof Position.Position) // for tests
            return posId;
        if (posId < firstDynamicPosId) {
            switch (posId) {
            case BaseIdNull: {
                return null;
            }
            case BaseIdDocumentStart: {
                var pos = new Position.Position(document.body,0);
                pos = Position.closestMatchForwards(pos,Position.okForMovement);
                return pos;
            }
            case BaseIdDocumentEnd: {
                var pos = new Position.Position(document.body,document.body.childNodes.length);
                pos = Position.closestMatchBackwards(pos,Position.okForMovement);
                return pos;
            }
            case BaseIdSelectionStart: {
                var range = Selection.get();
                return (range != null) ? range.start : null;
            }
            case BaseIdSelectionEnd: {
                var range = Selection.get();
                return (range != null) ? range.end : null;
            }
            default:
                return null;
            }
        }
        if (positions[posId] == null)
            throw new Error("No position for pos id "+posId);
        return positions[posId];
    }

    Input.getPosition = getPosition;

    // void
    Input.removePosition = function(posId) {
        //idebug("Input.removePosition("+posId+")");
        var pos = positions[posId];
        if (pos == null) {
            throw new Error("no position for id "+posId);
        }
        Position.untrack(pos);
        delete positions[posId];
    }

    // string
    Input.textInRange = function(startId,startAdjust,endId,endAdjust) {
        var start = getPosition(startId);
        var end = getPosition(endId);
        start = positionRight(start,startAdjust);
        end = positionRight(end,endAdjust);
        if ((start == null) || (end == null))
            return "";

        var range = new Range.Range(start.node,start.offset,end.node,end.offset);
        var result = Range.getText(range);
        //idebug("Input.textInRange("+startId+","+startAdjust+","+endId+","+endAdjust+") = "+
        //       JSON.stringify(result));
        return result;
    }

    // void
    Input.replaceRange = function(startId,endId,text) {
        //idebug("Input.replaceRange("+startId+","+endId+","+JSON.stringify(text)+")");
        var start = getPosition(startId);
        var end = getPosition(endId);
        if (start == null)
            throw new Error("start is null");
        if (end == null)
            throw new Error("end is null");

        var range = new Range.Range(start.node,start.offset,end.node,end.offset);
        Range.trackWhileExecuting(range,function() {
            Selection.deleteRangeContents(range,true);
        });
        range.start = Position.preferTextPosition(range.start);
        var node = range.start.node;
        var offset = range.start.offset;

        if (node.nodeType == Node.TEXT_NODE) {
            DOM.insertCharacters(node,offset,text);
            Cursor.set(node,offset+text.length);
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            var textNode = DOM.createTextNode(document,text);
            DOM.insertBefore(node,textNode,node.childNodes[offset]);
            Cursor.set(node,offset+1);
        }
    }

    // { startId, endId }
    Input.selectedTextRange = function() {
        var range = Selection.get();
        if (range == null) {
            //idebug("Input.selectedTextRange = null");
            return null;
        }
        else {
            var startId = addPosition(range.start);
            var endId = addPosition(range.end);
            //idebug("Input.selectedTextRange = "+startId+", "+endId);
            return { startId: startId,
                     endId: endId };
        }
    }

    // void
    Input.setSelectedTextRange = function(startId,endId) {
        //idebug("Input.setSelectedTextRange("+startId+","+endId+")");
        var start = getPosition(startId);
        var end = getPosition(endId);

        var oldSelection = Selection.get();
        var oldStart = (oldSelection != null) ? oldSelection.start : null;
        var oldEnd = (oldSelection != null) ? oldSelection.end : null;

        Selection.set(start.node,start.offset,end.node,end.offset);

        // The positions may have changed as a result of spans being added/removed
        var newRange = Selection.get();
        start = newRange.start;
        end = newRange.end;

        if (Position.equal(start,end))
            Cursor.ensurePositionVisible(end);
        else if (Position.equal(oldStart,start) && !Position.equal(oldEnd,end))
            Cursor.ensurePositionVisible(end);
        else if (Position.equal(oldEnd,end) && !Position.equal(oldStart,start))
            Cursor.ensurePositionVisible(start);
    }

    // { startId, endId }
    Input.markedTextRange = function() {
        //idebug("Input.markedTextRange");
        return null;
    }

    // void
    Input.setMarkedText = function(text,startOffset,endOffset) {
        Selection.deleteContents(true);
        var oldSel = Selection.get();
        Range.trackWhileExecuting(oldSel,function() {
            Cursor.insertCharacter(text,false,false,true);
        });
        var newSel = Selection.get();

        Selection.set(oldSel.start.node,oldSel.start.offset,
                      newSel.end.node,newSel.end.offset,false,true);
    }

    // void
    Input.unmarkText = function() {
        var range = Selection.get();
        Cursor.set(range.end.node,range.end.offset);
        //idebug("Input.unmarkText");
    }

    // boolean
    Input.forwardSelectionAffinity = function() {
        //idebug("Input.forwardSelectionAffinity");
        return forwardSelection;
    }

    // void
    Input.setForwardSelectionAffinity = function(value) {
        //idebug("Input.setForwardSelectionAffinity");
        forwardSelection = value;
    }

    function positionRight(pos,offset) {
        if (offset > 0) {
            for (; offset > 0; offset--) {
                var next = Position.nextMatch(pos,Position.okForMovement);
                if (next == null)
                    return pos;
                pos = next;
            }
        }
        else {
            for (; offset < 0; offset++) {
                var prev = Position.prevMatch(pos,Position.okForMovement);
                if (prev == null)
                    return pos;
                pos = prev;
            }
        }
        return pos;
    }

    function positionDown(pos,offset) {
        if (offset > 0) {
            for (; offset > 0; offset--) {
                var below = Text.posBelow(pos);
                if (below == null)
                    return pos;
                pos = below;
            }
        }
        else {
            for (; offset < 0; offset++) {
                var above = Text.posAbove(pos);
                if (above == null)
                    return pos;
                pos = above;
            }
        }
        return pos;
    }

    // posId
    Input.positionFromPositionOffset = function(posId,offset) {
        var pos = getPosition(posId);
        var res = addPosition(positionRight(pos,offset));
        //idebug("Input.positionFromPositionOffset("+posId+","+offset+") = "+res);
        return res;
    }

    // posId
    Input.positionFromPositionInDirectionOffset = function(posId,direction,offset) {
        //idebug("Input.positionFromPositionInDirectionOffset("+posId+","+direction+","+offset+")");
        var pos = getPosition(posId);
        if (direction == "left")
            return addPosition(positionRight(pos,-offset));
        else if (direction == "right")
            return addPosition(positionRight(pos,offset));
        else if (direction == "up")
            return addPosition(positionDown(pos,-offset));
        else if (direction == "down")
            return addPosition(positionDown(pos,offset));
        else
            throw new Error("unknown direction: "+direction);
    }

    // int
    Input.comparePositionToPosition = function(posId1,posId2) {
        //idebug("Input.comparePositionToPosition("+posId1+","+posId2+")");
        var pos1 = getPosition(posId1);
        var pos2 = getPosition(posId2);
        if (pos1 == null)
            throw new Error("pos1 is null");
        if (pos2 == null)
            throw new Error("pos2 is null");
        return Position.compare(pos1,pos2);
    }

    // int
    Input.offsetFromPositionToPosition = function(fromId,toId) {
        //idebug("Input.offsetFromPositionToPosition("+fromId+","+toId+")");
        throw new Error("offsetFromPositionToPosition: not implemented");
    }

    Input.positionWithinRangeFarthestInDirection = function(startId,endId,direction) {
        //idebug("Input.positionWithinRangeFarthestInDirection("+startId+","+endId+","+direction);
        throw new Error("positionWithinRangeFarthestInDirection: not implemented");
    }

    // { startId, endId }
    Input.characterRangeByExtendingPositionInDirection = function(posId,direction) {
        //idebug("Input.characterRangeByExtendingPositionInDirection("+posId+","+direction);
        throw new Error("characterRangeByExtendingPositionInDirection: not implemented");
    }

    Input.firstRectForRange = function(startId,endId) {
        //idebug("Input.firstRectForRange("+startId+","+endId+")");
        var start = getPosition(startId);
        var end = getPosition(endId);
        var range = new Range.Range(start.node,start.offset,end.node,end.offset);
        var rects = Range.getClientRects(range);
        if (rects.length == 0)
            return { x: 0, y: 0, width: 0, height: 0 };
        else
            return { x: rects[0].left, y: rects[0].top,
                     width: rects[0].width, height: rects[0].height };
    }

    Input.caretRectForPosition = function(posId) {
        //idebug("Input.caretRectForPosition("+posId+")");
        var pos = getPosition(posId);
        var rect = Position.rectAtPos(pos);
        if (rect == null)
            return { x: 0, y: 0, width: 0, height: 0 };
        else
            return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    }

    // posId
    Input.closestPositionToPoint = function(x,y) {
        //idebug("Input.closestPositionToPoint("+x+","+y+")");
        throw new Error("closestPositionToPoint: not implemented");
    }

    // posId
    Input.closestPositionToPointWithinRange = function(x,y,startId,endId) {
        //idebug("Input.closestPositionToPointWithinRange("+x+","+y+")");
        throw new Error("closestPositionToPointWithinRange: not implemented");
    }

    // { startId, endId }
    Input.characterRangeAtPoint = function(x,y) {
        //idebug("Input.characterRangeAtPoint("+x+","+y+")");
        throw new Error("characterRangeAtPoint: not implemented");
    }

    // posId
    Input.positionWithinRangeAtCharacterOffset = function(startId,endId,offset) {
        //idebug("Input.positionWithinRangeAtCharacterOffset("+startId+","+endId+","+offset+")");
        throw new Error("positionWithinRangeAtCharacterOffset: not implemented");
    }

    // int
    Input.characterOffsetOfPositionWithinRange = function(posId,startId,endId) {
        //idebug("Input.characterOffsetOfPositionWithinRange("+posId+","+startId+","+endId+")");
        throw new Error("characterOffsetOfPositionWithinRange: not implemented");
    }

    // UITextInputTokenizer methods

    var punctuation = "!\"#%&',-/:;<=>@`~\\^\\$\\\\\\.\\*\\+\\?\\(\\)\\[\\]\\{\\}\\|";
    var letterRE = new RegExp("[^\\s"+punctuation+"]");
    var wordAtStartRE = new RegExp("^[^\\s"+punctuation+"]+");
    var nonWordAtStartRE = new RegExp("^[\\s"+punctuation+"]+");
    var wordAtEndRE = new RegExp("[^\\s"+punctuation+"]+$");
    var nonWordAtEndRE = new RegExp("[\\s"+punctuation+"]+$");

    function isForward(direction) {
        return ((direction == "forward") ||
                (direction == "right") ||
                (direction == "down"));
    }

    Input.isAtWordBoundary = function(pos,direction) {
        if (pos.node.nodeType != Node.TEXT_NODE)
            return false;
        var paragraph = Text.analyseParagraph(pos);
        if (paragraph == null)
            return false;
        var offset = Paragraph.offsetAtPosition(paragraph,pos);
        var before = paragraph.text.substring(0,offset);
        var after = paragraph.text.substring(offset);
        var text = paragraph.text;

        var afterMatch = (offset < text.length) && (text.charAt(offset).match(letterRE));
        var beforeMatch = (offset > 0) && (text.charAt(offset-1).match(letterRE));

        // coerce to boolean
        afterMatch = !!afterMatch;
        beforeMatch = !!beforeMatch;

        if (isForward(direction))
            return beforeMatch && !afterMatch;
        else
            return !beforeMatch;
    }

    Input.isAtParagraphBoundary = function(pos,direction) {
    }

    Input.isPositionAtBoundaryGranularityInDirection = function(posId,granularity,direction) {
        //idebug("Input.isPositionAtBoundaryGranularityInDirection("+
        //       posId+","+granularity+","+direction+")");
        var pos = getPosition(posId);
        if (pos == null)
            return false;

        // FIXME: Temporary hack to avoid exceptions when running under iOS 8
        if ((granularity == "sentence") || (granularity == "document"))
            return false;

        if (granularity == "character") {
            return true;
        }
        else if (granularity == "word") {
            return Input.isAtWordBoundary(pos,direction);
        }
        else if ((granularity == "paragraph") || (granularity == "line")) {
            if (isForward(direction))
                return Position.equal(pos,Text.toEndOfBoundary(pos,granularity));
            else
                return Position.equal(pos,Text.toStartOfBoundary(pos,granularity));
        }
        else if (granularity == "sentence") {
        }
        else if (granularity == "document") {
        }
        throw new Error("unsupported granularity: "+granularity);
    }

    Input.isPositionWithinTextUnitInDirection = function(posId,granularity,direction) {
        //idebug("Input.isPositionWithinTextUnitInDirection("+
        //       posId+","+granularity+","+direction+")");
        var pos = getPosition(posId);
        if (pos == null)
            return false;

        // FIXME: Temporary hack to avoid exceptions when running under iOS 8
        if ((granularity == "sentence") || (granularity == "document"))
            return true;

        if (granularity == "character") {
            return true;
        }
        else if (granularity == "word") {
            pos = Text.closestPosInDirection(pos,direction);
            if (pos == null)
                return false;
            var paragraph = Text.analyseParagraph(pos);
            if (paragraph == null)
                return false;
            if ((pos != null) && (pos.node.nodeType == Node.TEXT_NODE)) {
                var offset = Paragraph.offsetAtPosition(paragraph,pos);
                var text = paragraph.text;
                if (isForward(direction))
                    return !!((offset < text.length) && (text.charAt(offset).match(letterRE)));
                else
                    return !!((offset > 0) && (text.charAt(offset-1).match(letterRE)));
            }
            else {
                return false;
            }
        }
        else if (granularity == "sentence") {
        }
        else if ((granularity == "paragraph") || (granularity == "line")) {
            var start = Text.toStartOfBoundary(pos,granularity);
            var end = Text.toEndOfBoundary(pos,granularity);
            start = start ? start : pos;
            end = end ? end : pos;
            if (isForward(direction)) {
                return ((Position.compare(start,pos) <= 0) &&
                        (Position.compare(pos,end) < 0));
            }
            else {
                return ((Position.compare(start,pos) < 0) &&
                        (Position.compare(pos,end) <= 0));
            }
        }
        else if (granularity == "document") {
        }
        throw new Error("unsupported granularity: "+granularity);
    }

    Input.toWordBoundary = function(pos,direction) {
        pos = Text.closestPosInDirection(pos,direction);
        if (pos == null)
            return null;
        var paragraph = Text.analyseParagraph(pos);
        if (paragraph == null)
            return null;
        var run = Paragraph.runFromNode(paragraph,pos.node);
        var offset = pos.offset + run.start;

        if (isForward(direction)) {
            var remaining = paragraph.text.substring(offset);
            var afterWord = remaining.replace(wordAtStartRE,"");
            var afterNonWord = remaining.replace(nonWordAtStartRE,"");

            if (remaining.length == 0) {
                return pos;
            }
            else if (afterWord.length < remaining.length) {
                var newOffset = offset + (remaining.length - afterWord.length);
                return Paragraph.positionAtOffset(paragraph,newOffset);
            }
            else {
                var newOffset = offset + (remaining.length - afterNonWord.length);
                return Paragraph.positionAtOffset(paragraph,newOffset);
            }
        }
        else {
            var remaining = paragraph.text.substring(0,offset);
            var beforeWord = remaining.replace(wordAtEndRE,"");
            var beforeNonWord = remaining.replace(nonWordAtEndRE,"");

            if (remaining.length == 0) {
                return pos;
            }
            else if (beforeWord.length < remaining.length) {
                var newOffset = offset - (remaining.length - beforeWord.length);
                return Paragraph.positionAtOffset(paragraph,newOffset);
            }
            else {
                var newOffset = offset - (remaining.length - beforeNonWord.length);
                return Paragraph.positionAtOffset(paragraph,newOffset);
            }
        }
    }

    Input.toParagraphBoundary = function(pos,direction) {
        if (isForward(direction)) {
            var end = Text.toEndOfBoundary(pos,"paragraph");
            if (Position.equal(pos,end)) {
                end = Position.nextMatch(end,Position.okForMovement);
                end = Text.toEndOfBoundary(end,"paragraph");
                end = Text.toStartOfBoundary(end,"paragraph");
            }
            return end ? end : pos;
        }
        else {
            var start = Text.toStartOfBoundary(pos,"paragraph");
            if (Position.equal(pos,start)) {
                start = Position.prevMatch(start,Position.okForMovement);
                start = Text.toStartOfBoundary(start,"paragraph");
                start = Text.toEndOfBoundary(start,"paragraph");
            }
            return start ? start : pos;
        }
    }

    Input.toLineBoundary = function(pos,direction) {
        if (isForward(direction)) {
            var end = Text.toEndOfBoundary(pos,"line");
            return end ? end : pos;
        }
        else {
            var start = Text.toStartOfBoundary(pos,"line");
            return start ? start : pos;
        }
    }

    Input.positionFromPositionToBoundaryInDirection = function(posId,granularity,direction) {
        //idebug("Input.positionFromPositionToBoundaryInDirection("+
        //       posId+","+granularity+","+direction+")");
        var pos = getPosition(posId);
        if (pos == null)
            return null;

        // FIXME: Temporary hack to avoid exceptions when running under iOS 8
        if (granularity == "sentence")
            granularity = "paragraph";

        if (granularity == "word")
            return addPosition(Input.toWordBoundary(pos,direction));
        else if (granularity == "paragraph")
            return addPosition(Input.toParagraphBoundary(pos,direction));
        else if (granularity == "line")
            return addPosition(Input.toLineBoundary(pos,direction));
        else if (granularity == "character")
            return Input.positionFromPositionInDirectionOffset(posId,direction,1);
        else if (granularity == "document")
            return isForward(direction) ? BaseIdDocumentEnd : BaseIdDocumentStart;
        else
            throw new Error("unsupported granularity: "+granularity);
    }

    Input.rangeEnclosingPositionWithGranularityInDirection = function(posId,granularity,direction) {
        //idebug("Input.rangeEnclosingPositionWithGranularityInDirection("+
        //       posId+","+granularity+","+direction);
        var pos = getPosition(posId);
        if (pos == null)
            return null;

        // FIXME: Temporary hack to avoid exceptions when running under iOS 8
        if (granularity == "sentence")
            granularity = "paragraph";

        if (granularity == "word") {
            pos = Text.closestPosInDirection(pos,direction);
            if (pos == null)
                return null;
            var paragraph = Text.analyseParagraph(pos);
            if (pos == null)
                return addPosition(null);
            if (paragraph == null)
                return addPosition(null);
            var run = Paragraph.runFromNode(paragraph,pos.node);
            var offset = pos.offset + run.start;

            var before = paragraph.text.substring(0,offset);
            var after = paragraph.text.substring(offset);
            var beforeWord = before.replace(wordAtEndRE,"");
            var afterWord = after.replace(wordAtStartRE,"");

            var ok;

            if (isForward(direction))
                ok = (afterWord.length < after.length);
            else
                ok = (beforeWord.length < before.length);

            if (ok) {
                var charsBefore = (before.length - beforeWord.length);
                var charsAfter = (after.length - afterWord.length);
                var startOffset = offset - charsBefore;
                var endOffset = offset + charsAfter;

                var startPos = Paragraph.positionAtOffset(paragraph,startOffset);
                var endPos = Paragraph.positionAtOffset(paragraph,endOffset);
                return { startId: addPosition(startPos),
                         endId: addPosition(endPos) };
            }
            else {
                return null;
            }
        }
        else if ((granularity == "paragraph") || (granularity == "line")) {
            var start = Text.toStartOfBoundary(pos,granularity);
            var end = Text.toEndOfBoundary(pos,granularity);
            start = start ? start : pos;
            end = end ? end : pos;

            if ((granularity == "paragraph") || !isForward(direction)) {
                if (isForward(direction)) {
                    if (Position.equal(pos,Text.toEndOfBoundary(pos,granularity)))
                        return null;
                }
                else {
                    if (Position.equal(pos,Text.toStartOfBoundary(pos,granularity)))
                        return null;
                }
            }
            return { startId: addPosition(start),
                     endId: addPosition(end) };
        }
        else {
            throw new Error("unsupported granularity: "+granularity);
        }
    }

})(globalAPI);
