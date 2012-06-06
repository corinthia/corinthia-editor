var AutoCorrect_addCorrection;
var AutoCorrect_removeCorrection;

(function() {

    function Correction(original,span)
    {
        var correction = this;
        this.original = original;
        this.span = span;
        this.modificationListener = function() {
            PostponedActions_add(function() {
                debug("Detected modification of correction "+getNodeText(correction.span));
                correctionChanged(correction);
            });
        };
    }

    var coorectionsByNode = null;

    function correctionChanged(correction)
    {
        AutoCorrect_removeCorrection(correction.span);
        DOM_removeNodeButKeepChildren(correction.span);
    };

    AutoCorrect_addCorrection = trace(function addCorrection(span)
    {
        checkInit();

        var correction = new Correction(null,span);
        correctionsByNode.put(span,correction);

        span.addEventListener("DOMSubtreeModified",correction.modificationListener);

        debug("AutoCorrect_addCorrection "+JSON.stringify(getNodeText(span))+": now have "+
              correctionsByNode.getKeys().length+" corrections");
    });

    AutoCorrect_removeCorrection = trace(function removeCorrection(span)
    {
        checkInit();
        var correction = correctionsByNode.get(span);
        if (correction == null)
            throw new Error("No autocorrect entry for "+JSON.stringify(getNodeText(span)));

        span.removeEventListener("DOMSubtreeModified",correction.modificationListener);
        correctionsByNode.remove(span);

        debug("AutoCorrect_removeCorrection "+JSON.stringify(getNodeText(span))+": now have "+
              correctionsByNode.getKeys().length+" corrections");
    });

    var initDone = false;
    var checkInit = trace(function checkInit()
    {
        if (initDone)
            return;
        initDone = true;
        correctionsByNode = new NodeMap();
    });

})();
