function debug(str)
{
    console.log(str);
}

var rootNode = null;
var nextNodeId = 0;

function createDiv()
{
    var node = document.createElement("DIV");
    node.setAttribute("id",nextNodeId++);
    node.setAttribute("class","node");
    return node;
}

function addNodeAtDepth(depth)
{
    var parent = rootNode;
    while ((depth > 0) && (parent.lastChild != null)) {
        parent = parent.lastChild;
        depth--;
    }
    while (depth > 0) {
        var temp = createDiv();
        parent.appendChild(temp);
        depth--;
    }
    var temp = createDiv();
    parent.appendChild(temp);
}



var dragging = false;
var selectionRange = null;

function offsetOfNodeInParent(node)
{
    var parent = node.parentNode;
    if (parent == null)
        throw new Error("offsetOfNodeInParent: no parent");

    var index = 0;
    for (var child = parent.firstChild; child != null; child = child.nextSibling) {
        if (child == node)
            return index;
        index++;
    }

    throw new Error("offsetOfNodeInParent: not found");
}

function adjustPosition(position,end)
{
    var parent = position.node.parentNode;
    if (parent != null) {
        var index = offsetOfNodeInParent(position.node);

        if (!end) {
            position.node = parent;
            position.offset = index;
        }
        else {
            position.node = parent;
            position.offset = index+1;
        }
    }
}

function updateSelectionDisplay()
{
    clearHighlightsRecursive(rootNode);

    if (selectionRange != null) {

        debug("");
        debug("");

        var useRange = selectionRange.copy();
        adjustPosition(useRange.start,false);
        adjustPosition(useRange.end,true);
        debug("useRange = "+useRange);

//        useRange.start.node.style.border = "1px solid lime";
//        useRange.end.node.style.border = "1px solid red";


        var startLocation = useRange.start.toLocation();
        var endLocation = useRange.end.toLocation();
        if (startLocation.child != null)
            startLocation.child.style.border = "1px solid lime";
        if (endLocation.child != null)
            endLocation.child.style.border = "1px solid red";



        var nodes = useRange.getOutermostSelectedNodes();
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].nodeType == Node.ELEMENT_NODE)
                nodes[i].style.backgroundColor = "#c0c0c0";
        }
    }

    function clearHighlightsRecursive(node)
    {
        if (node.nodeType == Node.ELEMENT_NODE) {
            node.style.removeProperty("background-color");
            node.style.removeProperty("border");
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                clearHighlightsRecursive(child);
        }
    }
}

var ALLOW_PARENT_SELECTION = false;

function mousedown(event)
{
    var node = event.target;
    if ((node.nodeName == "DIV") &&
        (node.getAttribute("class") == "node") &&
        (ALLOW_PARENT_SELECTION || (node.firstChild == null))) {
        selectionRange = new Range(node,0,node,0);
    }
    else {
        selectionRange = null;
    }
    updateSelectionDisplay();
    dragging = true;
}

function mousemove(event)
{
    if (dragging) {
        var node = event.target;
        if ((node.nodeName == "DIV") &&
            (node.getAttribute("class") == "node") &&
            (ALLOW_PARENT_SELECTION || (node.firstChild == null))) {
            if (selectionRange == null) {
                selectionRange = new Range(node,0,node,0);
            }
            else {
                selectionRange.end = new Position(node,node.childNodes.length);
            }
            updateSelectionDisplay();
        }
    }
}

function mouseup(event)
{
    dragging = false;
}

function loaded()
{
    rootNode = createDiv();

    addNodeAtDepth(0);
    addNodeAtDepth(1);
    addNodeAtDepth(2);
    addNodeAtDepth(3);
    addNodeAtDepth(4);
    addNodeAtDepth(4);
    addNodeAtDepth(4);
    addNodeAtDepth(4);

    for (var i = 0; i < 4; i++) {
        addNodeAtDepth(0);
        addNodeAtDepth(0);
        addNodeAtDepth(1);
        addNodeAtDepth(1);
        addNodeAtDepth(2);
        addNodeAtDepth(2);
        addNodeAtDepth(3);
        addNodeAtDepth(3);
        addNodeAtDepth(3);
        addNodeAtDepth(3);
        addNodeAtDepth(3);
        addNodeAtDepth(2);
        addNodeAtDepth(2);
        addNodeAtDepth(1);
        addNodeAtDepth(1);
        addNodeAtDepth(0);
    }

    document.body.appendChild(rootNode);

//    var layout = new HorizontalLayout();
    var layout = new VerticalLayout();
    layout.layoutNodes(rootNode);

    document.onmousedown = mousedown;
    document.onmousemove = mousemove;
    document.onmouseup = mouseup;
}
