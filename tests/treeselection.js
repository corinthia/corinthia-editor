function debug(str)
{
    console.log(str);
}

var LABEL_HEIGHT = 10;
var SPACING = 8;
var NODE_WIDTH = 18;
var NODE_HEIGHT = 30;
var LEVEL_SPACING = 40;

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

var layoutX = 0;
var layoutY = 0;

function layout(node)
{
    node.style.position = "absolute";
    node.style.left = layoutX+"px";
    node.style.top = layoutY+"px";
    node.style.width = NODE_WIDTH+"px";
    node.style.height = NODE_HEIGHT+"px";

    if (node.firstChild == null) {
        layoutX += NODE_WIDTH + SPACING;
    }

    var left = layoutX;
    layoutY += NODE_HEIGHT + LEVEL_SPACING;
    for (var child = node.firstChild; child != null; child = child.nextSibling) {
        layout(child);
    }
    layoutY -= NODE_HEIGHT + LEVEL_SPACING;
    var right = layoutX;

    var width = right - left;

    if (node.firstChild != null) {
        node.style.left = (left + width/2 - NODE_WIDTH/2)+"px";
    }
}

function adjustRelativePositions(node)
{
    for (var child = node.firstChild; child != null; child = child.nextSibling) {
        adjustRelativePositions(child);

        var relX = parseInt(child.style.left) - parseInt(node.style.left);
        var relY = parseInt(child.style.top) - parseInt(node.style.top);
        child.style.left = relX+"px";
        child.style.top = relY+"px";
    }
}

function addLines(node,offsetX,offsetY)
{
    if (node.firstChild != null) {
        var nodeX = offsetX + parseInt(node.style.left) + 1;
        var nodeY = offsetY + parseInt(node.style.top) + 1;

        var childrenWidth = 0;
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            childrenWidth += addLines(child,nodeX,nodeY);
        }


        var firstChildX = nodeX + parseInt(node.firstChild.style.left) +
                                  parseInt(node.firstChild.style.width)/2;
        var lastChildX = nodeX + parseInt(node.lastChild.style.left) +
                                 parseInt(node.lastChild.style.width)/2;
        var lineWidth = lastChildX - firstChildX;


        debug("addLines "+node.id+" offset "+offsetX+","+offsetY);
        var nodeWidth = parseInt(node.style.width);

        var horizLineDiv = document.createElement("DIV");
        horizLineDiv.style.position = "absolute";
        horizLineDiv.style.borderTop = "1px solid black";
        horizLineDiv.style.width = lineWidth+"px";
        horizLineDiv.style.height = "0px";
        horizLineDiv.style.left = firstChildX+"px";
        horizLineDiv.style.top = (nodeY + NODE_HEIGHT + LEVEL_SPACING/2)+"px";
        document.body.appendChild(horizLineDiv);

        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            var childX = parseInt(child.style.left);
            var childWidth = parseInt(child.style.width);

            var verticalLineDiv = document.createElement("DIV");
            verticalLineDiv.style.position = "absolute";
            verticalLineDiv.style.borderLeft = "1px solid black";
            verticalLineDiv.style.width = "0px";
            verticalLineDiv.style.height = (LEVEL_SPACING/2)+"px";
            verticalLineDiv.style.top = (nodeY + NODE_HEIGHT + LEVEL_SPACING/2)+"px";
            verticalLineDiv.style.left = (nodeX + childX + childWidth/2)+"px";
            document.body.appendChild(verticalLineDiv);
        }

        var topLine = document.createElement("DIV");
        topLine.style.position = "absolute";
        topLine.style.borderLeft = "1px solid black";
        topLine.style.width = "0px";
        topLine.style.height = (LEVEL_SPACING/2)+"px";
        topLine.style.top = (nodeY + NODE_HEIGHT)+"px";
        topLine.style.left = (nodeX + parseInt(node.style.width)/2)+"px";
        document.body.appendChild(topLine);

        return childrenWidth;
    }
    else {
        return parseInt(node.style.width);
    }
}

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
        label.style.width = node.style.width;
        label.style.textAlign = "center";
        label.appendChild(document.createTextNode(node.getAttribute("id")));
        document.body.appendChild(label);
    }
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
    layout(rootNode);
    adjustRelativePositions(rootNode);
    rootNode.style.left = (parseInt(rootNode.style.left) + 20)+"px";
    rootNode.style.top = (parseInt(rootNode.style.top) + 40)+"px";
    addLines(rootNode,0,0);
    addLabels(rootNode);

    document.onmousedown = mousedown;
    document.onmousemove = mousemove;
    document.onmouseup = mouseup;
}
