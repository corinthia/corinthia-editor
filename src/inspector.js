function quoteString2(str)
{
    if (str == null)
        return null;

    var quoted = "";
    for (var i = 0; i < str.length; i++) {
        if (str.charAt(i) == '"')
            quoted += "\\\"";
        else if (str.charAt(i) == '\\')
            quoted += "\\\\";
        else if (str.charAt(i) == '\r')
            quoted += "\\r";
        else if (str.charAt(i) == '\n')
            quoted += "\\n";
        else if (str.charAt(i) == '\t')
            quoted += "\\t";
        else
            quoted += str.charAt(i);
    }
    return quoted;
}

function arrayContains(array,value)
{
    for (var i = 0; i < array.length; i++) {
        if (array[i] == value)
            return true;
    }
    return false;
}





function Inspector(element)
{
    this.element = element;
    this.document = null;
    this.divElements = new Array();
    this.divNodes = new Array();
}

Inspector.prototype = {
    setDocument: function(doc,win)
    {
        this.doc = doc;
        this.win = win;
        this.update();
    },

    update: function()
    {
        while (this.element.firstChild != null)
            this.element.removeChild(this.element.firstChild);
        this.divElements.length = 0;
        this.divNodes.length = 0;

        if (this.doc == null)
            return;

        this.buildRecursive(this.doc.body,this.element);

        var range = this.win.Range.fromSelection();
        if (range != null) {
//            this.setSelected(range.getAllNodes());
            this.setSelected(cw.getListOperationNodes(range));
        }

        return;

    },

    buildRecursive: function(node,parent)
    {
        var div = this.addRow(node,parent);
        for (var i = 0; i < node.childNodes.length; i++)
            this.buildRecursive(node.childNodes[i],div);
    },

    setSelected: function(nodes)
    {
//        alert("There are "+nodes.length+" nodes selected");
//        for (var i = 0; i < nodes.length; i++)
//            alert(nodes[i].nodeName);
        var firstSelected = null;
        for (var i = 0; i < this.divNodes.length; i++) {
            if (arrayContains(nodes,this.divNodes[i])) {
                this.divElements[i].style.backgroundColor = "#ff0000";
                if (firstSelected == null)
                    firstSelected = this.divElements[i];
            }
            else {
                this.divElements[i].style.backgroundColor = "#f0f0f0";
            }
        }

        console.log("firstSelected = "+firstSelected);
        if (firstSelected != null) {
            var scroll = firstSelected;
            for (var i = 0; i < 3; i++) {
                var temp = scroll;
                do {
                    temp = this.win.prevNode(temp);
                }
                while ((temp != null) && (temp.nodeName != "DIV"));
                if (temp != null)
                    scroll = temp;
            }
            var inspectorFrame = document.getElementById("inspectorFrame");
            var location = inspectorFrame.contentWindow.webkitConvertPointFromNodeToPage(scroll,
                                                            new WebKitPoint(0,0));
            inspectorFrame.contentWindow.scrollTo(0,location.y);
        }
    },

    addRow: function(node,parent)
    {
        var div = document.createElement("div");
        div.style.backgroundColor = "#f0f0f0";
        div.style.borderLeft = "1px solid black";
        div.style.borderTop = "1px solid black";
        div.style.padding = "0px";
        div.style.paddingLeft = "2px";
        div.style.marginLeft = "20px";
        div.style.fontFamily = "monospace";

        var str;

        if (node.nodeType == Node.TEXT_NODE) {
            str = "\""+quoteString2(node.nodeValue)+"\"";
        }
        else {
            str = node.nodeName;
        }

        var text = document.createTextNode(str);
        div.appendChild(text);
        parent.appendChild(div);

        this.divElements.push(div);
        this.divNodes.push(node);
        return div;
    }
};
