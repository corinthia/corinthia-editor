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
    "NAV": true,
};

var CONTAINER_ELEMENT_TYPES = new Array(HTML_COUNT);
CONTAINER_ELEMENT_TYPES[HTML_DOCUMENT] = true;
CONTAINER_ELEMENT_TYPES[HTML_HTML] = true;
CONTAINER_ELEMENT_TYPES[HTML_BODY] = true;
CONTAINER_ELEMENT_TYPES[HTML_UL] = true;
CONTAINER_ELEMENT_TYPES[HTML_OL] = true,
CONTAINER_ELEMENT_TYPES[HTML_LI] = true;
CONTAINER_ELEMENT_TYPES[HTML_TABLE] = true;
CONTAINER_ELEMENT_TYPES[HTML_CAPTION] = true;
CONTAINER_ELEMENT_TYPES[HTML_THEAD] = true;
CONTAINER_ELEMENT_TYPES[HTML_TFOOT] = true;
CONTAINER_ELEMENT_TYPES[HTML_TBODY] = true;
CONTAINER_ELEMENT_TYPES[HTML_TR] = true;
CONTAINER_ELEMENT_TYPES[HTML_TH] = true;
CONTAINER_ELEMENT_TYPES[HTML_TD] = true;
CONTAINER_ELEMENT_TYPES[HTML_COL] = true;
CONTAINER_ELEMENT_TYPES[HTML_FIGURE] = true;
CONTAINER_ELEMENT_TYPES[HTML_FIGCAPTION] = true;
CONTAINER_ELEMENT_TYPES[HTML_NAV] = true;

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

var PARAGRAPH_ELEMENT_TYPES = new Array(HTML_COUNT);
PARAGRAPH_ELEMENT_TYPES[HTML_P] = true;
PARAGRAPH_ELEMENT_TYPES[HTML_H1] = true;
PARAGRAPH_ELEMENT_TYPES[HTML_H2] = true;
PARAGRAPH_ELEMENT_TYPES[HTML_H3] = true;
PARAGRAPH_ELEMENT_TYPES[HTML_H4] = true;
PARAGRAPH_ELEMENT_TYPES[HTML_H5] = true;
PARAGRAPH_ELEMENT_TYPES[HTML_H6] = true;
PARAGRAPH_ELEMENT_TYPES[HTML_DIV] = true;
PARAGRAPH_ELEMENT_TYPES[HTML_PRE] = true;
PARAGRAPH_ELEMENT_TYPES[HTML_BLOCKQUOTE] = true;


var HEADING_ELEMENTS = {
    "H1": true,
    "H2": true,
    "H3": true,
    "H4": true,
    "H5": true,
    "H6": true
}

var HEADING_ELEMENT_TYPES = new Array(HTML_COUNT);
HEADING_ELEMENT_TYPES[HTML_H1] = true;
HEADING_ELEMENT_TYPES[HTML_H2] = true;
HEADING_ELEMENT_TYPES[HTML_H3] = true;
HEADING_ELEMENT_TYPES[HTML_H4] = true;
HEADING_ELEMENT_TYPES[HTML_H5] = true;
HEADING_ELEMENT_TYPES[HTML_H6] = true;

var INLINE_ELEMENTS_THAT_CAN_HAVE_CHILDREN = {
    "A": true,
    "B": true,
    "I": true,
    "U": true,
    "SPAN": true,
};

var INLINE_ALLOWING_CHILDREN_TYPES = new Array(HTML_COUNT);
INLINE_ALLOWING_CHILDREN_TYPES[HTML_A] = true;
INLINE_ALLOWING_CHILDREN_TYPES[HTML_B] = true;
INLINE_ALLOWING_CHILDREN_TYPES[HTML_I] = true;
INLINE_ALLOWING_CHILDREN_TYPES[HTML_U] = true;
INLINE_ALLOWING_CHILDREN_TYPES[HTML_SPAN] = true;

var CONTAINER_ELEMENTS_ALLOWING_CONTENT = {
    "BODY": true,
    "LI": true,
    "CAPTION": true,
    "TH": true,
    "TD": true,
    "FIGURE": true,
    "FIGCAPTION": true,
    "NAV": true,
};

var CONTAINERS_ALLOWING_CONTENT_TYPES = new Array(HTML_COUNT);
CONTAINERS_ALLOWING_CONTENT_TYPES[HTML_BODY] = true;
CONTAINERS_ALLOWING_CONTENT_TYPES[HTML_LI] = true;
CONTAINERS_ALLOWING_CONTENT_TYPES[HTML_CAPTION] = true;
CONTAINERS_ALLOWING_CONTENT_TYPES[HTML_TH] = true;
CONTAINERS_ALLOWING_CONTENT_TYPES[HTML_TD] = true;
CONTAINERS_ALLOWING_CONTENT_TYPES[HTML_FIGURE] = true;
CONTAINERS_ALLOWING_CONTENT_TYPES[HTML_FIGCAPTION] = true;
CONTAINERS_ALLOWING_CONTENT_TYPES[HTML_NAV] = true;

var Keys = {
    HEADING_NUMBER: "uxwrite-heading-number",
    FIGURE_NUMBER: "uxwrite-figure-number",
    TABLE_NUMBER: "uxwrite-table-number",
    SECTION_TOC: "tableofcontents",
    FIGURE_TOC: "listoffigures",
    TABLE_TOC: "listoftables",
    SELECTION_HIGHLIGHT: "uxwrite-selection-highlight",
    AUTOCORRECT_ENTRY: "uxwrite-autocorrect-entry",
    UXWRITE_PREFIX: "uxwrite-",
    NONE_STYLE: "__none",
    AUTOCORRECT_CLASS: "uxwrite-autocorrect",
    SELECTION_CLASS: "uxwrite-selection",
    ABSTRACT_ELEMENT: "uxwrite-abstract",
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
    "tableofcontents": true,
    "listoffigures": true,
    "listoftables": true,
    "uxwrite-selection-highlight": true,
};

function isContainerNode(node)
{
    return CONTAINER_ELEMENT_TYPES[node._type];
}

function isParagraphNode(node)
{
    return PARAGRAPH_ELEMENT_TYPES[node._type];
}

function isHeadingNode(node)
{
    return HEADING_ELEMENT_TYPES[node._type];
}

function isTableCaptionNode(node)
{
    return (node._type == HTML_CAPTION);
}

function isFigureCaptionNode(node)
{
    return (node._type == HTML_FIGCAPTION);
}

function isOutlineItemTitleNode(node)
{
    return (isHeadingNode(node) || isFigureCaptionNode(node) || isTableCaptionNode(node));
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
    var type = node._type;
    return ((type == HTML_UL) || (type == HTML_OL));
}

function isListItemNode(node)
{
    return (node._type == HTML_LI);
}

function isTableNode(node)
{
    return (node._type == HTML_TABLE);
}

function isTableCell(node)
{
    var type = node._type;
    return ((type == HTML_TD) || (type == HTML_TH));
}

function isFigureNode(node)
{
    return (node._type == HTML_FIGURE);
}

function isRefNode(node)
{
    return ((node._type == HTML_A) &&
            node.hasAttribute("href") &&
            node.getAttribute("href").charAt(0) == "#");
}

function isImageNode(node)
{
    return (node._type == HTML_IMG);
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
        if ((node._type == HTML_SPAN) && node.hasAttribute("class")) {
            return ITEM_NUMBER_CLASSES[node.getAttribute("class")];
        }
    }
    return false;
}

function isOpaqueNode(node)
{
    if (node == null)
        return false;
    if (node.nodeType == Node.TEXT_NODE) {
        return isOpaqueNode(node.parentNode);
    }
    else if (node.nodeType == Node.ELEMENT_NODE) {
        if (node.hasAttribute("class") && OPAQUE_NODE_CLASSES[node.getAttribute("class")]) {
            return true;
        }
        else if ((node._type == HTML_A) && node.hasAttribute("href")) {
            return true;
        }
        else if (isImageNode(node)) {
            return true;
        }
    }
    return isOpaqueNode(node.parentNode);
}

function isAutoCorrectNode(node)
{
    return ((node._type == HTML_SPAN) &&
            (node.getAttribute("class") == Keys.AUTOCORRECT_CLASS));
}

function isSelectionHighlight(node)
{
    return ((node.nodeType == Node.ELEMENT_NODE) &&
            node.getAttribute("class") == Keys.SELECTION_CLASS);
}

function isTOCNode(node)
{
    if (node._type == HTML_NAV) {
        var cls = node.getAttribute("class");
        if ((cls == Keys.SECTION_TOC) ||
            (cls == Keys.FIGURE_TOC) ||
            (cls == Keys.TABLE_TOC))
            return true;
    }
    return false;
}

function isInTOC(node)
{
    if (isTOCNode(node))
        return true;
    if (node.parentNode != null)
        return isInTOC(node.parentNode);
    return false;
}

function isSpecialBlockNode(node)
{
    return (isTableNode(node) || isFigureNode(node) || isTOCNode(node));
}

function isContentLeafNode(node)
{
    if (node.nodeType == Node.TEXT_NODE)
        return true;
    if (DOM_upperName(node) == "IMG")
        return true;
    return false;
}

function isAbstractSpan(node)
{
    return ((node._type == HTML_SPAN) && node.hasAttribute(Keys.ABSTRACT_ELEMENT));
}
