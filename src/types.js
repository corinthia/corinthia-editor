var CONTAINER_ELEMENTS = {
    "#document": true,
    "HTML": true,
    "BODY": true,
    "UL": true,
    "OL":  true,
    "LI": true,
    "TABLE": true,
    "THEAD": true,
    "TFOOT": true,
    "TBODY": true,
    "TR": true,
    "TH": true,
    "TD": true,
    "COL": true
};

var PARAGRAPH_ELEMENTS = {
    "P": true,
    "H1": true,
    "H2": true,
    "H3": true,
    "H4": true,
    "H5": true,
    "H6": true,
    "DIV": true,
    "PRE": true
};

var HEADING_ELEMENTS = {
    "H1": true,
    "H2": true,
    "H3": true,
    "H4": true,
    "H5": true,
    "H6": true
}

var Keys = {
    HEADING_NUMBER: "-uxwrite-heading-number",
    FIGURE_NUMBER: "-uxwrite-figure-number",
    TABLE_NUMBER: "-uxwrite-table-number",
};

var OPAQUE_NODE_CLASSES = {
    "-uxwrite-heading-number": true,
    "-uxwrite-figure-number": true,
    "-uxwrite-table-number": true,
};

function isContainerNode(node)
{
    return CONTAINER_ELEMENTS[node.nodeName];
}

function isParagraphNode(node)
{
    return PARAGRAPH_ELEMENTS[node.nodeName];
}

function isHeadingNode(node)
{
    return HEADING_ELEMENTS[node.nodeName];
}

function isParagraphOrContainerNode(node)
{
    return (isContainerNode(node) || isParagraphNode(node));
}

function isInlineNode(node)
{
    return (!isContainerNode(node) && !isParagraphNode(node));
}

function isOpaqueNode(node)
{
    if (node.nodeType == Node.TEXT_NODE) {
        return isOpaqueNode(node.parentNode);
    }
    else if (node.nodeType == Node.ELEMENT_NODE) {
        if ((node.nodeName == "SPAN") && node.hasAttribute("class")) {
            return OPAQUE_NODE_CLASSES[node.getAttribute("class")];
        }
        else if ((node.nodeName == "A") && node.hasAttribute("href")) {
            var href = node.getAttribute("href");
            return ((href.indexOf("#section") == 0) ||
                    (href.indexOf("#figure") == 0) ||
                    (href.indexOf("#table") == 0));
        }
    }
    return false;
}
