var AutoCorrect_addCorrection;
var AutoCorrect_removeCorrection;
var AutoCorrect_getCorrections;

var AutoCorrect_correctPrecedingWord;
var AutoCorrect_getLatest;
var AutoCorrect_acceptLatest;
var AutoCorrect_revertLatest;
var AutoCorrect_replaceLatest;

(function() {

    var removeCorrectionSpan = trace(function removeCorrectionSpan(span)
    {
        var firstChild = span.firstChild;
        DOM_removeNodeButKeepChildren(span);
        if (firstChild != null)
            Formatting_mergeWithNeighbours(firstChild,{});
    });

    function Correction(span)
    {
        this.span = span;
        this.modificationListener = function() {
            PostponedActions_add(function() {
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
    var initDone = false;

    var checkInit = trace(function checkInit()
    {
        if (initDone)
            return;
        initDone = true;
        correctionsByNode = new NodeMap();
        correctionList = new Array();
    });

    AutoCorrect_addCorrection = trace(function addCorrection(span)
    {
        checkInit();

        var correction = new Correction(span);
        correctionsByNode.put(span,correction);
        correctionList.push(correction);

        span.addEventListener("DOMSubtreeModified",correction.modificationListener);
    });

    AutoCorrect_removeCorrection = trace(function removeCorrection(span)
    {
        checkInit();
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

        span.removeEventListener("DOMSubtreeModified",correction.modificationListener);
        correctionsByNode.remove(span);
    });

    AutoCorrect_getCorrections = trace(function getCorrections()
    {
        checkInit();
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

    AutoCorrect_getLatest = trace(function getLatest()
    {
        if (correctionList.length == 0)
            return null;

        var correction = correctionList[correctionList.length-1];
        return { original: correction.span.getAttribute("original"),
                 replacement: getNodeText(correction.span) };
    });

    AutoCorrect_acceptLatest = trace(function acceptLatest()
    {
        if (correctionList.length == 0)
            return null;

        UndoManager_newGroup("Accept");
        var correction = correctionList[correctionList.length-1];
        removeCorrectionSpan(correction.span);
        UndoManager_newGroup();
    });

    AutoCorrect_revertLatest = trace(function revertLatest()
    {
        if (correctionList.length == 0)
            return null;

        var correction = correctionList[correctionList.length-1];
        AutoCorrect_replaceLatest(correction.span.getAttribute("original"));
    });

    AutoCorrect_replaceLatest = trace(function replaceLatest(replacement)
    {
        if (correctionList.length == 0)
            return null;

        UndoManager_newGroup("Replace");
        var correction = correctionList[correctionList.length-1];
        var text = DOM_createTextNode(document,replacement);
        DOM_insertBefore(correction.span.parentNode,text,correction.span);
        DOM_deleteNode(correction.span);
        Formatting_mergeWithNeighbours(text,{});
        UndoManager_newGroup();
    });

})();
