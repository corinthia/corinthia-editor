var Search_reset;
var Search_next;
var Search_addMatch;
var Search_showMatch;
var Search_replaceMatch;
var Search_removeMatch;

(function() {

    function Match(matchId,startPos,endPos,type)
    {
        this.matchId = matchId;
        this.startPos = startPos;
        this.endPos = endPos;
        this.type = type;
    }

    var matchesById = new Object();
    var nextMatchId = 0;

    var curPos = null;
    var curParagraph = null;

    Search_reset = trace(function _Search_reset() {
        curPos = new Position(document.body,0);
        curParagraph = null;
    });

    Search_next = trace(function _Search_next() {
        if (curPos == null)
            return null;
        curPos = Text_toEndOfBoundary(curPos,"paragraph");
        if (curPos == null)
            return null;

        curParagraph = Text_analyseParagraph(curPos);
        if (curParagraph == null)
            return null;

//        var str = "curPos: "+curPos+" -> ";
        curPos = Position_nextMatch(curPos,Position_okForMovement);
//        debug(str+curPos);

        return { text: curParagraph.text };
    });

    Search_addMatch = trace(function _Search_addMatch(start,end,type) {
//        if (curPos == null)
//            throw new Error("curPos is null");
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
        Position_track(startPos); // FIXME: untrack later
        Position_track(endPos); // FIXME: untrack later

        var match = new Match(matchId,startPos,endPos,type);
        matchesById[matchId] = match;
        return matchId;
    });

    Search_showMatch = trace(function _Search_showMatch(matchId)
    {
        var match = matchesById[matchId];
        if (match == null)
            throw new Error("Match "+matchId+" not found");

        var range = new Range(match.startPos.node,match.startPos.offset,
                              match.endPos.node,match.endPos.offset);
        var text = Range_getText(range);
        debug("---Match "+matchId+": "+JSON.stringify(text));
        Formatting_splitAroundSelection(range,true);
        var outermost = Range_getOutermostNodes(range);
        for (var i = 0; i < outermost.length; i++) {
//            var span = DOM_createElement(document,"SPAN");
            var span = DOM_wrapNode(outermost[i],"SPAN");
            DOM_setAttribute(span,"class",Keys.MATCH_CLASS);
        }
    });

    Search_replaceMatch = trace(function _Search_replaceMatch(matchId,replacement)
    {
    });

    Search_removeMatch = trace(function _Search_removeMatch(matchId)
    {
        printTree(document.body);
    });

})();
