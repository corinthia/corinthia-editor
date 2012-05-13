(function() {

    function getHTML(root)
    {
        var copy = DOM_cloneNode(root,true);
        for (var body = copy.firstChild; body != null; body = body.nextSibling) {
            if (body.nodeName == "BODY") {
                body.removeAttribute("style");
                body.removeAttribute("contentEditable");
            }
        }

        var builder = { str : "" };
        prettyPrint(builder,copy,"");
        return builder.str;
    }

    function trim(str)
    {
        var start = 0;
        var end = str.length;

        while ((start < str.length) &&
               ((str.charAt(start) == " ") ||
                (str.charAt(start) == "\t") ||
                (str.charAt(start) == "\r") ||
                (str.charAt(start) == "\n")))
            start++;

        while ((end > start) &&
               ((str.charAt(end-1) == " ") ||
                (str.charAt(end-1) == "\t") ||
                (str.charAt(end-1) == "\r") ||
                (str.charAt(end-1) == "\n")))
            end--;

        return str.slice(start,end);
    }

    function singleDescendents(node)
    {
        var count = 0;
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            if ((child.nodeType == Node.TEXT_NODE) && (trim(child.nodeValue).length == 0))
                continue;
            count++;
            if (count > 1)
                return false;
            if (!singleDescendents(child))
                return false;
        }
        return true;
    }

    function sortCSSProperties(value)
    {
        // Make sure the CSS properties on the "style" attribute appear in a consistent order
        var items = value.trim().split(/\s*;\s*/);
        if ((items.length > 0) && (items[items.length-1] == ""))
            items.length--;
        items.sort();
        return items.join("; ");
    }

    function attributeString(node)
    {
        // Make sure the attributes appear in a consistent order
        var names = new Array();
        for (var i = 0; i < node.attributes.length; i++) {
            names.push(node.attributes[i].nodeName);
        }
        names.sort();
        var str = "";
        for (var i = 0; i < names.length; i++) {
            var name = names[i];
            var value = node.getAttribute(name);
            if (name == "style")
                value = sortCSSProperties(value);
            var attr = node.getAttributeNode(name);
            if ((attr.namespaceURI != null) || (attr.prefix != null))
                name = "{"+attr.namespaceURI+","+attr.prefix+","+attr.localName+"}"+name;
            str += " "+name+"=\""+value+"\"";
        }
        return str;
    }

    function prettyPrintOneLine(builder,node)
    {
        if ((node.nodeType == Node.ELEMENT_NODE) && (node.nodeName != "SCRIPT")) {
            var name = node.nodeName.toLowerCase();
            if (node.firstChild == null) {
                builder.str += "<" + name + attributeString(node) + "/>";
            }
            else {
                builder.str += "<" + name + attributeString(node) + ">";
                for (var child = node.firstChild; child != null; child = child.nextSibling)
                    prettyPrintOneLine(builder,child);
                builder.str += "</" + name + ">";
            }
        }
        else if (node.nodeType == Node.TEXT_NODE) {
            var value = trim(node.nodeValue);
//            var value = JSON.stringify(node.nodeValue);
            if (value.length > 0)
                builder.str += value;
        }
        else if (node.nodeType == Node.COMMENT_NODE) {
            builder.str += "<!--" + node.nodeValue + "-->\n";
        }
    }

    function prettyPrint(builder,node,indent)
    {
        if ((node.nodeType == Node.ELEMENT_NODE) && (node.nodeName != "SCRIPT")) {
            var name = node.nodeName.toLowerCase();
            if (node.firstChild == null) {
                builder.str += indent + "<" + name + attributeString(node) + "/>\n";
            }
            else {
                if (DOM_upperName(node) == "STYLE") {
                    builder.str += indent + "<" + name + attributeString(node) + ">\n";
                    for (var child = node.firstChild; child != null; child = child.nextSibling)
                        prettyPrint(builder,child,"");
                    builder.str += indent + "</" + name + ">\n";
                }
                else if (singleDescendents(node)) {
                    builder.str += indent;
                    prettyPrintOneLine(builder,node);
                    builder.str += "\n";
                }
                else {
                    builder.str += indent + "<" + name + attributeString(node) + ">\n";
                    for (var child = node.firstChild; child != null; child = child.nextSibling)
                        prettyPrint(builder,child,indent+"  ");
                    builder.str += indent + "</" + name + ">\n";
                }
            }
        }
        else if (node.nodeType == Node.TEXT_NODE) {
            var value = trim(node.nodeValue);
//            var value = JSON.stringify(node.nodeValue);
            if (value.length > 0)
                builder.str += indent + value + "\n";
        }
        else if (node.nodeType == Node.COMMENT_NODE) {
            builder.str += indent + "<!--" + node.nodeValue + "-->\n";
        }
    }

    window.PrettyPrinter = new Object();
    window.PrettyPrinter.getHTML = getHTML;
    window.PrettyPrinter.trim = trim;

})();
