var WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function isWordElement(node,name)
{
    return (node.namespaceURI == WORD_NAMESPACE) && (node.localName == name);
}

function debug(str)
{
    console.log(str);
}

function warning(str)
{
    console.log("WARNING: "+str);
}

function childVal(node,namespaceURI,localName)
{
    for (var child = node.firstChild; child != null; child = child.nextSibling) {
        if ((child.namespaceURI == namespaceURI) && (child.localName == localName)) {
            return child.getAttributeNS(namespaceURI,"val");
        }
    }
    return null;
}

function firstChildElement(node)
{
    for (var child = node.firstChild; child != null; child = child.nextSibling) {
        if (child.nodeType == Node.ELEMENT_NODE)
            return child;
    }
    return null;
}

function findChildElement(node,namespaceURI,localName)
{
    for (var child = node.firstChild; child != null; child = child.nextSibling) {
        if ((child.nodeType == Node.ELEMENT_NODE) &&
            (child.namespaceURI == namespaceURI) &&
            (child.localName == localName))
            return child;
    }
    return null;
}
