function setupOutline(topChildren)
{
    var index = 1;

    Outline_init();
    PostponedActions_perform();

    processChildren(1,topChildren);

    PostponedActions_perform();

    setNumbering(true);

    function processChildren(level,children)
    {
        if (typeof children == "number") {
            for (var i = 0; i < children; i++)
                recurse(level,null);
        }
        else if (children instanceof Array) {
            for (var i = 0; i < children.length; i++)
                recurse(level,children[i]);
        }
    }

    function recurse(level,children)
    {
        var heading = DOM_createElement(document,"H"+level);

        DOM_appendChild(heading,DOM_createTextNode(document,"Section "+index));

        var p1 = DOM_createElement(document,"P");
        var p2 = DOM_createElement(document,"P");

        DOM_appendChild(p1,DOM_createTextNode(document,"Content "+index+" A"));
        DOM_appendChild(p2,DOM_createTextNode(document,"Content "+index+" B"));


        DOM_appendChild(document.body,heading);
        DOM_appendChild(document.body,p1);
        DOM_appendChild(document.body,p2);
        index++;

        processChildren(level+1,children);
    }
}

function removeOutlineHTML(node)
{
    if ((node.nodeName == "SPAN") &&
        (node.getAttribute("class") == "uxwrite-heading-number")) {
        DOM_removeNodeButKeepChildren(node);
    }
    else {
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            removeOutlineHTML(child);
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            Formatting_mergeWithNeighbours(child,Formatting_MERGEABLE_INLINE);
    }
}

function cleanupOutline()
{
    PostponedActions_perform();
    removeOutlineHTML(document.body);
}
