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
    "PRE": true,
    "BLOCKQUOTE": true
};

var HEADING_ELEMENTS = {
    "H1": true,
    "H2": true,
    "H3": true,
    "H4": true,
    "H5": true,
    "H6": true
}

var INLINE_ELEMENTS_THAT_CAN_HAVE_CHILDREN = {
    "A": true,
    "B": true,
    "I": true,
    "U": true,
    "SPAN": true,
};

var Keys = {
    HEADING_NUMBER: "-uxwrite-heading-number",
    FIGURE_NUMBER: "-uxwrite-figure-number",
    TABLE_NUMBER: "-uxwrite-table-number",
    SELECTION_HIGHLIGHT: "-uxwrite-selection-highlight",
    UXWRITE_PREFIX: "-uxwrite-",
};

var OPAQUE_NODE_CLASSES = {
    "-uxwrite-heading-number": true,
    "-uxwrite-figure-number": true,
    "-uxwrite-table-number": true,
    "-uxwrite-selection-highlight": true,
};

function isContainerNode(node)
{
    return CONTAINER_ELEMENTS[DOM.upperName(node)];
}

function isParagraphNode(node)
{
    return PARAGRAPH_ELEMENTS[DOM.upperName(node)];
}

function isHeadingNode(node)
{
    return HEADING_ELEMENTS[DOM.upperName(node)];
}

function isBlockNode(node)
{
    return (isContainerNode(node) || isParagraphNode(node));
}

function isInlineNode(node)
{
    return !isBlockNode(node);
}

function isListNode(node)
{
    return ((DOM.upperName(node) == "UL") || (DOM.upperName(node) == "OL"));
}

function isListItemNode(node)
{
    return (DOM.upperName(node) == "LI");
}

function isTableNode(node)
{
    return (DOM.upperName(node) == "TABLE");
}

function isFigureNode(node)
{
    return (DOM.upperName(node) == "FIGURE");
}

function isRefNode(node)
{
    return ((DOM.upperName(node) == "A") &&
            node.hasAttribute("href") &&
            node.getAttribute("href").charAt(0) == "#");
}

function isOpaqueNode(node)
{
    if (node.nodeType == Node.TEXT_NODE) {
        return isOpaqueNode(node.parentNode);
    }
    else if (node.nodeType == Node.ELEMENT_NODE) {
        if (((DOM.upperName(node) == "SPAN") || (DOM.upperName(node) == "DIV"))
            && node.hasAttribute("class")) {
            return OPAQUE_NODE_CLASSES[node.getAttribute("class")];
        }
        else if ((DOM.upperName(node) == "A") && node.hasAttribute("href")) {
            var href = node.getAttribute("href");
            return ((href.indexOf("#section") == 0) ||
                    (href.indexOf("#figure") == 0) ||
                    (href.indexOf("#table") == 0));
        }
    }
    return false;
}
