var Scan_reset;
var Scan_next;
var Scan_addMatch;
var Scan_showMatch;
var Scan_replaceMatch;
var Scan_removeMatch;
var Scan_goToMatch;

(function() {

    function Match(matchId,startPos,endPos)
    {
        this.matchId = matchId;
        this.startPos = startPos;
        this.endPos = endPos;
        this.spans = new Array();
    }

    var matchesById = new Object();
    var nextMatchId = 1;

    var curPos = null;
    var curParagraph = null;

    Scan_reset = trace(function _Scan_reset() {
        curPos = new Position(document.body,0);
        curParagraph = null;
        clearMatches();
    });

    Scan_next = trace(function _Scan_next() {
        if (curPos == null)
            return null;
        curPos = Text_toEndOfBoundary(curPos,"paragraph");
        if (curPos == null)
            return null;

        curParagraph = Text_analyseParagraph(curPos);
        if (curParagraph == null)
            return null;

        curPos = Position_nextMatch(curPos,Position_okForMovement);

        var sectionId = null;
        if (isHeadingNode(curParagraph.node) &&
            (curParagraph.startOffset == 0) &&
            (curParagraph.endOffset == curParagraph.node.childNodes.length)) {
            sectionId = DOM_getAttribute(curParagraph.node,"id");
        }

        return { text: curParagraph.text,
                 sectionId: sectionId };
    });

    Scan_addMatch = trace(function _Scan_addMatch(start,end) {
        if (curParagraph == null)
            throw new Error("curParagraph is null");
        if ((start < 0) || (start > curParagraph.text.length))
            throw new Error("invalid start");
        if ((end < start) || (end > curParagraph.text.length))
            throw new Error("invalid end");

        var matchId = nextMatchId++;

        var startRun = Paragraph_runFromOffset(curParagraph,start);
        var endRun = Paragraph_runFromOffset(curParagraph,end);

        if (startRun == null)
            throw new Error("No start run");
        if (endRun == null)
            throw new Error("No end run");

        var startPos = new Position(startRun.node,start - startRun.start);
        var endPos = new Position(endRun.node,end - endRun.start);
        Position_track(startPos);
        Position_track(endPos);

        var match = new Match(matchId,startPos,endPos);
        matchesById[matchId] = match;
        return matchId;
    });

    Scan_showMatch = trace(function _Scan_showMatch(matchId)
    {
        var match = matchesById[matchId];
        if (match == null)
            throw new Error("Match "+matchId+" not found");

        var range = new Range(match.startPos.node,match.startPos.offset,
                              match.endPos.node,match.endPos.offset);
        var text = Range_getText(range);
        Formatting_splitAroundSelection(range,true);
        var outermost = Range_getOutermostNodes(range);
        for (var i = 0; i < outermost.length; i++) {
            var span = DOM_wrapNode(outermost[i],"SPAN");
            DOM_setAttribute(span,"class",Keys.MATCH_CLASS);
            match.spans.push(span);
        }
    });

    Scan_replaceMatch = trace(function _Scan_replaceMatch(matchId,replacement)
    {
        var match = matchesById[matchId];
        if (match == null)
            throw new Error("Match "+matchId+" not found");

        if (match.spans.length == 0)
            return;

        var span = match.spans[0];

        Selection_preserveWhileExecuting(function() {
            var replacementNode = DOM_createTextNode(document,replacement);
            DOM_insertBefore(span.parentNode,replacementNode,span);

            for (var i = 0; i < match.spans.length; i++)
                DOM_deleteNode(match.spans[i]);

            Formatting_mergeUpwards(replacementNode,Formatting_MERGEABLE_INLINE);
        });

        delete matchesById[matchId];
    });

    var removeSpansForMatch = trace(function _removeSpansForMatch(match)
    {
        for (var i = 0; i < match.spans.length; i++)
            DOM_removeNodeButKeepChildren(match.spans[i]);
    });

    Scan_removeMatch = trace(function _Scan_removeMatch(matchId)
    {
        removeSpansForMatch(matchesById[matchId]);
        delete matchesById[matchId];
    });

    Scan_goToMatch = trace(function _Scan_goToMatch(matchId)
    {
        var match = matchesById[matchId];
        if (match == null)
            throw new Error("Match "+matchId+" not found");

        Selection_set(match.startPos.node,match.startPos.offset,
                      match.endPos.node,match.endPos.offset);
        Cursor_ensurePositionVisible(match.startPos);
    });

    var clearMatches = trace(function _clearMatches()
    {
        for (var matchId in matchesById) {
            var match = matchesById[matchId];
            removeSpansForMatch(match);
            Position_untrack(match.startPos);
            Position_untrack(match.endPos);
        }

        matchesById = new Object();
        nextMatchId = 1;
    });

})();
