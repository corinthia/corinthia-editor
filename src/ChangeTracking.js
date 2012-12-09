var ChangeTracking_showChanges;
var ChangeTracking_trackChanges;
var ChangeTracking_setShowChanges;
var ChangeTracking_setTrackChanges;
var ChangeTracking_acceptSelectedChanges;

(function() {

    var showChangesEnabled = false;
    var trackChangesEnabled = false;

    ChangeTracking_showChanges = trace(function showChanges()
    {
        return showChangesEnabled;
    });

    ChangeTracking_trackChanges = trace(function trackChanges()
    {
        return trackChangesEnabled;
    });

    ChangeTracking_setShowChanges = trace(function setShowChanges(enabled)
    {
        showChangesEnabled = enabled;
    });

    ChangeTracking_setTrackChanges = trace(function setTrackChanges(enabled)
    {
        trackChangesEnabled = enabled;
    });

    ChangeTracking_acceptSelectedChanges = trace(function acceptSelectedChanges()
    {
        var selRange = Selection_get();
        if (selRange == null)
            return;

        var outermost = Range_getOutermostNodes(selRange,true);
        var checkEmpty = new Array();

        Selection_preserveWhileExecuting(function() {
            for (var i = 0; i < outermost.length; i++) {
                recurse(outermost[i]);

                var next;
                for (ancestor = outermost[i].parentNode; ancestor != null; ancestor = next) {
                    next = ancestor.parentNode;
                    if (ancestor._type == HTML_DEL) {
                        checkEmpty.push(ancestor.parentNode);
                        DOM_deleteNode(ancestor);
                    }
                    else if (ancestor._type == HTML_INS)
                        DOM_removeNodeButKeepChildren(ancestor);
                }
            }

            for (var i = 0; i < checkEmpty.length; i++) {
                var node = checkEmpty[i];
                if (node == null)
                    continue;
                var empty = true;
                for (var child = node.firstChild; child != null; child = child.nextSibling) {
                    if (!isWhitespaceTextNode(child)) {
                        empty = false;
                        break;
                    }
                }
                if (empty) {
                    switch (node._type) {
                    case HTML_LI:
                    case HTML_UL:
                    case HTML_OL:
                        checkEmpty.push(node.parentNode);
                        DOM_deleteNode(node);
                        break;
                    }
                }
            }
        });

        var selRange = Selection_get();
        if (selRange != null) {
            var start = Position_closestMatchForwards(selRange.start,Position_okForInsertion);
            var end = Position_closestMatchBackwards(selRange.end,Position_okForInsertion);
            if (!Range_isForwards(new Range(start.node,start.offset,end.node,end.offset)))
                end = Position_closestMatchForwards(selRange.end,Position_okForInsertion);
            Selection_set(start.node,start.offset,end.node,end.offset);
        }

        function recurse(node)
        {
            if (node._type == HTML_DEL) {
                checkEmpty.push(node.parentNode);
                DOM_deleteNode(node);
                return;
            }

            var next;
            for (var child = node.firstChild; child != null; child = next) {
                next = child.nextSibling;
                recurse(child);
            }

            if (node._type == HTML_INS) {
                DOM_removeNodeButKeepChildren(node);
            }
        }
    });

})();
