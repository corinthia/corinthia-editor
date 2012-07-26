var Input_removePosition;
var Input_getPosition;
var Input_textInRange;
var Input_replaceRange;
var Input_selectedTextRange;
var Input_setSelectedTextRange;
var Input_markedTextRange;
var Input_setMarkedText;
var Input_unmarkText;
var Input_forwardSelectionAffinity;
var Input_setForwardSelectionAffinity;
var Input_positionFromPositionOffset;
var Input_positionFromPositionInDirectionOffset;
var Input_beginningOfDocument;
var Input_endOfDocument;
var Input_comparePositionToPosition;
var Input_offsetFromPositionToPosition;
var Input_positionWithinRangeFarthestInDirection;
var Input_characterRangeByExtendingPositionInDirection;
var Input_firstRectForRange;
var Input_caretRectForPosition;
var Input_closestPositionToPoint;
var Input_closestPositionToPointWithinRange;
var Input_characterRangeAtPoint;
var Input_positionWithinRangeAtCharacterOffset;
var Input_characterOffsetOfPositionWithinRange;

var Input_isPositionAtBoundaryGranularityInDirection;
var Input_isPositionWithinTextUnitInDirection;
var Input_positionFromPositionToBoundaryInDirection;
var Input_rangeEnclosingPositionWithGranularityInDirection;

(function() {

    function itrace(name)
    {
        var components = new Array();
        for (var i = 1; i < arguments.length; i++)
            components.push(""+arguments[i]);
//        debug(name+"("+components.join(",")+")");
    }

    function idebug(str)
    {
        debug(str);
    }

    var forwardSelection = true;
    var positions = new Object();
    var nextPosId = 1;

    var addPosition = trace(function addPosition(pos)
    {
        if (pos == null)
            return 0;
//        itrace("addPosition",pos);
        pos = new Position(pos.node,pos.offset);
        pos.posId = nextPosId++;
        positions[pos.posId] = pos;
        Position_track(pos);
        return pos.posId;
    });

    var getPosition = trace(function getPosition(posId)
    {
        if (posId instanceof Position) // for tests
            return posId;
        if (posId == 0)
            return null;
        if (positions[posId] == null)
            throw new Error("No position for pos id "+posId);
        return positions[posId];
    });

    Input_getPosition = getPosition;

    // void
    Input_removePosition = trace(function removePosition(posId)
    {
        var pos = positions[posId];
//        itrace("removePosition",pos);
        if (pos == null) {
            throw new Error("no position for id "+posId);
        }
        Position_untrack(pos);
        delete positions[posId];
    });

    // string
    Input_textInRange = trace(function textInRange(startId,endId)
    {
        var start = getPosition(startId);
        var end = getPosition(endId);
        itrace("textInRange",start,end);
        if ((start == null) || (end == null))
            return "";

        var range = new Range(start.node,start.offset,end.node,end.offset);
        var outermost = range.getOutermostNodes();
        var components = new Array();
        for (var i = 0; i < outermost.length; i++)
            recurse(outermost[i]);
        return components.join("").replace(/\s+/g," ");

        function recurse(node)
        {
            if (node.nodeType == Node.TEXT_NODE) {
                var str;
                if ((node == start.node) && (node == end.node)) {
                    str = node.nodeValue.substring(start.offset,end.offset);
                }
                else if (node == start.node) {
                    str = node.nodeValue.substring(start.offset);
                }
                else if (node == end.node) {
                    str = node.nodeValue.substring(0,end.offset);
                }
                else {
                    str = node.nodeValue;
                }
                components.push(str);
            }
            else {
                for (var child = node.firstChild; child != null; child = child.nextSibling)
                    recurse(child);
            }
        }
    });

    // void
    Input_replaceRange = trace(function replaceRange(startId,endId,text)
    {
        var start = getPosition(startId);
        var end = getPosition(endId);
        itrace("replaceRange",start,end,text);

        var range = new Range(start.node,start.offset,end.node,end.offset);
        range.trackWhileExecuting(function() {
            Selection_deleteRangeContents(range);
        });
        var textNode = DOM_createTextNode(document,text);
        var node = range.start.node;
        var offset = range.start.offset;
        if (node.nodeType == Node.ELEMENT_NODE) {
            DOM_insertBefore(node,textNode,range.childNodes[range.offset]);
        }
        else {
            DOM_insertBefore(node.parentNode,textNode,node.nextSibling);
        }
    });

    // { startId, endId }
    Input_selectedTextRange = trace(function selectedTextRange()
    {
        var range = Selection_get();
        if (range == null) {
//            idebug("selectedTextRange: null");
            return null;
        }
        else {
            var startId = addPosition(range.start);
            var endId = addPosition(range.end);
//            idebug("selectedTextRange: "+startId+", "+endId);
            return { startId: startId,
                     endId: endId };
        }
    });

    // void
    Input_setSelectedTextRange = trace(function setSelectedTextRange(startId,endId)
    {
        var start = getPosition(startId);
        var end = getPosition(endId);
        itrace("setSelectedTextRange",start,end);
        Selection_set(start.node,start.offset,end.node,end.offset);
    });

    // { startId, endId }
    Input_markedTextRange = trace(function markedTextRange()
    {
        itrace("markedTextRange");
        return null;
    });

    // void
    Input_setMarkedText = trace(function setMarkedText(text,startOffset,endOffset)
    {
        itrace("setMarkedText",text,startOffset,endOffset);
    });

    // void
    Input_unmarkText = trace(function unmarkText()
    {
        itrace("unmarkText");
    });

    // boolean
    Input_forwardSelectionAffinity = trace(function forwardSelectionAffinity()
    {
        itrace("forwardSelectionAffinity");
        return forwardSelection;
    });

    // void
    Input_setForwardSelectionAffinity = trace(function setForwardSelectionAffinity(value)
    {
        itrace("setForwardSelectionAffinity",value);
        forwardSelection = value;
    });

    var positionRight = trace(function positionRight(pos,offset)
    {
        if (offset > 0) {
            for (; (offset > 0) && (pos != null); offset--)
                pos = Position_nextMatch(pos,Position_okForMovement);
        }
        else {
            for (; (offset < 0) && (pos != null); offset++)
                pos = Position_prevMatch(pos,Position_okForMovement);
        }
        return pos;
    });

    var positionUpSingle = trace(function positionUpSingle(pos)
    {
        var cursorRect = Position_rectAtPos(pos);

        if (cursorRect == null) {
            pos = Text_closestPosBackwards(pos);
            cursorRect = Position_rectAtPos(pos);
        }

        if (cursorRect == null)
            return;

//        if (cursorX == null)
//            cursorX = cursorRect.left;
        var cursorX = cursorRect.left;

        return Text_posAbove(pos,cursorRect,cursorX);
    });

    var positionDownSingle = trace(function positionDownSingle(pos)
    {
        var cursorRect = Position_rectAtPos(pos);

        if (cursorRect == null) {
            var element = pos.closestActualNode(true);
            if (element.nodeType == Node.ELEMENT_NODE) {
                cursorRect = element.getBoundingClientRect();
            }
        }

        if (cursorRect == null) {
            pos = Text_closestPosForwards(pos);
            cursorRect = Position_rectAtPos(pos);
        }

        if (cursorRect == null)
            return;

//        if (cursorX == null)
//            cursorX = cursorRect.left;
        var cursorX = cursorRect.left;

        return Text_posBelow(pos,cursorRect,cursorX);
    });

    var positionDown = trace(function positionDown(pos,offset)
    {
        if (offset > 0) {
            for (; (offset > 0) && (pos != null); offset--)
                pos = positionDownSingle(pos);
        }
        else {
            for (; (offset < 0) && (pos != null); offset++)
                pos = positionUpSingle(pos);
        }
        return pos;
    });

    // posId
    Input_positionFromPositionOffset = trace(function positionFromPositionOffset(posId,offset)
    {
        var pos = getPosition(posId);
        itrace("positionFromPositionOffset",pos,offset);
        return addPosition(positionRight(pos,offset));
    });

    // posId
    Input_positionFromPositionInDirectionOffset =
        trace(function positionFromPositionInDirectionOffset(posId,direction,offset)
    {
        var pos = getPosition(posId);
        itrace("positionFromPositionInDirectionOffset",pos,direction,offset);
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
    });

    // posId
    Input_beginningOfDocument = trace(function beginningOfDocument()
    {
        itrace("beginningOfDocument");
        var pos = new Position(document.body,0);
        pos = Position_closestMatchForwards(pos,Position_okForMovement);
        return addPosition(pos);
    });

    // posId
    Input_endOfDocument = trace(function endOfDocument()
    {
        itrace("endOfDocument");
        var pos = new Position(document.body,document.body.childNodes.length);
        pos = Position_closestMatchBackwards(pos,Position_okForMovement);
        return addPosition(pos);
    });

    // int
    Input_comparePositionToPosition = trace(function comparePositionToPosition(posId1,posId2)
    {
        var pos1 = getPosition(posId1);
        var pos2 = getPosition(posId2);
        itrace("comparePositionToPosition",pos1,pos2);
        if ((pos1.node == pos2.node) && (pos1.offset == pos2.offset))
            return 0;
        var range = new Range(pos1.node,pos1.offset,pos2.node,pos2.offset);
        if (range.isForwards())
            return -1;
        else
            return 1;
    });

    // int
    Input_offsetFromPositionToPosition = trace(function offsetFromPositionToPosition(fromId,toId)
    {
        throw new Error("offsetFromPositionToPosition: not implemented");
    });

    Input_positionWithinRangeFarthestInDirection =
        trace(function positionWithinRangeFarthestInDirection(startId,endId,direction)
    {
        throw new Error("positionWithinRangeFarthestInDirection: not implemented");
    });

    // { startId, endId }
    Input_characterRangeByExtendingPositionInDirection =
        trace(function characterRangeByExtendingPositionInDirection(posId,direction)
    {
        throw new Error("characterRangeByExtendingPositionInDirection: not implemented");
    });

    Input_firstRectForRange = trace(function firstRectForRange(startId,endId)
    {
        var start = getPosition(startId);
        var end = getPosition(endId);
        itrace("firstRectForRange",start,end);
        var range = new Range(start.node,start.offset,end.node,end.offset);
        var rects = range.getClientRects();
        if (rects.length == 0)
            return { x: 0, y: 0, width: 0, height: 0 };
        else
            return { x: rects[0].left, y: rects[0].top,
                     width: rects[0].width, height: rects[0].height };
    });

    Input_caretRectForPosition = trace(function caretRectForPosition(posId)
    {
        var pos = getPosition(posId);
        itrace("caretRectForPosition",pos);
        var rect = Position_rectAtPos(pos);
        if (rect == null)
            return { x: 0, y: 0, width: 0, height: 0 };
        else
            return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    });

    // posId
    Input_closestPositionToPoint = trace(function closestPositionToPoint(x,y)
    {
        throw new Error("closestPositionToPoint: not implemented");
    });

    // posId
    Input_closestPositionToPointWithinRange =
        trace(function closestPositionToPointWithinRange(x,y,startId,endId)
    {
        throw new Error("closestPositionToPointWithinRange: not implemented");
    });

    // { startId, endId }
    Input_characterRangeAtPoint = trace(function characterRangeAtPoint(x,y)
    {
        throw new Error("characterRangeAtPoint: not implemented");
    });

    // posId
    Input_positionWithinRangeAtCharacterOffset =
        trace(function positionWithinRangeAtCharacterOffset(startId,endId,offset)
    {
        throw new Error("positionWithinRangeAtCharacterOffset: not implemented");
    });

    // int
    Input_characterOffsetOfPositionWithinRange =
        trace(function characterOffsetOfPositionWithinRange(posId,startId,endId)
    {
        throw new Error("characterOffsetOfPositionWithinRange: not implemented");
    });

    // UITextInputTokenizer methods

    var punctuation = "!\"#%&',-/:;<=>@`~\\^\\$\\\\\\.\\*\\+\\?\\(\\)\\[\\]\\{\\}\\|";
    var letterRE = new RegExp("[^\\s"+punctuation+"]");
    var wordAtStartRE = new RegExp("^[^\\s"+punctuation+"]+");
    var nonWordAtStartRE = new RegExp("^[\\s"+punctuation+"]+");
    var wordAtEndRE = new RegExp("[^\\s"+punctuation+"]+$");
    var nonWordAtEndRE = new RegExp("[\\s"+punctuation+"]+$");

    function isForward(direction)
    {
        return ((direction == "forward") ||
                (direction == "right") ||
                (direction == "down"));
    }

    Input_isPositionAtBoundaryGranularityInDirection =
        trace(function isPositionAtBoundaryGranularityInDirection(posId,granularity,direction)
    {
        var pos = getPosition(posId);
        itrace("isPositionAtBoundaryGranularityInDirection",pos,granularity,direction);
        if (pos == null)
            return false;

        var paragraph = Text_analyseParagraph(pos.node);
        if (paragraph == null)
            return false;

        if (granularity == "character") {
            return true;
        }
        else if (granularity == "word") {
            if (pos.node.nodeType == Node.TEXT_NODE) {
                var offset = Paragraph_offsetAtPosition(paragraph,pos);
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
            if (run == null)
                return false;
        }
        else if ((granularity == "paragraph") || (granularity == "line")) {
            if (isForward(direction))
                return Position_equal(pos,Text_toEndOfBoundary(pos,granularity));
            else
                return Position_equal(pos,Text_toStartOfBoundary(pos,granularity));
        }
        else if (granularity == "sentence") {
        }
        else if (granularity == "document") {
        }
        throw new Error("unsupported granularity: "+granularity);
    });

    Input_isPositionWithinTextUnitInDirection =
        trace(function isPositionWithinTextUnitInDirection(posId,granularity,direction)
    {
        var pos = getPosition(posId);
        itrace("isPositionWithinTextUnitInDirection",pos,granularity,direction);
        if (pos == null)
            return false;

        var paragraph = Text_analyseParagraph(pos.node);
        if (paragraph == null)
            return false;

        if (granularity == "character") {
            return true;
        }
        else if (granularity == "word") {
            var pos = Text_closestPosInDirection(pos,direction);
            if ((pos != null) && (pos.node.nodeType == Node.TEXT_NODE)) {
                var offset = Paragraph_offsetAtPosition(paragraph,pos);
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
            var start = Text_toStartOfBoundary(pos,granularity);
            var end = Text_toEndOfBoundary(pos,granularity);
            start = start ? start : pos;
            end = end ? end : pos;
            if (isForward(direction)) {
                return ((Position_compare(start,pos) <= 0) &&
                        (Position_compare(pos,end) < 0));
            }
            else {
                return ((Position_compare(start,pos) < 0) &&
                        (Position_compare(pos,end) <= 0));
            }
        }
        else if (granularity == "document") {
        }
        throw new Error("unsupported granularity: "+granularity);
    });

    Input_positionFromPositionToBoundaryInDirection =
        trace(function positionFromPositionToBoundaryInDirection(posId,granularity,direction)
    {
        var pos = getPosition(posId);
        itrace("positionFromPositionToBoundaryInDirection",pos,granularity,direction);
        if (pos == null)
            return null;

        if (granularity == "word") {
            pos = Text_closestPosInDirection(pos,direction);
            if (pos == null)
                return addPosition(null);
            var paragraph = Text_analyseParagraph(pos.node);
            if (paragraph == null)
                return addPosition(null);
            var run = Paragraph_runFromNode(paragraph,pos.node);
            var offset = pos.offset + run.start;

            if (isForward(direction)) {
                var remaining = paragraph.text.substring(offset);
                var afterWord = remaining.replace(wordAtStartRE,"");
                var afterNonWord = remaining.replace(nonWordAtStartRE,"");

                if (remaining.length == 0) {
                    return addPosition(pos);
                }
                else if (afterWord.length < remaining.length) {
                    var newOffset = offset + (remaining.length - afterWord.length);
                    return addPosition(Paragraph_positionAtOffset(paragraph,newOffset));
                }
                else {
                    var newOffset = offset + (remaining.length - afterNonWord.length);
                    return addPosition(Paragraph_positionAtOffset(paragraph,newOffset));
                }
            }
            else {
                var remaining = paragraph.text.substring(0,offset);
                var beforeWord = remaining.replace(wordAtEndRE,"");
                var beforeNonWord = remaining.replace(nonWordAtEndRE,"");

                if (remaining.length == 0) {
                    return addPosition(pos);
                }
                else if (beforeWord.length < remaining.length) {
                    var newOffset = offset - (remaining.length - beforeWord.length);
                    return addPosition(Paragraph_positionAtOffset(paragraph,newOffset));
                }
                else {
                    var newOffset = offset - (remaining.length - beforeNonWord.length);
                    return addPosition(Paragraph_positionAtOffset(paragraph,newOffset));
                }
            }
        }
        else if (granularity == "paragraph") {
            if (isForward(direction)) {
                var end = Text_toEndOfBoundary(pos,granularity);
                if (Position_equal(pos,end)) {
                    end = Position_nextMatch(end,Position_okForMovement);
                    end = Text_toEndOfBoundary(end,granularity);
                    end = Text_toStartOfBoundary(end,granularity);
                }
                return addPosition(end ? end : pos);
            }
            else {
                var start = Text_toStartOfBoundary(pos,granularity);
                if (Position_equal(pos,start)) {
                    start = Position_prevMatch(start,Position_okForMovement);
                    start = Text_toStartOfBoundary(start,granularity);
                    start = Text_toEndOfBoundary(start,granularity);
                }
                return addPosition(start ? start : pos);
            }
        }
        else if (granularity == "line") {
            if (isForward(direction)) {
                var end = Text_toEndOfBoundary(pos,granularity);
                return addPosition(end ? end : pos);
            }
            else {
                var start = Text_toStartOfBoundary(pos,granularity);
                return addPosition(start ? start : pos);
            }
        }
        else {
            throw new Error("unsupported granularity: "+granularity);
        }
    });

    Input_rangeEnclosingPositionWithGranularityInDirection =
        trace(function rangeEnclosingPositionWithGranularityInDirection(posId,granularity,direction)
    {
        var pos = getPosition(posId);
        itrace("rangeEnclosingPositionWithGranularityInDirection",pos,granularity,direction);
        if (pos == null)
            return null;

        if (granularity == "word") {
            pos = Text_closestPosInDirection(pos,direction);
            if (pos == null)
                return null;
            var paragraph = Text_analyseParagraph(pos.node);
            if (pos == null)
                return addPosition(null);
            if (paragraph == null)
                return addPosition(null);
            var run = Paragraph_runFromNode(paragraph,pos.node);
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

                var startPos = Paragraph_positionAtOffset(paragraph,startOffset);
                var endPos = Paragraph_positionAtOffset(paragraph,endOffset);
                return { startId: addPosition(startPos),
                         endId: addPosition(endPos) };
            }
            else {
                return null;
            }
        }
        else if ((granularity == "paragraph") || (granularity == "line")) {
            var start = Text_toStartOfBoundary(pos,granularity);
            var end = Text_toEndOfBoundary(pos,granularity);
            start = start ? start : pos;
            end = end ? end : pos;

            if ((granularity == "paragraph") || !isForward(direction)) {
                if (isForward(direction)) {
                    if (Position_equal(pos,Text_toEndOfBoundary(pos,granularity)))
                        return null;
                }
                else {
                    if (Position_equal(pos,Text_toStartOfBoundary(pos,granularity)))
                        return null;
                }
            }
            return { startId: addPosition(start),
                     endId: addPosition(end) };
        }
        else {
            throw new Error("unsupported granularity: "+granularity);
        }
    });

})();
