function VerticalLayout()
{
}

VerticalLayout.LABEL_HEIGHT = 10;

VerticalLayout.prototype.layout = function(node)
{
    node.style.paddingLeft = "40px";
    node.style.paddingRight = "4px";
    node.style.marginTop = "4px";
    node.style.marginBottom = "4px";

    for (var child = node.firstChild; child != null; child = child.nextSibling)
        this.layout(child);

    if (node.firstChild == null)
        node.style.height = VerticalLayout.LABEL_HEIGHT+"px";
}

VerticalLayout.prototype.addLabels = function(node)
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
        label.appendChild(document.createTextNode(node.getAttribute("id")));
        document.body.appendChild(label);
    }
}

VerticalLayout.prototype.layoutNodes = function(rootNode)
{
    this.layout(rootNode);
    this.addLabels(rootNode);
}
