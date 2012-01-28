function debug(str)
{
    console.log(str);
}

var LABEL_HEIGHT = 10;

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

function layout(node,showLabel)
{
    for (var child = node.firstChild; child != null; child = child.nextSibling)
        layout(child,showLabel);

    if (node.firstChild == null)
        node.style.height = LABEL_HEIGHT+"px";
}

var addedLabels = false;

function addLabels(node)
{
    for (var child = node.firstChild; child != null; child = child.nextSibling)
       addLabels(child);

    if (node.nodeType == Node.ELEMENT_NODE) {
        var label = document.createElement("DIV");
        var rect = node.getBoundingClientRect();
        label.setAttribute("class","label");
        label.style.position = "absolute";
        label.style.left = rect.left+"px";
        label.style.top = rect.top+"px";
        label.appendChild(document.createTextNode(node.getAttribute("id")));
        document.body.appendChild(label);
    }
}

var dragging = false;
var selectionRange = null;

function indexOfNodeIn(node,parent)
{
    var index = 0;
    for (var child = parent.firstChild; child != null; child = child.nextSibling) {
        if (child == node)
            return index;
        index++;
    }
    return null;
}

function adjustPosition(position,end)
{
    var parent = position.node.parentNode;
    if (parent != null) {
        var index = indexOfNodeIn(position.node,parent);
        if (index == null)
            throw new Error("Could not get index");

        if (!end && (index > 0)) {
            position.node = parent;
            position.offset = index;
        }
        else if (end && (index < parent.childNodes.length-1)) {
            position.node = parent;
            position.offset = index+1;
        }
    }
}

function updateSelectionDisplay()
{
    clearHighlightsRecursive(rootNode);

    if (selectionRange != null) {

        var tempRange = selectionRange.copy();
//        adjustPosition(tempRange.start,false);
//        adjustPosition(tempRange.end,true);
//        tempRange.convertToOffsetFree();
        if (selectionRange.start.node != tempRange.start.node) {
            debug("start.node mismatch (expected "+
                  selectionRange.start.node.getAttribute("id")+", got "+
                  tempRange.start.node.getAttribute("id")+")");
        }
        if (selectionRange.start.offset != tempRange.start.offset) {
            debug("start.offset mismatch");
        }
        if (selectionRange.end.node != tempRange.end.node) {
            debug("end.node mismatch (expected "+
                  selectionRange.end.node.getAttribute("id")+", got "+
                  tempRange.end.node.getAttribute("id")+")");
        }
        if (selectionRange.end.offset != tempRange.end.offset) {
            debug("end.offset mismatch");
        }

        var useRange = selectionRange.copy();

        useRange.start.node.style.border = "1px solid lime";
        useRange.end.node.style.border = "1px solid red";

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

function mousedown(event)
{
    if (!addedLabels) {
        addLabels(rootNode);
        addedLabels = true;
    }
    if ((event.target.nodeName == "DIV") && (event.target.firstChild == null)) {
        selectionRange = new Range(event.target,0,event.target,0);
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
        if ((node.nodeName == "DIV") && (node.firstChild == null)) {
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
        addNodeAtDepth(2);
        addNodeAtDepth(2);
        addNodeAtDepth(1);
        addNodeAtDepth(1);
        addNodeAtDepth(0);
    }

    layout(rootNode);
    document.body.appendChild(rootNode);

    document.onmousedown = mousedown;
    document.onmousemove = mousemove;
    document.onmouseup = mouseup;
}
