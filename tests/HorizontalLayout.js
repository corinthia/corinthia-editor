function HorizontalLayout()
{
}

HorizontalLayout.NODE_WIDTH = 18;
HorizontalLayout.NODE_HEIGHT = 30;
HorizontalLayout.LEVEL_SPACING = 40;
HorizontalLayout.SPACING = 8;

HorizontalLayout.prototype.layout = function(node,layoutX,layoutY)
{
    node.style.position = "absolute";
    node.style.left = layoutX+"px";
    node.style.top = layoutY+"px";
    node.style.width = HorizontalLayout.NODE_WIDTH+"px";
    node.style.height = HorizontalLayout.NODE_HEIGHT+"px";

    if (node.firstChild == null) {
        var width = HorizontalLayout.NODE_WIDTH + HorizontalLayout.SPACING;
        layoutX += width;
        return width;
    }
    else {
        var width = 0;

        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            width += this.layout(child,layoutX+width,layoutY+
                                 HorizontalLayout.NODE_HEIGHT+HorizontalLayout.LEVEL_SPACING);
        }

        if (node.firstChild != null) {
            node.style.left = (layoutX + width/2 - HorizontalLayout.NODE_WIDTH/2)+"px";
        }
        return width;
    }
}

HorizontalLayout.prototype.adjustRelativePositions = function(node)
{
    for (var child = node.firstChild; child != null; child = child.nextSibling) {
        this.adjustRelativePositions(child);

        var relX = parseInt(child.style.left) - parseInt(node.style.left);
        var relY = parseInt(child.style.top) - parseInt(node.style.top);
        child.style.left = relX+"px";
        child.style.top = relY+"px";
    }
}

HorizontalLayout.prototype.addLines = function(node,offsetX,offsetY)
{
    if (node.firstChild != null) {
        var nodeX = offsetX + parseInt(node.style.left) + 1;
        var nodeY = offsetY + parseInt(node.style.top) + 1;

        var childrenWidth = 0;
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            childrenWidth += this.addLines(child,nodeX,nodeY);
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
        horizLineDiv.style.top = (nodeY + HorizontalLayout.NODE_HEIGHT +
                                  HorizontalLayout.LEVEL_SPACING/2)+"px";
        document.body.appendChild(horizLineDiv);

        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            var childX = parseInt(child.style.left);
            var childWidth = parseInt(child.style.width);

            var verticalLineDiv = document.createElement("DIV");
            verticalLineDiv.style.position = "absolute";
            verticalLineDiv.style.borderLeft = "1px solid black";
            verticalLineDiv.style.width = "0px";
            verticalLineDiv.style.height = (HorizontalLayout.LEVEL_SPACING/2)+"px";
            verticalLineDiv.style.top = (nodeY + HorizontalLayout.NODE_HEIGHT+
                                         HorizontalLayout.LEVEL_SPACING/2)+"px";
            verticalLineDiv.style.left = (nodeX + childX + childWidth/2)+"px";
            document.body.appendChild(verticalLineDiv);
        }

        var topLine = document.createElement("DIV");
        topLine.style.position = "absolute";
        topLine.style.borderLeft = "1px solid black";
        topLine.style.width = "0px";
        topLine.style.height = (HorizontalLayout.LEVEL_SPACING/2)+"px";
        topLine.style.top = (nodeY + HorizontalLayout.NODE_HEIGHT)+"px";
        topLine.style.left = (nodeX + parseInt(node.style.width)/2)+"px";
        document.body.appendChild(topLine);

        return childrenWidth;
    }
    else {
        return parseInt(node.style.width);
    }
}

HorizontalLayout.prototype.addLabels = function(node)
{
    for (var child = node.firstChild; child != null; child = child.nextSibling)
       this.addLabels(child);

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

HorizontalLayout.prototype.layoutNodes = function(rootNode)
{
    this.layout(rootNode,0,0);
    this.adjustRelativePositions(rootNode);
    rootNode.style.left = (parseInt(rootNode.style.left) + 20)+"px";
    rootNode.style.top = (parseInt(rootNode.style.top) + 40)+"px";
    this.addLines(rootNode,0,0);
    this.addLabels(rootNode);
}
