function setupOutline(topChildren)
{
    var index = 1;

    Outline.init();
    PostponedActions.perform();

    processChildren(1,topChildren);

    PostponedActions.perform();

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
        var heading = DOM.createElement(document,"H"+level);

        DOM.appendChild(heading,DOM.createTextNode(document,"Section "+index));

        var p1 = DOM.createElement(document,"P");
        var p2 = DOM.createElement(document,"P");

        DOM.appendChild(p1,DOM.createTextNode(document,"Content "+index+" A"));
        DOM.appendChild(p2,DOM.createTextNode(document,"Content "+index+" B"));


        DOM.appendChild(document.body,heading);
        DOM.appendChild(document.body,p1);
        DOM.appendChild(document.body,p2);
        index++;

        processChildren(level+1,children);
    }
}

function removeOutlineHTML(node)
{
    if ((node.nodeName == "SPAN") &&
        (node.getAttribute("class") == "-uxwrite-heading-number")) {
        DOM.removeNodeButKeepChildren(node);
    }
    else {
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            removeOutlineHTML(child);
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            mergeWithNeighbours(child);
    }
}

function cleanupOutline()
{
    PostponedActions.perform();
    removeOutlineHTML(document.body);
}
