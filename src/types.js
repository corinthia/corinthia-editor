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
