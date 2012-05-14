// Copyright (c) 2012 UX Productivity Pty Ltd. All rights reserved.

var CONTAINER_ELEMENTS = {
    "#document": true,
    "HTML": true,
    "BODY": true,
    "UL": true,
    "OL":  true,
    "LI": true,
    "TABLE": true,
    "CAPTION": true,
    "THEAD": true,
    "TFOOT": true,
    "TBODY": true,
    "TR": true,
    "TH": true,
    "TD": true,
    "COL": true,
    "FIGURE": true,
    "FIGCAPTION": true,
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

var CONTAINER_ELEMENTS_ALLOWING_CONTENT = {
    "BODY": true,
    "LI": true,
    "CAPTION": true,
    "TH": true,
    "TD": true,
    "FIGURE": true,
    "FIGCAPTION": true,
};

var Keys = {
    HEADING_NUMBER: "uxwrite-heading-number",
    FIGURE_NUMBER: "uxwrite-figure-number",
    TABLE_NUMBER: "uxwrite-table-number",
    SECTION_TOC: "uxwrite-section-toc",
    FIGURE_TOC: "uxwrite-figure-toc",
    TABLE_TOC: "uxwrite-table-toc",
    SELECTION_HIGHLIGHT: "uxwrite-selection-highlight",
    AUTOCORRECT_ENTRY: "uxwrite-autocorrect-entry",
    UXWRITE_PREFIX: "uxwrite-",
    NONE_STYLE: "__none",
};

var ITEM_NUMBER_CLASSES = {
    "uxwrite-heading-number": true,
    "uxwrite-figure-number": true,
    "uxwrite-table-number": true,
};

var OPAQUE_NODE_CLASSES = {
    "uxwrite-heading-number": true,
    "uxwrite-figure-number": true,
    "uxwrite-table-number": true,
    "uxwrite-section-toc": true,
    "uxwrite-figure-toc": true,
    "uxwrite-table-toc": true,
    "uxwrite-selection-highlight": true,
};

function isContainerNode(node)
{
    return CONTAINER_ELEMENTS[DOM_upperName(node)];
}

function isParagraphNode(node)
{
    return PARAGRAPH_ELEMENTS[DOM_upperName(node)];
}

function isHeadingNode(node)
{
    return HEADING_ELEMENTS[DOM_upperName(node)];
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
    return ((DOM_upperName(node) == "UL") || (DOM_upperName(node) == "OL"));
}

function isListItemNode(node)
{
    return (DOM_upperName(node) == "LI");
}

function isTableNode(node)
{
    return (DOM_upperName(node) == "TABLE");
}

function isTableCell(node)
{
    return ((DOM_upperName(node) == "TD") ||
            (DOM_upperName(node) == "TH"));
}

function isFigureNode(node)
{
    return (DOM_upperName(node) == "FIGURE");
}

function isRefNode(node)
{
    return ((DOM_upperName(node) == "A") &&
            node.hasAttribute("href") &&
            node.getAttribute("href").charAt(0) == "#");
}

function isImageNode(node)
{
    return (DOM_upperName(node) == "IMG");
}

function isTextNode(node)
{
    return (node.nodeType == Node.TEXT_NODE);
}

function isItemNumber(node)
{
    if (node.nodeType == Node.TEXT_NODE) {
        return isItemNumber(node.parentNode);
    }
    else if (node.nodeType == Node.ELEMENT_NODE) {
        if ((DOM_upperName(node) == "SPAN") && node.hasAttribute("class")) {
            return ITEM_NUMBER_CLASSES[node.getAttribute("class")];
        }
    }
    return false;
}

function isOpaqueNode(node)
{
    if (node == document.body)
        return false;
    if (node.nodeType == Node.TEXT_NODE) {
        return isOpaqueNode(node.parentNode);
    }
    else if (node.nodeType == Node.ELEMENT_NODE) {
        if (((DOM_upperName(node) == "SPAN") || (DOM_upperName(node) == "DIV"))
            && node.hasAttribute("class")) {
            return OPAQUE_NODE_CLASSES[node.getAttribute("class")];
        }
        else if (DOM_upperName(node) == "A") {
            return true;
        }
        else if (isImageNode(node)) {
            return true;
        }
    }
    return isOpaqueNode(node.parentNode);
}
