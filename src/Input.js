var Input_removePosition;
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

    // void
    Input_removePosition = trace(function removePosition(posId)
    {
        throw new Error("removePosition: not implemented");
    });

    // string
    Input_textInRange = trace(function textInRange(startId,endId)
    {
        throw new Error("textInRange: not implemented");
    });

    // void
    Input_replaceRange = trace(function replaceRange(startId,endId,text)
    {
        throw new Error("replaceRange: not implemented");
    });

    // { start, end }
    Input_selectedTextRange = trace(function selectedTextRange()
    {
        throw new Error("selectedTextRange: not implemented");
    });

    // void
    Input_setSelectedTextRange = trace(function setSelectedTextRange(startId,endId)
    {
        throw new Error("setSelectedTextRange: not implemented");
    });

    // { start, end }
    Input_markedTextRange = trace(function markedTextRange()
    {
        throw new Error("markedTextRange: not implemented");
    });

    // void
    Input_setMarkedText = trace(function setMarkedText(text,startOffset,endOffset)
    {
        throw new Error("setMarkedText: not implemented");
    });

    // void
    Input_unmarkText = trace(function unmarkText()
    {
        throw new Error("unmarkText: not implemented");
    });

    // boolean
    Input_forwardSelectionAffinity = trace(function forwardSelectionAffinity()
    {
        throw new Error("forwardSelectionAffinity: not implemented");
    });

    // void
    Input_setForwardSelectionAffinity = trace(function setForwardSelectionAffinity(value)
    {
        throw new Error("setForwardSelectionAffinity: not implemented");
    });

    // posId
    Input_positionFromPositionOffset = trace(function positionFromPositionOffset(posId,offset)
    {
        throw new Error("positionFromPositionOffset: not implemented");
    });

    // posId
    Input_positionFromPositionInDirectionOffset =
        trace(function positionFromPositionInDirectionOffset(posId,direction,offset)
    {
        throw new Error("positionFromPositionInDirectionOffset: not implemented");
    });

    // posId
    Input_beginningOfDocument = trace(function beginningOfDocument()
    {
        throw new Error("beginningOfDocument: not implemented");
    });

    // posId
    Input_endOfDocument = trace(function endOfDocument()
    {
        throw new Error("endOfDocument: not implemented");
    });

    // int
    Input_comparePositionToPosition = trace(function comparePositionToPosition(posId1,posId2)
    {
        throw new Error("comparePositionToPosition: not implemented");
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

    // { start, end }
    Input_characterRangeByExtendingPositionInDirection =
        trace(function characterRangeByExtendingPositionInDirection(posId,direction)
    {
        throw new Error("characterRangeByExtendingPositionInDirection: not implemented");
    });

    Input_firstRectForRange = trace(function firstRectForRange(startId,endId)
    {
        throw new Error("firstRectForRange: not implemented");
    });

    Input_caretRectForPosition = trace(function caretRectForPosition(posId)
    {
        throw new Error("caretRectForPosition: not implemented");
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

    // { start, end }
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

    Input_isPositionAtBoundaryGranularityInDirection =
        trace(function isPositionAtBoundaryGranularityInDirection(posId,granularity,direction)
    {
        throw new Error("isPositionAtBoundaryGranularityInDirection: not implemented");
    });

    Input_isPositionWithinTextUnitInDirection =
        trace(function isPositionWithinTextUnitInDirection(posId,granularity,direction)
    {
        throw new Error("isPositionWithinTextUnitInDirection: not implemented");
    });

    Input_positionFromPositionToBoundaryInDirection =
        trace(function positionFromPositionToBoundaryInDirection(posId,granularity,direction)
    {
        throw new Error("positionFromPositionToBoundaryInDirection: not implemented");
    });

    Input_rangeEnclosingPositionWithGranularityInDirection =
        trace(function rangeEnclosingPositionWithGranularityInDirection(posId,granularity,direction)
    {
        throw new Error("rangeEnclosingPositionWithGranularityInDirection: not implemented");
    });

})();
