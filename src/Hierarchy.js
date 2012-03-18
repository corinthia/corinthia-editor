// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function() {

    function wrapInlineChildren(first,last,ancestors)
    {
        var haveNonWhitespace = false;
        for (var node = first; node != last.nextSibling; node = node.nextSibling) {
            if (!isWhitespaceTextNode(node))
                haveNonWhitespace = true;
        }
        if (!haveNonWhitespace)
            return false;

        var parentNode = first.parentNode;
        var nextSibling = first;
        for (var i = ancestors.length-1; i >= 0; i--) {
            var ancestorCopy = DOM.shallowCopyElement(ancestors[i]);
            DOM.insertBefore(parentNode,ancestorCopy,nextSibling);
            parentNode = ancestorCopy;
            nextSibling = null;

            var node = first;
            while (true) {
                var next = node.nextSibling;
                DOM.moveNode(node,parentNode,null);
                if (node == last)
                    break;
                node = next;
            }
        }
    }

    function wrapInlineChildrenInAncestors(node,ancestors)
    {
        var firstInline = null;
        var lastInline = null;

        var child = node.firstChild;
        while (true) {
            var next = (child != null) ? child.nextSibling : null;
            if ((child == null) || !isInlineNode(child)) {

                if ((firstInline != null) && (lastInline != null)) {
                    wrapInlineChildren(firstInline,lastInline,ancestors);
                }
                firstInline = null;
                lastInline = null;
                if (child != null)
                    wrapInlineChildrenInAncestors(child,ancestors);
            }
            else {
                if (firstInline == null)
                    firstInline = child;
                lastInline = child;
            }
            if (child == null)
                break;
            child = next;
        }
    }

    // Enforce the restriction that any path from the root to a given node must be of the form
    //    container+ paragraph inline
    // or container+ paragraph
    // or container+
    function ensureValidHierarchy(node,recursive)
    {
        if ((node == null) || (node == document.body))
            return;

        if (node.parentNode == null)
            throw new Error("Node "+DOM.upperName(node)+" \""+node.nodeValue+"\" has been removed");

        if (isContainerNode(node) || isParagraphNode(node)) {
            if (!isContainerNode(node.parentNode) && !isParagraphNode(node.parentNode)) {
                DOM.removeAdjacentWhitespace(node);

                var offset = getOffsetOfNodeInParent(node);
                Formatting.moveFollowing(node.parentNode,offset+1,isContainerNode);
                Formatting.movePreceding(node.parentNode,offset,isContainerNode);

                var ancestors = new Array();
                var child = node;
                while (!isContainerNode(child.parentNode)) {
                    if (isInlineNode(child.parentNode))
                        ancestors.push(child.parentNode);
                    child = child.parentNode;
                }
                DOM.moveNode(node,child.parentNode,child);
                DOM.deleteNode(child);

                wrapInlineChildrenInAncestors(node,ancestors);
            }
        }
        else { // inline node
            if (isContainerNode(node.parentNode) && !isWhitespaceTextNode(node)) {
                // Wrap this node in a P element

                var start = node;
                var end = node;

                while ((start.previousSibling != null) && isInlineNode(start.previousSibling))
                    start = start.previousSibling;
                while ((end.nextSibling != null) && isInlineNode(end.nextSibling))
                    end = end.nextSibling;

                var p = DOM.createElement(document,"P");
                // p.style.border = "4px dashed red"; // debug
                DOM.insertBefore(node.parentNode,p,start);

                var stop = end.nextSibling;
                while (p.nextSibling != stop)
                    DOM.moveNode(p.nextSibling,p,null);
            }
        }

        if (recursive)
            ensureValidHierarchy(node.parentNode,true);
    }

    window.Hierarchy = new Object();
    Hierarchy.ensureValidHierarchy = ensureValidHierarchy;

})();
