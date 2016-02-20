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

import Collections = require("./collections");
import Cursor = require("./cursor");
import DOM = require("./dom");
import ElementTypes = require("./elementTypes");
import Hierarchy = require("./hierarchy");
import Position = require("./position");
import Range = require("./range");
import Selection = require("./selection");
import Traversal = require("./traversal");
import Types = require("./types");
import UndoManager = require("./undo");
import Util = require("./util");

// Some properties in CSS, such as 'margin', 'border', and 'padding', are shorthands which
// set multiple, more fine-grained properties. The CSS spec outlines what these are - e.g.
// an assignment to the 'margin' property is considered a simultaneous assignment to
// 'margin-left', 'margin-right', 'margin-top', and 'margin-bottom' properties.

// However, Firefox contains a bug (https://bugzilla.mozilla.org/show_bug.cgi?id=241234),
// which has gone unfixed for more than six years, whereby it actually sets different
// properties for *-left and *-right, which are reflected when examining the style property
// of an element. Additionally, it also gives an error if you try to set these, so if you simply
// get all the style properties and try to set them again it won't work.

// To get around this problem, we record the following set of replacements. When getting the
// style properties of an element, we replace any properties with the names given below with
// their corresponding spec name. A null entry means that property should be ignored altogether.

// You should always use getStyleProperties() instead of accessing element.style directly.

let CSS_PROPERTY_REPLACEMENTS: { [key: string]: string } = {
    "margin-left-value": "margin-left",
    "margin-left-ltr-source": null,
    "margin-left-rtl-source": null,
    "margin-right-value": "margin-right",
    "margin-right-ltr-source": null,
    "margin-right-rtl-source": null,
    "padding-left-value": "padding-left",
    "padding-left-ltr-source": null,
    "padding-left-rtl-source": null,
    "padding-right-value": "padding-right",
    "padding-right-ltr-source": null,
    "padding-right-rtl-source": null,
    "border-right-width-value": "border-right-width",
    "border-right-width-ltr-source": null,
    "border-right-width-rtl-source": null,
    "border-left-width-value": "border-left-width",
    "border-left-width-ltr-source": null,
    "border-left-width-rtl-source": null,
    "border-right-color-value": "border-right-color",
    "border-right-color-ltr-source": null,
    "border-right-color-rtl-source": null,
    "border-left-color-value": "border-left-color",
    "border-left-color-ltr-source": null,
    "border-left-color-rtl-source": null,
    "border-right-style-value": "border-right-style",
    "border-right-style-ltr-source": null,
    "border-right-style-rtl-source": null,
    "border-left-style-value": "border-left-style",
    "border-left-style-ltr-source": null,
    "border-left-style-rtl-source": null,
};

// private
function getStyleProperties(element: HTMLElement, dontReplace?: boolean): { [key: string]: string } {
    let properties: { [key: string]: string } = {};

    for (let i = 0; i < element.style.length; i++) {
        let name = element.style[i];
        let value = element.style.getPropertyValue(name);

        let replacement: string;
        if (dontReplace) {
            replacement = name;
        }
        else {
            replacement = CSS_PROPERTY_REPLACEMENTS[name];
            if (typeof(replacement) == "undefined")
                replacement = name;
        }

        if (replacement != null)
            properties[replacement] = value;
    }
    return properties;
}

// public (for testing purposes only)
export function splitAroundSelection(range: Range.Range, allowDirectInline: boolean): void {
    Range.trackWhileExecuting(range,function() {
        if (!allowDirectInline)
            Hierarchy.ensureRangeInlineNodesInParagraph(range);
        Hierarchy.ensureRangeValidHierarchy(range);

        if ((range.start.node instanceof Text) &&
            (range.start.offset > 0)) {
            splitTextBefore(range.start);
            if (range.end.node == range.start.node)
                range.end.offset -= range.start.offset;
            range.start.offset = 0;
        }
        else if (range.start.node instanceof Element) {
            movePreceding(range.start,Types.isBlockOrNoteNode);
        }
        else {
            movePreceding(new Position.Position(range.start.node.parentNode,
                                                Traversal.nodeOffset(range.start.node)),
                          Types.isBlockOrNoteNode);
        }

        // Save the start and end position of the range. The mutation listeners will move it
        // when the following node is moved, which we don't actually want in this case.
        let startNode = range.start.node;
        let startOffset = range.start.offset;
        let endNode = range.end.node;
        let endOffset = range.end.offset;

        if ((range.end.node instanceof Text) &&
            (range.end.offset < range.end.node.nodeValue.length)) {
            splitTextAfter(range.end);
        }
        else if (range.end.node instanceof Element) {
            moveFollowing(range.end,Types.isBlockOrNoteNode);
        }
        else {
            moveFollowing(new Position.Position(range.end.node.parentNode,
                                                Traversal.nodeOffset(range.end.node)+1),
                          Types.isBlockOrNoteNode);
        }

        range.start.node = startNode;
        range.start.offset = startOffset;
        range.end.node = endNode;
        range.end.offset = endOffset;
    });
}

// public
export function mergeUpwards(node: Node, whiteList: boolean[]): void {
    while ((node != null) && whiteList[node._type]) {
        let parent = node.parentNode;
        mergeWithNeighbours(node,whiteList,true);
        node = parent;
    }
}

function isDiscardable(node: Node): boolean {
    if (!(node instanceof Element))
        return false;

    if (!Types.isInlineNode(node))
        return false;

    if (Types.isOpaqueNode(node))
        return false;

    for (let child = node.firstChild; child != null; child = child.nextSibling) {
        if (!isDiscardable(child))
            return false;
    }

    return true;
}

// public (for use by tests)
export function mergeWithNeighbours(node: Node, whiteList: boolean[], trim?: boolean): void {
    let parent = node.parentNode;
    if (parent == null)
        return;

    let start = node;
    let end = node;

    while ((start.previousSibling != null) &&
           DOM.nodesMergeable(start.previousSibling,start,whiteList))
        start = start.previousSibling;

    while ((end.nextSibling != null) &&
           DOM.nodesMergeable(end,end.nextSibling,whiteList))
        end = end.nextSibling;

    if (trim) {
        while ((start.previousSibling != null) && isDiscardable(start.previousSibling))
            DOM.deleteNode(start.previousSibling);
        while ((end.nextSibling != null) && isDiscardable(end.nextSibling))
            DOM.deleteNode(end.nextSibling);
    }

    if (start != end) {
        let lastMerge: boolean;
        do {
            lastMerge = (start.nextSibling == end);

            let lastChild: Node = null;
            if (start instanceof Element)
                lastChild = start.lastChild;

            DOM.mergeWithNextSibling(start,whiteList);

            if (lastChild != null)
                mergeWithNeighbours(lastChild,whiteList);
        } while (!lastMerge);
    }
}

// private
function mergeRange(range: Range.Range, whiteList: boolean[]): void {
    let nodes = Range.getAllNodes(range);
    for (let i = 0; i < nodes.length; i++) {
        let next: Node;
        for (let p = nodes[i]; p != null; p = next) {
            next = p.parentNode;
            mergeWithNeighbours(p,whiteList);
        }
    }
}

// public (called from cursor.js)
// FIXME: TS: We require a position in a text node here; replace pos width node: Text, offset: number
export function splitTextBefore(pos: Position.Position, parentCheckFn?: (n: Node) => boolean, force?: boolean): Position.Position {
    let node = pos.node;
    let offset = pos.offset;
    if (parentCheckFn == null)
        parentCheckFn = Types.isBlockNode;

    if (node instanceof Text) {
        if (force || (offset > 0)) {
            let before = DOM.createTextNode(document,"");
            DOM.insertBefore(node.parentNode,before,node);
            DOM.moveCharacters(node,0,offset,before,0,false,true);
            movePreceding(new Position.Position(node.parentNode,Traversal.nodeOffset(node)),
                          parentCheckFn,force);
            return new Position.Position(before,before.nodeValue.length);
        }
        else {
            movePreceding(new Position.Position(node.parentNode,Traversal.nodeOffset(node)),
                          parentCheckFn,force);
            return pos;
        }
    }
    else {
        throw new Error("splitTextBefore called on non-text node");
    }
}

// public
// FIXME: TS: We require a position in a text node here; replace pos width node: Text, offset: number
export function splitTextAfter(pos: Position.Position, parentCheckFn?: (n: Node) => boolean, force?: boolean): Position.Position {
    let node = pos.node;
    let offset = pos.offset;
    if (parentCheckFn == null)
        parentCheckFn = Types.isBlockNode;

    if (node instanceof Text) {
        if (force || (offset < pos.node.nodeValue.length)) {
            let after = DOM.createTextNode(document,"");
            DOM.insertBefore(node.parentNode,after,node.nextSibling);
            DOM.moveCharacters(node,offset,node.nodeValue.length,after,0,true,false);
            moveFollowing(new Position.Position(node.parentNode,Traversal.nodeOffset(node)+1),
                          parentCheckFn,force);
            return new Position.Position(after,0);
        }
        else {
            moveFollowing(new Position.Position(node.parentNode,Traversal.nodeOffset(node)+1),
                          parentCheckFn,force);
            return pos;
        }
    }
    else {
        throw new Error("splitTextBefore called on non-text node");
    }
}

// FIXME: movePreceding and moveNext could possibly be optimised by passing in a (parent,child)
// pair instead of (node,offset), i.e. parent is the same as node, but rather than passing the
// index of a child, we pass the child itself (or null if the offset is equal to
// childNodes.length)
// public
export function movePreceding(pos: Position.Position, parentCheckFn?: (n: Node) => boolean, force?: boolean): Position.Position {
    let node = pos.node;
    let offset = pos.offset;
    if (parentCheckFn(node) || (node == document.body))
        return new Position.Position(node,offset);

    let toMove = new Array();
    let justWhitespace = true;
    let result = new Position.Position(node,offset);
    for (let i = 0; i < offset; i++) {
        if (!Traversal.isWhitespaceTextNode(node.childNodes[i]))
            justWhitespace = false;
        toMove.push(node.childNodes[i]);
    }

    if ((toMove.length > 0) || force) {
        if (justWhitespace && !force) {
            for (let i = 0; i < toMove.length; i++)
                DOM.insertBefore(node.parentNode,toMove[i],node);
        }
        else {
            let copy = DOM.shallowCopyElement(node);
            DOM.insertBefore(node.parentNode,copy,node);

            for (let i = 0; i < toMove.length; i++)
                DOM.insertBefore(copy,toMove[i],null);
            result = new Position.Position(copy,copy.childNodes.length);
        }
    }

    movePreceding(new Position.Position(node.parentNode,Traversal.nodeOffset(node)),
                  parentCheckFn,force);
    return result;
}

// public
export function moveFollowing(pos: Position.Position, parentCheckFn?: (n: Node) => boolean, force?: boolean): Position.Position {
    let node = pos.node;
    let offset = pos.offset;
    if (parentCheckFn(node) || (node == document.body))
        return new Position.Position(node,offset);

    let toMove = new Array();
    let justWhitespace = true;
    let result =  new Position.Position(node,offset);
    for (let i = offset; i < node.childNodes.length; i++) {
        if (!Traversal.isWhitespaceTextNode(node.childNodes[i]))
            justWhitespace = false;
        toMove.push(node.childNodes[i]);
    }

    if ((toMove.length > 0) || force) {
        if (justWhitespace && !force) {
            for (let i = 0; i < toMove.length; i++)
                DOM.insertBefore(node.parentNode,toMove[i],node.nextSibling);
        }
        else {
            let copy = DOM.shallowCopyElement(node);
            DOM.insertBefore(node.parentNode,copy,node.nextSibling);

            for (let i = 0; i < toMove.length; i++)
                DOM.insertBefore(copy,toMove[i],null);
            result = new Position.Position(copy,0);
        }
    }

    moveFollowing(new Position.Position(node.parentNode,Traversal.nodeOffset(node)+1),
                  parentCheckFn,force);
    return result;
}

// public
export function paragraphTextUpToPosition(pos: Position.Position): string {
    if (pos.node instanceof Text) {
        return stringToStartOfParagraph(pos.node,pos.offset);
    }
    else {
        return stringToStartOfParagraph(Position.closestActualNode(pos),0);
    }

    function stringToStartOfParagraph(node: Node, offset: number): string {
        let start = node;
        let components = new Array();
        while (Types.isInlineNode(node)) {
            if (node instanceof Text) {
                if (node == start)
                    components.push(node.nodeValue.slice(0,offset));
                else
                    components.push(node.nodeValue);
            }

            if (node.previousSibling != null) {
                node = node.previousSibling;
                while (Types.isInlineNode(node) && (node.lastChild != null))
                    node = node.lastChild;
            }
            else {
                node = node.parentNode;
            }
        }
        return components.reverse().join("");
    }
}

// public
export function getFormatting(): { [key: string]: string } {
    // FIXME: implement a more efficient version of this algorithm which avoids duplicate checks

    let range = Selection.get();
    if (range == null)
        return {};

    Range.assertValid(range,"Selection");

    let outermost = Range.getOutermostNodes(range,true);

    let leafNodes = new Array();
    for (let i = 0; i < outermost.length; i++) {
        findLeafNodes(outermost[i],leafNodes);
    }
    let empty = Range.isEmpty(range);

    let commonProperties: { [key: string]: string } = null;
    for (let i = 0; i < leafNodes.length; i++) {
        if (!Traversal.isWhitespaceTextNode(leafNodes[i]) || empty) {
            let leafNodeProperties = getAllNodeProperties(leafNodes[i]);
            if (leafNodeProperties["-uxwrite-paragraph-style"] == null)
                leafNodeProperties["-uxwrite-paragraph-style"] = Types.Keys.NONE_STYLE;
            if (commonProperties == null)
                commonProperties = leafNodeProperties;
            else
                commonProperties = intersection(commonProperties,leafNodeProperties);
        }
    }

    if (commonProperties == null)
        commonProperties = {"-uxwrite-paragraph-style": Types.Keys.NONE_STYLE};

    for (let i = 0; i < leafNodes.length; i++) {
        let leaf = leafNodes[i];
        if (leaf._type == ElementTypes.HTML_LI) {
            switch (leaf.parentNode._type) {
            case ElementTypes.HTML_UL:
                commonProperties["-uxwrite-in-ul"] = "true";
                break;
            case ElementTypes.HTML_OL:
                commonProperties["-uxwrite-in-ol"] = "true";
                break;
            }
        }
        else {
            for (let ancestor = leaf;
                 ancestor.parentNode != null;
                 ancestor = ancestor.parentNode) {

                if (ancestor.parentNode._type == ElementTypes.HTML_LI) {
                    let havePrev = false;
                    for (let c = ancestor.previousSibling; c != null; c = c.previousSibling) {
                        if (!Traversal.isWhitespaceTextNode(c)) {
                            havePrev = true;
                            break;
                        }
                    }
                    if (!havePrev) {
                        let listNode = ancestor.parentNode.parentNode;
                        switch (listNode._type) {
                        case ElementTypes.HTML_UL:
                            commonProperties["-uxwrite-in-ul"] = "true";
                            break;
                        case ElementTypes.HTML_OL:
                            commonProperties["-uxwrite-in-ol"] = "true";
                            break;
                        }
                    }
                }
            }
        }
    }

    getFlags(range.start,commonProperties);

    return commonProperties;

    function getFlags(pos: Position.Position, commonProperties: { [key: string]: string }): void {
        let strBeforeCursor = paragraphTextUpToPosition(pos);

        if (Util.isWhitespaceString(strBeforeCursor)) {
            let firstInParagraph = true;
            for (let p = pos.node; Types.isInlineNode(p); p = p.parentNode) {
                if (p.previousSibling != null)
                    firstInParagraph = false;
            }
            if (firstInParagraph)
                commonProperties["-uxwrite-shift"] = "true";
        }
        if (strBeforeCursor.match(/\.\s*$/))
            commonProperties["-uxwrite-shift"] = "true";
        if (strBeforeCursor.match(/\([^\)]*$/))
            commonProperties["-uxwrite-in-brackets"] = "true";
        if (strBeforeCursor.match(/\u201c[^\u201d]*$/))
            commonProperties["-uxwrite-in-quotes"] = "true";
    }

    function intersection(a: { [key: string]: string }, b: { [key: string]: string }): { [key: string]: string } {
        let result: { [key: string]: string } = {}
        for (let name in a) {
            if (a[name] == b[name])
                result[name] = a[name];
        }
        return result;
    }

    function findLeafNodes(node: Node, result: Node[]): void {
        if (node.firstChild == null) {
            result.push(node);
        }
        else {
            for (let child = node.firstChild; child != null; child = child.nextSibling)
                findLeafNodes(child,result);
        }
    }
}

// public
export function getAllNodeProperties(node: Node): { [key: string]: string } {
    if (node == null)
        throw new Error("Node is not in tree");

    if (node == node.ownerDocument.body)
        return {}

    let properties = getAllNodeProperties(node.parentNode);

    if (node instanceof HTMLElement) {
        // Note: Style names corresponding to element names must be in lowercase, because
        // canonicaliseSelector() in Styles.js always converts selectors to lowercase.
        if (node.hasAttribute("STYLE")) {
            let nodeProperties = getStyleProperties(node);
            for (let name in nodeProperties)
                properties[name] = nodeProperties[name];
        }

        let type = node._type;
        switch (type) {
        case ElementTypes.HTML_B:
            properties["font-weight"] = "bold";
            break;
        case ElementTypes.HTML_I:
            properties["font-style"] = "italic";
            break;
        case ElementTypes.HTML_U: {
            if (properties["text-decoration"] != null) {
                let components = properties["text-decoration"].toLowerCase().split(/\s+/);
                if (components.indexOf("underline") == -1)
                    properties["text-decoration"] += " underline";
            }
            else {
                properties["text-decoration"] = "underline";
            }
            break;
        }
//            case ElementTypes.HTML_TT:
//                properties["-uxwrite-in-tt"] = "true";
//                break;
        case ElementTypes.HTML_IMG:
            properties["-uxwrite-in-image"] = "true";
            break;
        case ElementTypes.HTML_FIGURE:
            properties["-uxwrite-in-figure"] = "true";
            break;
        case ElementTypes.HTML_TABLE:
            properties["-uxwrite-in-table"] = "true";
            break;
        case ElementTypes.HTML_A:
            if (node.hasAttribute("href")) {
                let href = node.getAttribute("href");
                if (href.charAt(0) == "#")
                    properties["-uxwrite-in-reference"] = "true";
                else
                    properties["-uxwrite-in-link"] = "true";
            }
            break;
        case ElementTypes.HTML_NAV: {
            let className = DOM.getAttribute(node,"class");
            if ((className == Types.Keys.SECTION_TOC) ||
                (className == Types.Keys.FIGURE_TOC) ||
                (className == Types.Keys.TABLE_TOC))
                properties["-uxwrite-in-toc"] = "true";
            break;
        }
        default:
            if (Types.PARAGRAPH_ELEMENTS[type]) {
                let name = node.nodeName.toLowerCase();
                let selector: string;
                if (node.hasAttribute("class"))
                    selector = name + "." + node.getAttribute("class");
                else
                    selector = name;
                properties["-uxwrite-paragraph-style"] = selector;
            }
            break;
        }

        if (Types.OUTLINE_TITLE_ELEMENTS[type] && node.hasAttribute("id"))
            properties["-uxwrite-in-item-title"] = node.getAttribute("id");
    }

    return properties;
}

let PARAGRAPH_PROPERTIES: { [key: string]: boolean } = {
    "margin-left": true,
    "margin-right": true,
    "margin-top": true,
    "margin-bottom": true,

    "padding-left": true,
    "padding-right": true,
    "padding-top": true,
    "padding-bottom": true,

    "border-left-width": true,
    "border-right-width": true,
    "border-top-width": true,
    "border-bottom-width": true,

    "border-left-style": true,
    "border-right-style": true,
    "border-top-style": true,
    "border-bottom-style": true,

    "border-left-color": true,
    "border-right-color": true,
    "border-top-color": true,
    "border-bottom-color": true,

    "border-top-left-radius": true,
    "border-top-right-radius": true,
    "border-bottom-left-radius": true,
    "border-bottom-right-radius": true,

    "text-align": true,
    "text-indent": true,
    "line-height": true,
    "display": true,

    "width": true,
    "height": true,
};

let SPECIAL_PROPERTIES: { [key: string]: boolean } = {
    "-webkit-text-size-adjust": true, // set on HTML element for text scaling purposes
};

function isParagraphProperty(name: string): boolean {
    return PARAGRAPH_PROPERTIES[name];
}

function isInlineProperty(name: string): boolean {
    return !PARAGRAPH_PROPERTIES[name] && !SPECIAL_PROPERTIES[name];
}

// private
function putDirectInlineChildrenInParagraphs(parent: Node): void {
    let inlineChildren: Node[] = [];
    for (let child = parent.firstChild; child != null; child = child.nextSibling)
        if (Types.isInlineNode(child))
            inlineChildren.push(child);
    for (let i = 0; i < inlineChildren.length; i++) {
        if (inlineChildren[i].parentNode == parent) { // may already have been moved
            if (!Traversal.isWhitespaceTextNode(inlineChildren[i]))
                Hierarchy.wrapInlineNodesInParagraph(inlineChildren[i]);
        }
    }
}

// private
function getParagraphs(nodes: Node[]): HTMLElement[] {
    let array: HTMLElement[] = [];
    let set = new Collections.NodeSet();
    for (let i = 0; i < nodes.length; i++) {
        for (let anc = nodes[i].parentNode; anc != null; anc = anc.parentNode) {
            if (anc._type == ElementTypes.HTML_LI)
                putDirectInlineChildrenInParagraphs(anc);
        }
        recurse(nodes[i]);
    }

    let remove = new Collections.NodeSet();
    for (let i = 0; i < array.length; i++) {
        for (let anc = array[i].parentNode; anc != null; anc = anc.parentNode)
            remove.add(anc);
    }

    let modified: HTMLElement[] = [];
    for (let i = 0; i < array.length; i++) {
        if (!remove.contains(array[i]))
            modified.push(array[i]);
    }

    return modified;

    function recurse(node: Node): void {
        if (node._type == ElementTypes.HTML_LI)
            putDirectInlineChildrenInParagraphs(node);
        if (node.firstChild == null) {
            // Leaf node
            for (let anc = node; anc != null; anc = anc.parentNode)
                if ((anc instanceof HTMLElement) && Types.isParagraphNode(anc)) {
                    add(anc);
                }
        }
        else {
            for (let child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }

    function add(node: HTMLElement): void {
        if (!set.contains(node)) {
            array.push(node);
            set.add(node);
        }
    }
}

// private
function setParagraphStyle(paragraph: HTMLElement, selector: string): void {
    let wasHeading = Types.isHeadingNode(paragraph);
    DOM.removeAttribute(paragraph,"class");
    if (selector == "") {
        if (paragraph._type != ElementTypes.HTML_P)
            paragraph = DOM.replaceElement(paragraph,"P");
    }
    else {
        let elementClassRegex = /^([a-zA-Z0-9]+)?(\.(.+))?$/;
        let result = elementClassRegex.exec(selector);
        if ((result != null) && (result.length == 4)) {
            let elementName = result[1];
            let className = result[3];

            if (elementName == null)
                elementName = "P";
            else
                elementName = elementName.toUpperCase();

            let elementType = ElementTypes.fromString[elementName];

            if (!Types.PARAGRAPH_ELEMENTS[elementType])
                return; // better than throwing an exception

            if (paragraph._type != elementType)
                paragraph = DOM.replaceElement(paragraph,elementName);

            if (className != null)
                DOM.setAttribute(paragraph,"class",className);
            else
                DOM.removeAttribute(paragraph,"class");
        }
    }

    // FIXME: this will need to change when we add Word/ODF support, because the ids serve
    // a purpose other than simply being targets for references
    let isHeading = Types.isHeadingNode(paragraph);
    if (wasHeading && !isHeading)
        DOM.removeAttribute(paragraph,"id");
}

// public
export function pushDownInlineProperties(outermost: Node[]): void {
    for (let i = 0; i < outermost.length; i++)
        outermost[i] = pushDownInlinePropertiesSingle(outermost[i]);
}

// private
function pushDownInlinePropertiesSingle(target: Node): Node {
    let targetParent = target.parentNode;
    if (targetParent instanceof HTMLElement)
        recurse(targetParent);
    return target;

    function recurse(node: HTMLElement): void {
        let nodeParent = node.parentNode;
        if ((nodeParent != null) && (nodeParent instanceof HTMLElement))
            recurse(nodeParent);

        let inlineProperties: { [key: string]: string } = {};
        let nodeProperties = getStyleProperties(node);
        for (let name in nodeProperties) {
            if (isInlineProperty(name)) {
                inlineProperties[name] = nodeProperties[name];
            }
        }

        let remove = new Object();
        for (let name in inlineProperties)
            remove[name] = null;
        DOM.setStyleProperties(node,remove);

        let type = node._type;
        switch (type) {
        case ElementTypes.HTML_B:
            inlineProperties["font-weight"] = "bold";
            break;
        case ElementTypes.HTML_I:
            inlineProperties["font-style"] = "italic";
            break;
        case ElementTypes.HTML_U:
            if (inlineProperties["text-decoration"] != null)
                inlineProperties["text-decoration"] += " underline";
            else
                inlineProperties["text-decoration"] = "underline";
            break;
        }

        let special = extractSpecial(inlineProperties);
        let count = Object.getOwnPropertyNames(inlineProperties).length;

        if ((count > 0) || special.bold || special.italic || special.underline) {

            let next: Node;
            for (let child = node.firstChild; child != null; child = next) {
                next = child.nextSibling;

                if (Traversal.isWhitespaceTextNode(child))
                    continue;

                let replacement = applyInlineFormatting(child,inlineProperties,special);
                if (target == child)
                    target = replacement;
            }
        }

        if (node.hasAttribute("style") && (node.style.length == 0))
            DOM.removeAttribute(node,"style");

        switch (type) {
        case ElementTypes.HTML_B:
        case ElementTypes.HTML_I:
        case ElementTypes.HTML_U:
            DOM.removeNodeButKeepChildren(node);
            break;
        }
    }
}

// private
function wrapInline(node: Node, elementName: string): HTMLElement {
    if ((node instanceof HTMLElement) && (!Types.isInlineNode(node) || Types.isAbstractSpan(node))) {
        let next: Node;
        for (let child = node.firstChild; child != null; child = next) {
            next = child.nextSibling;
            wrapInline(child,elementName);
        }
        return node;
    }
    else {
        return DOM.wrapNode(node,elementName);
    }
}

// private
function applyInlineFormatting(targetNode: Node,
                               inlineProperties: { [key: string]: string },
                               special: SpecialProperties,
                               applyToWhitespace?: boolean): Node {

    if (!applyToWhitespace && Traversal.isWhitespaceTextNode(targetNode))
        return targetNode;

    if (special.underline)
        targetNode = wrapInline(targetNode,"U");
    if (special.italic)
        targetNode = wrapInline(targetNode,"I");
    if (special.bold)
        targetNode = wrapInline(targetNode,"B");

    let isbiu = false;
    switch (targetNode._type) {
    case ElementTypes.HTML_B:
    case ElementTypes.HTML_I:
    case ElementTypes.HTML_U:
        isbiu = true;
        break;
    }

    if (Object.getOwnPropertyNames(inlineProperties).length == 0)
        return targetNode;

    let targetElement: HTMLElement = null;

    if (!(targetNode instanceof HTMLElement) || isbiu || isSpecialSpan(targetNode))
        targetElement = wrapInline(targetNode,"SPAN");
    else
        targetElement = targetNode;

    let propertiesToSet = new Object();
    for (let name in inlineProperties) {
        let existing = targetElement.style.getPropertyValue(name);
        if ((existing == null) || (existing == ""))
            propertiesToSet[name] = inlineProperties[name];
    }
    DOM.setStyleProperties(targetElement,propertiesToSet);

    return targetElement;
}

interface SpecialProperties {
    bold: boolean;
    italic: boolean;
    underline: boolean;
}

// private
function extractSpecial(properties: { [key: string]: string }): SpecialProperties {
    let special: SpecialProperties = { bold: null, italic: null, underline: null };
    let fontWeight = properties["font-weight"];
    let fontStyle = properties["font-style"];
    let textDecoration = properties["text-decoration"];

    if (typeof(fontWeight) != "undefined") {
        special.bold = false;
        if ((fontWeight != null) &&
            (fontWeight.toLowerCase() == "bold")) {
            special.bold = true;
            delete properties["font-weight"];
        }
    }

    if (typeof(fontStyle) != "undefined") {
        special.italic = false;
        if ((fontStyle != null) &&
            (fontStyle.toLowerCase() == "italic")) {
            special.italic = true;
            delete properties["font-style"];
        }
    }

    if (typeof(textDecoration) != "undefined") {
        special.underline = false;
        if (textDecoration != null) {
            let values = textDecoration.toLowerCase().split(/\s+/);
            let index: number;
            while ((index = values.indexOf("underline")) >= 0) {
                values.splice(index,1);
                special.underline = true;
            }
            if (values.length == 0)
                delete properties["text-decoration"];
            else
                properties["text-decoration"] = values.join(" ");
        }
    }
    return special;
}

// private
function removeProperties<T extends Node>(outermost: T[], properties: { [key: string]: string }): T[] {
    properties = Util.cloneStringDict(properties);
    let special = extractSpecial(properties);
    let remaining = new Array();
    for (let i = 0; i < outermost.length; i++) {
        removePropertiesSingle(outermost[i],properties,special,remaining);
    }
    return remaining;
}

// private
function getOutermostParagraphs(paragraphs: HTMLElement[]): HTMLElement[] {
    let all = new Collections.NodeSet();
    for (let i = 0; i < paragraphs.length; i++)
        all.add(paragraphs[i]);

    let result: HTMLElement[] = [];
    for (let i = 0; i < paragraphs.length; i++) {
        let haveAncestor = false;
        for (let p = paragraphs[i].parentNode; p != null; p = p.parentNode) {
            if (all.contains(p)) {
                haveAncestor = true;
                break;
            }
        }
        if (!haveAncestor)
            result.push(paragraphs[i]);
    }
    return result;
}

// private
function removePropertiesSingle(node: Node, properties: { [key: string]: string },
                                special: SpecialProperties, remaining: Node[]): void {
    if ((node instanceof HTMLElement) && (node.hasAttribute("style"))) {
        let remove = new Object();
        for (let name in properties)
            remove[name] = null;
        DOM.setStyleProperties(node,remove);
    }

    let willRemove = false;
    switch (node._type) {
    case ElementTypes.HTML_B:
        willRemove = (special.bold != null);
        break;
    case ElementTypes.HTML_I:
        willRemove = (special.italic != null);
        break;
    case ElementTypes.HTML_U:
        willRemove = (special.underline != null);
        break;
    case ElementTypes.HTML_SPAN:
        willRemove = ((node instanceof HTMLElement) && !node.hasAttribute("style") && !isSpecialSpan(node));
        break;
    }

    let childRemaining = willRemove ? remaining : null;

    let next: Node;
    for (let child = node.firstChild; child != null; child = next) {
        next = child.nextSibling;
        removePropertiesSingle(child,properties,special,childRemaining);
    }

    if (willRemove)
        DOM.removeNodeButKeepChildren(node);
    else if (remaining != null)
        remaining.push(node);
}

function isSpecialSpan(span: HTMLElement): boolean {
    if (span._type == ElementTypes.HTML_SPAN) {
        if (span.hasAttribute(Types.Keys.ABSTRACT_ELEMENT))
            return true;
        let className = DOM.getStringAttribute(span,"class");
        if (className.indexOf(Types.Keys.UXWRITE_PREFIX) == 0)
            return true;
        if ((className == "footnote") || (className == "endnote"))
            return true;
    }
    return false;
}

// private
function containsOnlyWhitespace(ancestor: Node): boolean {
    for (let child = ancestor.firstChild; child != null; child = child.nextSibling) {
        if (!Traversal.isWhitespaceTextNode(child))
            return false;
    }
    return true;
}

// public
export function applyFormattingChanges(style: string, properties: { [key: string]: string }): void {
    UndoManager.newGroup("Apply formatting changes");

    if (properties == null)
        properties = {};

    if (style == Types.Keys.NONE_STYLE)
        style = null;

    let paragraphProperties: { [key: string]: string } = {};
    let inlineProperties: { [key: string]: string } = {};

    for (let name in properties) {
        if (isParagraphProperty(name))
            paragraphProperties[name] = properties[name];
        else if (isInlineProperty(name))
            inlineProperties[name] = properties[name];
    }

    let selectionRange = Selection.get();
    if (selectionRange == null)
        return;

    // If we're applying formatting properties to an empty selection, and the node of the
    // selection start & end is an element, add an empty text node so that we have something
    // to apply the formatting to.
    if (Range.isEmpty(selectionRange) &&
        (selectionRange.start.node instanceof Element)) {
        let node = selectionRange.start.node;
        let offset = selectionRange.start.offset;
        let text = DOM.createTextNode(document,"");
        DOM.insertBefore(node,text,node.childNodes[offset]);
        Selection.set(text,0,text,0);
        selectionRange = Selection.get();
    }

    // If the cursor is in a container (such as BODY OR FIGCAPTION), and not inside a paragraph,
    // put it in one so we can set a paragraph style

    if ((style != null) && Range.isEmpty(selectionRange)) {
        let node = Range.singleNode(selectionRange);
        while (Types.isInlineNode(node))
            node = node.parentNode;
        if (Types.isContainerNode(node) && containsOnlyInlineChildren(node)) {
            let p = DOM.createElement(document,"P");
            DOM.appendChild(node,p);
            while (node.firstChild != p)
                DOM.appendChild(p,node.firstChild);
            Cursor.updateBRAtEndOfParagraph(p);
        }
    }


    let range = new Range.Range(selectionRange.start.node,selectionRange.start.offset,
                          selectionRange.end.node,selectionRange.end.offset);
    let positions = [selectionRange.start,selectionRange.end,
                     range.start,range.end];

    let allowDirectInline = (style == null);
    Position.trackWhileExecuting(positions,function() {
        splitAroundSelection(range,allowDirectInline);
        Range.expand(range);
        if (!allowDirectInline)
            Hierarchy.ensureRangeInlineNodesInParagraph(range);
        Hierarchy.ensureRangeValidHierarchy(range);
        Range.expand(range);
        let outermost = Range.getOutermostNodes(range);
        // FIXME: From the logic below, I don't think this can ever get set
        let target: Node = null;

        let paragraphs: HTMLElement[];
        if (outermost.length > 0)
            paragraphs = getParagraphs(outermost);
        else
            paragraphs = getParagraphs([Range.singleNode(range)]);

        // Push down inline properties
        pushDownInlineProperties(outermost);

        outermost = removeProperties(outermost,inlineProperties);

        // Set properties on inline nodes
        for (let i = 0; i < outermost.length; i++) {
            let existing = getAllNodeProperties(outermost[i]);
            let toSet: { [key: string]: string } = {};
            for (let name in inlineProperties) {
                if ((inlineProperties[name] != null) &&
                    (existing[name] != inlineProperties[name])) {
                    toSet[name] = inlineProperties[name];
                }
            }

            let special = extractSpecial(toSet);
            let applyToWhitespace = (outermost.length == 1);
            applyInlineFormatting(outermost[i],toSet,special,applyToWhitespace);
        }

        // Remove properties from paragraph nodes
        paragraphs = removeProperties(paragraphs,paragraphProperties);

        // Set properties on paragraph nodes
        let paragraphPropertiesToSet = new Object();
        for (let name in paragraphProperties) {
            if (paragraphProperties[name] != null)
                paragraphPropertiesToSet[name] = paragraphProperties[name];
        }

        let outermostParagraphs = getOutermostParagraphs(paragraphs);
        for (let i = 0; i < outermostParagraphs.length; i++)
            DOM.setStyleProperties(outermostParagraphs[i],paragraphPropertiesToSet);

        // Set style on paragraph nodes
        if (style != null) {
            for (let i = 0; i < paragraphs.length; i++) {
                setParagraphStyle(paragraphs[i],style);
            }
        }

        mergeRange(range,MERGEABLE_INLINE);

        if (target != null) {
            let next: Node;
            for (let p = target; p != null; p = next) {
                next = p.parentNode;
                mergeWithNeighbours(p,MERGEABLE_INLINE);
            }
        }
    });

    // The current cursor position may no longer be valid, e.g. if a heading span was inserted
    // and the cursor is at a position that is now immediately before the span.
    let start = Position.closestMatchForwards(selectionRange.start,Position.okForInsertion);
    let end = Position.closestMatchBackwards(selectionRange.end,Position.okForInsertion);
    let tempRange = new Range.Range(start.node,start.offset,end.node,end.offset);
    tempRange = Range.forwards(tempRange);
    Hierarchy.ensureRangeValidHierarchy(tempRange);
    start = tempRange.start;
    end = tempRange.end;
    Selection.set(start.node,start.offset,end.node,end.offset);

    function containsOnlyInlineChildren(node: Node): boolean {
        for (let child = node.firstChild; child != null; child = child.nextSibling) {
            if (!Types.isInlineNode(child))
                return false;
        }
        return true;
    }
}

export let MERGEABLE_INLINE: boolean[] = new Array(ElementTypes.HTML_COUNT);

MERGEABLE_INLINE[ElementTypes.HTML_TEXT] = true;

MERGEABLE_INLINE[ElementTypes.HTML_SPAN] = true;
MERGEABLE_INLINE[ElementTypes.HTML_A] = true;
MERGEABLE_INLINE[ElementTypes.HTML_Q] = true;

// HTML 4.01 Section 9.2.1: Phrase elements
MERGEABLE_INLINE[ElementTypes.HTML_EM] = true;
MERGEABLE_INLINE[ElementTypes.HTML_STRONG] = true;
MERGEABLE_INLINE[ElementTypes.HTML_DFN] = true;
MERGEABLE_INLINE[ElementTypes.HTML_CODE] = true;
MERGEABLE_INLINE[ElementTypes.HTML_SAMP] = true;
MERGEABLE_INLINE[ElementTypes.HTML_KBD] = true;
MERGEABLE_INLINE[ElementTypes.HTML_VAR] = true;
MERGEABLE_INLINE[ElementTypes.HTML_CITE] = true;
MERGEABLE_INLINE[ElementTypes.HTML_ABBR] = true;

// HTML 4.01 Section 9.2.3: Subscripts and superscripts
MERGEABLE_INLINE[ElementTypes.HTML_SUB] = true;
MERGEABLE_INLINE[ElementTypes.HTML_SUP] = true;

// HTML 4.01 Section 15.2.1: Font style elements
MERGEABLE_INLINE[ElementTypes.HTML_I] = true;
MERGEABLE_INLINE[ElementTypes.HTML_B] = true;
MERGEABLE_INLINE[ElementTypes.HTML_SMALL] = true;
MERGEABLE_INLINE[ElementTypes.HTML_S] = true;
MERGEABLE_INLINE[ElementTypes.HTML_U] = true;

export let MERGEABLE_BLOCK: boolean[] = new Array(ElementTypes.HTML_COUNT);

MERGEABLE_BLOCK[ElementTypes.HTML_P] = true;
MERGEABLE_BLOCK[ElementTypes.HTML_H1] = true;
MERGEABLE_BLOCK[ElementTypes.HTML_H2] = true;
MERGEABLE_BLOCK[ElementTypes.HTML_H3] = true;
MERGEABLE_BLOCK[ElementTypes.HTML_H4] = true;
MERGEABLE_BLOCK[ElementTypes.HTML_H5] = true;
MERGEABLE_BLOCK[ElementTypes.HTML_H6] = true;
MERGEABLE_BLOCK[ElementTypes.HTML_DIV] = true;
MERGEABLE_BLOCK[ElementTypes.HTML_PRE] = true;
MERGEABLE_BLOCK[ElementTypes.HTML_BLOCKQUOTE] = true;

MERGEABLE_BLOCK[ElementTypes.HTML_UL] = true;
MERGEABLE_BLOCK[ElementTypes.HTML_OL] = true;
MERGEABLE_BLOCK[ElementTypes.HTML_LI] = true;

export let MERGEABLE_BLOCK_AND_INLINE: boolean[] = new Array(ElementTypes.HTML_COUNT);
for (let i = 0; i < ElementTypes.HTML_COUNT; i++) {
    if (MERGEABLE_INLINE[i] || MERGEABLE_BLOCK[i])
        MERGEABLE_BLOCK_AND_INLINE[i] = true;
    MERGEABLE_BLOCK_AND_INLINE["force"] = true;
}
