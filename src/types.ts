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
    HEADING_NUMBER: "corinthia-heading-number",
    FIGURE_NUMBER: "corinthia-figure-number",
    TABLE_NUMBER: "corinthia-table-number",
    SECTION_TOC: "tableofcontents",
    FIGURE_TOC: "listoffigures",
    TABLE_TOC: "listoftables",
    SELECTION_HIGHLIGHT: "corinthia-selection-highlight",
    AUTOCORRECT_ENTRY: "corinthia-autocorrect-entry",
    UXWRITE_PREFIX: "corinthia-",
    NONE_STYLE: "__none",
    AUTOCORRECT_CLASS: "corinthia-autocorrect",
    SELECTION_CLASS: "corinthia-selection",
    ABSTRACT_ELEMENT: "corinthia-abstract",
    SPELLING_CLASS: "corinthia-spelling",
    MATCH_CLASS: "corinthia-match",
};

let ITEM_NUMBER_CLASSES: { [key: string]: boolean } = {
    "corinthia-heading-number": true,
    "corinthia-figure-number": true,
    "corinthia-table-number": true,
};

let OPAQUE_NODE_CLASSES: { [key: string]: boolean } = {
    "corinthia-heading-number": true,
    "corinthia-figure-number": true,
    "corinthia-table-number": true,
    "tableofcontents": true,
    "listoffigures": true,
    "listoftables": true,
    "corinthia-selection-highlight": true,
    "corinthia-field": true,
};

// We use !! in the functions below to guarantee that a boolean value is returned. If a node's
// type does not exist as a property in the relevant object, we would otherwise get undefined.
export function isContainerNode(node: Node): boolean {
    return !!CONTAINER_ELEMENTS[node._type];
}

export function isParagraphNode(node: Node): boolean {
    return !!PARAGRAPH_ELEMENTS[node._type];
}

export function isHeadingNode(node: Node): boolean {
    return !!HEADING_ELEMENTS[node._type];
}

export function isBlockNode(node: Node): boolean {
    return !!BLOCK_ELEMENTS[node._type];
}

export function isBlockOrNoteNode(node: Node): boolean {
    return !!(BLOCK_ELEMENTS[node._type] || isNoteNode(node));
}

export function isInlineNode(node: Node): boolean {
    return !!INLINE_ELEMENTS[node._type];
}

export function isListNode(node: Node): boolean {
    let type = node._type;
    return !!((type == ElementTypes.HTML_UL) || (type == ElementTypes.HTML_OL));
}

export function isTableCell(node: Node): boolean {
    switch (node._type) {
    case ElementTypes.HTML_TD:
    case ElementTypes.HTML_TH:
        return true;
    default:
        return false;
    }
}

export function isRefNode(node: Node): boolean {
    return ((node instanceof HTMLAnchorElement) &&
            node.hasAttribute("href") &&
            node.getAttribute("href").charAt(0) == "#");
}

export function isNoteNode(node: Node): boolean {
    if (node instanceof HTMLSpanElement) {
        let className = node.getAttribute("class");
        return !!((className == "footnote") || (className == "endnote"));
    }
    else {
        return false;
    }
}

export function isEmptyNoteNode(node: Node): boolean {
    return !!(isNoteNode(node) && !nodeHasContent(node));
}

export function isItemNumber(node: Node): boolean {
    if (node instanceof Text) {
        return isItemNumber(node.parentNode);
    }
    else if (node instanceof Element) {
        if ((node._type == ElementTypes.HTML_SPAN) && node.hasAttribute("class"))
            return !!ITEM_NUMBER_CLASSES[node.getAttribute("class")];
    }
    return false;
}

export function isOpaqueNode(node: Node): boolean {
    if (node != null) {
        switch (node._type) {
        case ElementTypes.HTML_TEXT:
        case ElementTypes.HTML_COMMENT:
            return isOpaqueNode(node.parentNode);
        case ElementTypes.HTML_IMG:
            return true;
        case ElementTypes.HTML_A:
            return (node instanceof HTMLElement) && node.hasAttribute("href");
        case ElementTypes.HTML_DOCUMENT:
            return false;
        default:
            if ((node instanceof HTMLElement) &&
                node.hasAttribute("class") &&
                OPAQUE_NODE_CLASSES[node.getAttribute("class")])
                return true;
            else
                return isOpaqueNode(node.parentNode);
        }
    }
    else {
        return false;
    }
}

export function isAutoCorrectNode(node: Node): boolean {
    return ((node instanceof HTMLSpanElement) &&
            (node.getAttribute("class") == Keys.AUTOCORRECT_CLASS));
}

export function isSelectionHighlight(node: Node): boolean {
    return ((node instanceof HTMLElement) &&
            node.getAttribute("class") == Keys.SELECTION_CLASS);
}

export function isSelectionSpan(node: Node): boolean {
    return ((node instanceof HTMLSpanElement) &&
            (node.getAttribute("class") == Keys.SELECTION_CLASS));
};

export function isTOCNode(node: Node): boolean {
    if ((node instanceof HTMLElement) && (node._type == ElementTypes.HTML_NAV)) {
        let cls = node.getAttribute("class");
        if ((cls == Keys.SECTION_TOC) ||
            (cls == Keys.FIGURE_TOC) ||
            (cls == Keys.TABLE_TOC))
            return true;
    }
    return false;
}

export function isInTOC(node: Node): boolean {
    if (isTOCNode(node))
        return true;
    if (node.parentNode != null)
        return isInTOC(node.parentNode);
    return false;
}

export function isSpecialBlockNode(node: Node): boolean {
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

export function isAbstractSpan(node: Node): boolean {
    return ((node instanceof HTMLSpanElement) && node.hasAttribute(Keys.ABSTRACT_ELEMENT));
}

export function nodeHasContent(node: Node): boolean {
    switch (node._type) {
    case ElementTypes.HTML_TEXT:
        return !Util.isWhitespaceString(node.nodeValue);
    case ElementTypes.HTML_IMG:
    case ElementTypes.HTML_TABLE:
        return true;
    default:
        if (isOpaqueNode(node))
            return true;

        for (let child = node.firstChild; child != null; child = child.nextSibling) {
            if (nodeHasContent(child))
                return true;
        }
        return false;
    }
}
