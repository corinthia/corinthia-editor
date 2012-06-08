var AutoCorrect_init;
var AutoCorrect_addCorrection;
var AutoCorrect_removeCorrection;
var AutoCorrect_getCorrections;

var AutoCorrect_correctPrecedingWord;
var AutoCorrect_getCorrection;
var AutoCorrect_getCorrectionCoords;
var AutoCorrect_acceptCorrection;
var AutoCorrect_revertCorrection;
var AutoCorrect_replaceCorrection;

(function() {

    var removeCorrectionSpan = trace(function removeCorrectionSpan(span)
    {
        Selection_preserveWhileExecuting(function() {
            var firstChild = span.firstChild;
            DOM_removeNodeButKeepChildren(span);
            if (firstChild != null)
                Formatting_mergeWithNeighbours(firstChild,{});
        });
    });

    function Correction(span)
    {
        var done = false;
        this.span = span;
        this.modificationListener = function(event) {
            if (DOM_getIgnoreMutations())
                return;
            PostponedActions_add(function() {
                if (done)
                    return;
                done = true;
                // This will trigger a removeCorrection() call
                removeCorrectionSpan(span);
            });
        };
    }

    Correction.prototype.toString = function()
    {
        return this.span.getAttribute("original")+" -> "+getNodeText(this.span);
    }

    var correctionsByNode = null;
    var correctionList = null;

    AutoCorrect_init = trace(function init()
    {
        correctionsByNode = new NodeMap();
        correctionList = new Array();
    });

    AutoCorrect_addCorrection = trace(function addCorrection(span)
    {
        var correction = new Correction(span);
        correctionsByNode.put(span,correction);
        correctionList.push(correction);
        Editor_updateAutoCorrect();

        span.addEventListener("DOMSubtreeModified",correction.modificationListener);
    });

    AutoCorrect_removeCorrection = trace(function removeCorrection(span)
    {
        var correction = correctionsByNode.get(span);
        if (correction == null)
            throw new Error("No autocorrect entry for "+JSON.stringify(getNodeText(span)));

        var index = null;
        for (var i = 0; i < correctionList.length; i++) {
            if (correctionList[i].span == span) {
                index = i;
                break;
            }
        }
        if (index == null)
            throw new Error("Correction "+correction+" not found in correctionList");
        correctionList.splice(index,1);
        Editor_updateAutoCorrect();

        span.removeEventListener("DOMSubtreeModified",correction.modificationListener);
        correctionsByNode.remove(span);
    });

    AutoCorrect_getCorrections = trace(function getCorrections()
    {
        var result = new Array();
        for (var i = 0; i < correctionList.length; i++) {
            var correction = correctionList[i];
            result.push({ original: correction.span.getAttribute("original"),
                          replacement: getNodeText(correction.span)});
        }
        return result;
    });

    AutoCorrect_correctPrecedingWord = trace(function correctPrecedingWord(numChars,replacement)
    {
        var selRange = Selection_get();
        if ((selRange == null) && !selRange.isEmpty())
            return;

        var node = selRange.start.node;
        var offset = selRange.start.offset;
        if (node.nodeType != Node.TEXT_NODE)
            return node;

        var original = node.nodeValue.substring(offset-numChars,offset);

        UndoManager_newGroup("Auto-correct");
        Selection_preserveWhileExecuting(function() {
            var before = node.nodeValue.substring(0,offset-numChars);
            var beforeText = DOM_createTextNode(document,before);
            var replacementText = DOM_createTextNode(document,replacement);
            var span = DOM_createElement(document,"SPAN");
            DOM_setAttribute(span,"class",Keys.AUTOCORRECT_CLASS);
            DOM_setAttribute(span,"original",original);
            DOM_appendChild(span,replacementText);
            DOM_insertBefore(node.parentNode,beforeText,node);
            DOM_insertBefore(node.parentNode,span,node);
            DOM_deleteCharacters(node,0,offset);
        });
        Styles_addDefaultRuleCategory("autocorrect");
        // Add the new group in a postponed action, so that the change to the style element
        // is not counted as a separate action
        PostponedActions_add(UndoManager_newGroup);
    });

    AutoCorrect_getCorrection = trace(function getCorrection()
    {
        var correction = getCurrent();
        if (correction == null)
            return null;

        return { original: correction.span.getAttribute("original"),
                 replacement: getNodeText(correction.span) };
    });

    AutoCorrect_getCorrectionCoords = trace(function getCorrectionCoords()
    {
        var correction = getCurrent();
        if (correction == null)
            return null;

        var textNode = correction.span.firstChild;
        if ((textNode == null) || (textNode.nodeType != Node.TEXT_NODE))
            return null;

        var pos = new Position(textNode,Math.floor(textNode.nodeValue.length/2));
        var rect = Selection_getPositionRect(pos);
        if (rect == null)
            return null;

        return { x: rect.left, y: rect.top };
    });

    var getCurrent = trace(function getCurrent()
    {
        var range = Selection_get();
        if (range != null) {
            var endNode = range.end.closestActualNode();
            for (; endNode != null; endNode = endNode.parentNode) {
                if (isAutoCorrectNode(endNode))
                    return correctionsByNode.get(endNode);
            }
        }

        if (correctionList.length > 0)
            return correctionList[correctionList.length-1];

        return null;
    });

    AutoCorrect_acceptCorrection = trace(function acceptCorrection()
    {
        var correction = getCurrent();
        if (correction == null)
            return;

        UndoManager_newGroup("Accept");
        removeCorrectionSpan(correction.span);
        UndoManager_newGroup();
    });

    AutoCorrect_revertCorrection = trace(function revertCorrection()
    {
        var correction = getCurrent();
        if (correction == null)
            return;

        AutoCorrect_replaceCorrection(correction.span.getAttribute("original"));
    });

    AutoCorrect_replaceCorrection = trace(function replaceCorrection(replacement)
    {
        var correction = getCurrent();
        if (correction == null)
            return;

        UndoManager_newGroup("Replace");
        Selection_preserveWhileExecuting(function() {
            var text = DOM_createTextNode(document,replacement);
            DOM_insertBefore(correction.span.parentNode,text,correction.span);
            DOM_deleteNode(correction.span);
            Formatting_mergeWithNeighbours(text,{});
        });
        UndoManager_newGroup();
    });

})();
