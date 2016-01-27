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

(function(api) {

    var Types = api.Types; // export

    var DOM = api.DOM; // import
    var Util = api.Util; // import

    var CONTAINER_ELEMENTS = new Array(HTML_COUNT);
    CONTAINER_ELEMENTS[HTML_DOCUMENT] = true;
    CONTAINER_ELEMENTS[HTML_HTML] = true;
    CONTAINER_ELEMENTS[HTML_BODY] = true;
    CONTAINER_ELEMENTS[HTML_UL] = true;
    CONTAINER_ELEMENTS[HTML_OL] = true,
    CONTAINER_ELEMENTS[HTML_LI] = true;
    CONTAINER_ELEMENTS[HTML_TABLE] = true;
    CONTAINER_ELEMENTS[HTML_CAPTION] = true;
    CONTAINER_ELEMENTS[HTML_THEAD] = true;
    CONTAINER_ELEMENTS[HTML_TFOOT] = true;
    CONTAINER_ELEMENTS[HTML_TBODY] = true;
    CONTAINER_ELEMENTS[HTML_TR] = true;
    CONTAINER_ELEMENTS[HTML_TH] = true;
    CONTAINER_ELEMENTS[HTML_TD] = true;
    CONTAINER_ELEMENTS[HTML_COL] = true;
    CONTAINER_ELEMENTS[HTML_FIGURE] = true;
    CONTAINER_ELEMENTS[HTML_FIGCAPTION] = true;
    CONTAINER_ELEMENTS[HTML_NAV] = true;

    var PARAGRAPH_ELEMENTS = new Array(HTML_COUNT);
    PARAGRAPH_ELEMENTS[HTML_P] = true;
    PARAGRAPH_ELEMENTS[HTML_H1] = true;
    PARAGRAPH_ELEMENTS[HTML_H2] = true;
    PARAGRAPH_ELEMENTS[HTML_H3] = true;
    PARAGRAPH_ELEMENTS[HTML_H4] = true;
    PARAGRAPH_ELEMENTS[HTML_H5] = true;
    PARAGRAPH_ELEMENTS[HTML_H6] = true;
    PARAGRAPH_ELEMENTS[HTML_DIV] = true;
    PARAGRAPH_ELEMENTS[HTML_PRE] = true;
    PARAGRAPH_ELEMENTS[HTML_BLOCKQUOTE] = true;

    var BLOCK_ELEMENTS = new Array(HTML_COUNT);
    for (var i = 0; i < HTML_COUNT; i++)
        BLOCK_ELEMENTS[i] = (CONTAINER_ELEMENTS[i] || PARAGRAPH_ELEMENTS[i]);

    var INLINE_ELEMENTS = new Array(HTML_COUNT);
    for (var i = 0; i < HTML_COUNT; i++)
        INLINE_ELEMENTS[i] = !BLOCK_ELEMENTS[i];

    var HEADING_ELEMENTS = new Array(HTML_COUNT);
    HEADING_ELEMENTS[HTML_H1] = true;
    HEADING_ELEMENTS[HTML_H2] = true;
    HEADING_ELEMENTS[HTML_H3] = true;
    HEADING_ELEMENTS[HTML_H4] = true;
    HEADING_ELEMENTS[HTML_H5] = true;
    HEADING_ELEMENTS[HTML_H6] = true;

    var CONTAINERS_ALLOWING_CHILDREN = new Array(HTML_COUNT);
    CONTAINERS_ALLOWING_CHILDREN[HTML_BODY] = true;
    CONTAINERS_ALLOWING_CHILDREN[HTML_LI] = true;
    CONTAINERS_ALLOWING_CHILDREN[HTML_CAPTION] = true;
    CONTAINERS_ALLOWING_CHILDREN[HTML_TH] = true;
    CONTAINERS_ALLOWING_CHILDREN[HTML_TD] = true;
    CONTAINERS_ALLOWING_CHILDREN[HTML_FIGURE] = true;
    CONTAINERS_ALLOWING_CHILDREN[HTML_FIGCAPTION] = true;
    CONTAINERS_ALLOWING_CHILDREN[HTML_NAV] = true;

    var OUTLINE_TITLE_ELEMENTS = new Array(HTML_COUNT);
    OUTLINE_TITLE_ELEMENTS[HTML_H1] = true;
    OUTLINE_TITLE_ELEMENTS[HTML_H2] = true;
    OUTLINE_TITLE_ELEMENTS[HTML_H3] = true;
    OUTLINE_TITLE_ELEMENTS[HTML_H4] = true;
    OUTLINE_TITLE_ELEMENTS[HTML_H5] = true;
    OUTLINE_TITLE_ELEMENTS[HTML_H6] = true;
    OUTLINE_TITLE_ELEMENTS[HTML_FIGCAPTION] = true;
    OUTLINE_TITLE_ELEMENTS[HTML_CAPTION] = true;

    Types.PARAGRAPH_ELEMENTS = PARAGRAPH_ELEMENTS;
    Types.HEADING_ELEMENTS = HEADING_ELEMENTS;
    Types.CONTAINERS_ALLOWING_CHILDREN = CONTAINERS_ALLOWING_CHILDREN;
    Types.OUTLINE_TITLE_ELEMENTS = OUTLINE_TITLE_ELEMENTS;

    Types.Keys = {
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
        "uxwrite-field": true,
    };

    Types.isContainerNode = function(node) {
        return CONTAINER_ELEMENTS[node._type];
    }

    Types.isParagraphNode = function(node) {
        return PARAGRAPH_ELEMENTS[node._type];
    }

    Types.isHeadingNode = function(node) {
        return HEADING_ELEMENTS[node._type];
    }

    Types.isBlockNode = function(node) {
        return BLOCK_ELEMENTS[node._type];
    }

    Types.isBlockOrNoteNode = function(node) {
        return BLOCK_ELEMENTS[node._type] || Types.isNoteNode(node);
    }

    Types.isInlineNode = function(node) {
        return INLINE_ELEMENTS[node._type];
    }

    Types.isListNode = function(node) {
        var type = node._type;
        return ((type == HTML_UL) || (type == HTML_OL));
    }

    Types.isTableCell = function(node) {
        switch (node._type) {
        case HTML_TD:
        case HTML_TH:
            return true;
        default:
            return false;
        }
    }

    Types.isRefNode = function(node) {
        return ((node._type == HTML_A) &&
                node.hasAttribute("href") &&
                node.getAttribute("href").charAt(0) == "#");
    }

    Types.isNoteNode = function(node) {
        if (node._type != HTML_SPAN)
            return false;
        var className = DOM.getAttribute(node,"class");
        return ((className == "footnote") || (className == "endnote"));
    }

    Types.isEmptyNoteNode = function(node) {
        return Types.isNoteNode(node) && !Util.nodeHasContent(node);
    }

    Types.isItemNumber = function(node) {
        if (node.nodeType == Node.TEXT_NODE) {
            return Types.isItemNumber(node.parentNode);
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            if ((node._type == HTML_SPAN) && node.hasAttribute("class")) {
                return ITEM_NUMBER_CLASSES[node.getAttribute("class")];
            }
        }
        return false;
    }

    Types.isOpaqueNode = function(node) {
        if (node == null)
            return false;

        switch (node._type) {
        case HTML_TEXT:
        case HTML_COMMENT:
            return Types.isOpaqueNode(node.parentNode);
        case HTML_IMG:
            return true;
        case HTML_A:
            return node.hasAttribute("href");
        case HTML_DOCUMENT:
            return false;
        default:
            if (node.hasAttribute("class") && OPAQUE_NODE_CLASSES[node.getAttribute("class")])
                return true;
            else
                return Types.isOpaqueNode(node.parentNode);
        }
    }

    Types.isAutoCorrectNode = function(node) {
        return ((node._type == HTML_SPAN) &&
                (node.getAttribute("class") == Types.Keys.AUTOCORRECT_CLASS));
    }

    Types.isSelectionHighlight = function(node) {
        return ((node.nodeType == Node.ELEMENT_NODE) &&
                node.getAttribute("class") == Types.Keys.SELECTION_CLASS);
    }

    Types.isSelectionSpan = function(node) {
        return ((node != null) &&
                (node._type == HTML_SPAN) &&
                (DOM.getAttribute(node,"class") == Types.Keys.SELECTION_CLASS));
    };

    Types.isTOCNode = function(node) {
        if (node._type == HTML_NAV) {
            var cls = node.getAttribute("class");
            if ((cls == Types.Keys.SECTION_TOC) ||
                (cls == Types.Keys.FIGURE_TOC) ||
                (cls == Types.Keys.TABLE_TOC))
                return true;
        }
        return false;
    }

    Types.isInTOC = function(node) {
        if (Types.isTOCNode(node))
            return true;
        if (node.parentNode != null)
            return Types.isInTOC(node.parentNode);
        return false;
    }

    Types.isSpecialBlockNode = function(node) {
        switch (node._type) {
        case HTML_TABLE:
        case HTML_FIGURE:
            return true;
        case HTML_NAV:
            return Types.isTOCNode(node);
        default:
            return false;
        }
    }

    Types.isAbstractSpan = function(node) {
        return ((node._type == HTML_SPAN) && node.hasAttribute(Types.Keys.ABSTRACT_ELEMENT));
    }

})(globalAPI);
