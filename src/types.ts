// This file is part of the Corinthia project (http://corinthia.io).
//
// See the COPYRIGHT.txt file distributed with this work for
// information regarding copyright ownership.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import DOM = require("./dom");
import ElementTypes = require("./elementTypes");
import Util = require("./util");

let CONTAINER_ELEMENTS = new Array(ElementTypes.HTML_COUNT);
CONTAINER_ELEMENTS[ElementTypes.HTML_DOCUMENT] = true;
CONTAINER_ELEMENTS[ElementTypes.HTML_HTML] = true;
CONTAINER_ELEMENTS[ElementTypes.HTML_BODY] = true;
CONTAINER_ELEMENTS[ElementTypes.HTML_UL] = true;
CONTAINER_ELEMENTS[ElementTypes.HTML_OL] = true,
CONTAINER_ELEMENTS[ElementTypes.HTML_LI] = true;
CONTAINER_ELEMENTS[ElementTypes.HTML_TABLE] = true;
CONTAINER_ELEMENTS[ElementTypes.HTML_CAPTION] = true;
CONTAINER_ELEMENTS[ElementTypes.HTML_THEAD] = true;
CONTAINER_ELEMENTS[ElementTypes.HTML_TFOOT] = true;
CONTAINER_ELEMENTS[ElementTypes.HTML_TBODY] = true;
CONTAINER_ELEMENTS[ElementTypes.HTML_TR] = true;
CONTAINER_ELEMENTS[ElementTypes.HTML_TH] = true;
CONTAINER_ELEMENTS[ElementTypes.HTML_TD] = true;
CONTAINER_ELEMENTS[ElementTypes.HTML_COL] = true;
CONTAINER_ELEMENTS[ElementTypes.HTML_FIGURE] = true;
CONTAINER_ELEMENTS[ElementTypes.HTML_FIGCAPTION] = true;
CONTAINER_ELEMENTS[ElementTypes.HTML_NAV] = true;

export let PARAGRAPH_ELEMENTS = new Array(ElementTypes.HTML_COUNT);
PARAGRAPH_ELEMENTS[ElementTypes.HTML_P] = true;
PARAGRAPH_ELEMENTS[ElementTypes.HTML_H1] = true;
PARAGRAPH_ELEMENTS[ElementTypes.HTML_H2] = true;
PARAGRAPH_ELEMENTS[ElementTypes.HTML_H3] = true;
PARAGRAPH_ELEMENTS[ElementTypes.HTML_H4] = true;
PARAGRAPH_ELEMENTS[ElementTypes.HTML_H5] = true;
PARAGRAPH_ELEMENTS[ElementTypes.HTML_H6] = true;
PARAGRAPH_ELEMENTS[ElementTypes.HTML_DIV] = true;
PARAGRAPH_ELEMENTS[ElementTypes.HTML_PRE] = true;
PARAGRAPH_ELEMENTS[ElementTypes.HTML_BLOCKQUOTE] = true;

let BLOCK_ELEMENTS = new Array(ElementTypes.HTML_COUNT);
for (let i = 0; i < ElementTypes.HTML_COUNT; i++)
    BLOCK_ELEMENTS[i] = (CONTAINER_ELEMENTS[i] || PARAGRAPH_ELEMENTS[i]);

let INLINE_ELEMENTS = new Array(ElementTypes.HTML_COUNT);
for (let i = 0; i < ElementTypes.HTML_COUNT; i++)
    INLINE_ELEMENTS[i] = !BLOCK_ELEMENTS[i];

export let HEADING_ELEMENTS = new Array(ElementTypes.HTML_COUNT);
HEADING_ELEMENTS[ElementTypes.HTML_H1] = true;
HEADING_ELEMENTS[ElementTypes.HTML_H2] = true;
HEADING_ELEMENTS[ElementTypes.HTML_H3] = true;
HEADING_ELEMENTS[ElementTypes.HTML_H4] = true;
HEADING_ELEMENTS[ElementTypes.HTML_H5] = true;
HEADING_ELEMENTS[ElementTypes.HTML_H6] = true;

export let CONTAINERS_ALLOWING_CHILDREN = new Array(ElementTypes.HTML_COUNT);
CONTAINERS_ALLOWING_CHILDREN[ElementTypes.HTML_BODY] = true;
CONTAINERS_ALLOWING_CHILDREN[ElementTypes.HTML_LI] = true;
CONTAINERS_ALLOWING_CHILDREN[ElementTypes.HTML_CAPTION] = true;
CONTAINERS_ALLOWING_CHILDREN[ElementTypes.HTML_TH] = true;
CONTAINERS_ALLOWING_CHILDREN[ElementTypes.HTML_TD] = true;
CONTAINERS_ALLOWING_CHILDREN[ElementTypes.HTML_FIGURE] = true;
CONTAINERS_ALLOWING_CHILDREN[ElementTypes.HTML_FIGCAPTION] = true;
CONTAINERS_ALLOWING_CHILDREN[ElementTypes.HTML_NAV] = true;

export let OUTLINE_TITLE_ELEMENTS = new Array(ElementTypes.HTML_COUNT);
OUTLINE_TITLE_ELEMENTS[ElementTypes.HTML_H1] = true;
OUTLINE_TITLE_ELEMENTS[ElementTypes.HTML_H2] = true;
OUTLINE_TITLE_ELEMENTS[ElementTypes.HTML_H3] = true;
OUTLINE_TITLE_ELEMENTS[ElementTypes.HTML_H4] = true;
OUTLINE_TITLE_ELEMENTS[ElementTypes.HTML_H5] = true;
OUTLINE_TITLE_ELEMENTS[ElementTypes.HTML_H6] = true;
OUTLINE_TITLE_ELEMENTS[ElementTypes.HTML_FIGCAPTION] = true;
OUTLINE_TITLE_ELEMENTS[ElementTypes.HTML_CAPTION] = true;

export const Keys = {
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
    SPELLING_CLASS: "uxwrite-spelling",
    MATCH_CLASS: "uxwrite-match",
};

let ITEM_NUMBER_CLASSES = {
    "uxwrite-heading-number": true,
    "uxwrite-figure-number": true,
    "uxwrite-table-number": true,
};

let OPAQUE_NODE_CLASSES = {
    "uxwrite-heading-number": true,
    "uxwrite-figure-number": true,
    "uxwrite-table-number": true,
    "tableofcontents": true,
    "listoffigures": true,
    "listoftables": true,
    "uxwrite-selection-highlight": true,
    "uxwrite-field": true,
};

export function isContainerNode(node) {
    return CONTAINER_ELEMENTS[node._type];
}

export function isParagraphNode(node) {
    return PARAGRAPH_ELEMENTS[node._type];
}

export function isHeadingNode(node) {
    return HEADING_ELEMENTS[node._type];
}

export function isBlockNode(node) {
    return BLOCK_ELEMENTS[node._type];
}

export function isBlockOrNoteNode(node) {
    return BLOCK_ELEMENTS[node._type] || isNoteNode(node);
}

export function isInlineNode(node) {
    return INLINE_ELEMENTS[node._type];
}

export function isListNode(node) {
    let type = node._type;
    return ((type == ElementTypes.HTML_UL) || (type == ElementTypes.HTML_OL));
}

export function isTableCell(node) {
    switch (node._type) {
    case ElementTypes.HTML_TD:
    case ElementTypes.HTML_TH:
        return true;
    default:
        return false;
    }
}

export function isRefNode(node) {
    return ((node._type == ElementTypes.HTML_A) &&
            node.hasAttribute("href") &&
            node.getAttribute("href").charAt(0) == "#");
}

export function isNoteNode(node) {
    if (node._type != ElementTypes.HTML_SPAN)
        return false;
    let className = DOM.getAttribute(node,"class");
    return ((className == "footnote") || (className == "endnote"));
}

export function isEmptyNoteNode(node) {
    return isNoteNode(node) && !Util.nodeHasContent(node);
}

export function isItemNumber(node) {
    if (node.nodeType == Node.TEXT_NODE) {
        return isItemNumber(node.parentNode);
    }
    else if (node.nodeType == Node.ELEMENT_NODE) {
        if ((node._type == ElementTypes.HTML_SPAN) && node.hasAttribute("class")) {
            return ITEM_NUMBER_CLASSES[node.getAttribute("class")];
        }
    }
    return false;
}

export function isOpaqueNode(node) {
    if (node == null)
        return false;

    switch (node._type) {
    case ElementTypes.HTML_TEXT:
    case ElementTypes.HTML_COMMENT:
        return isOpaqueNode(node.parentNode);
    case ElementTypes.HTML_IMG:
        return true;
    case ElementTypes.HTML_A:
        return node.hasAttribute("href");
    case ElementTypes.HTML_DOCUMENT:
        return false;
    default:
        if (node.hasAttribute("class") && OPAQUE_NODE_CLASSES[node.getAttribute("class")])
            return true;
        else
            return isOpaqueNode(node.parentNode);
    }
}

export function isAutoCorrectNode(node) {
    return ((node._type == ElementTypes.HTML_SPAN) &&
            (node.getAttribute("class") == Keys.AUTOCORRECT_CLASS));
}

export function isSelectionHighlight(node) {
    return ((node.nodeType == Node.ELEMENT_NODE) &&
            node.getAttribute("class") == Keys.SELECTION_CLASS);
}

export function isSelectionSpan(node) {
    return ((node != null) &&
            (node._type == ElementTypes.HTML_SPAN) &&
            (DOM.getAttribute(node,"class") == Keys.SELECTION_CLASS));
};

export function isTOCNode(node) {
    if (node._type == ElementTypes.HTML_NAV) {
        let cls = node.getAttribute("class");
        if ((cls == Keys.SECTION_TOC) ||
            (cls == Keys.FIGURE_TOC) ||
            (cls == Keys.TABLE_TOC))
            return true;
    }
    return false;
}

export function isInTOC(node) {
    if (isTOCNode(node))
        return true;
    if (node.parentNode != null)
        return isInTOC(node.parentNode);
    return false;
}

export function isSpecialBlockNode(node) {
    switch (node._type) {
    case ElementTypes.HTML_TABLE:
    case ElementTypes.HTML_FIGURE:
        return true;
    case ElementTypes.HTML_NAV:
        return isTOCNode(node);
    default:
        return false;
    }
}

export function isAbstractSpan(node) {
    return ((node._type == ElementTypes.HTML_SPAN) && node.hasAttribute(Keys.ABSTRACT_ELEMENT));
}
