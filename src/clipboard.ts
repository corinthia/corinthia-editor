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

import Cursor = require("./cursor");
import DOM = require("./dom");
import ElementTypes = require("./elementTypes");
import Formatting = require("./formatting");
import Main = require("./main");
import Markdown = require("./markdown");
import Position = require("./position");
import PostponedActions = require("./postponedActions");
import Range = require("./range");
import Selection = require("./selection");
import Styles = require("./styles");
import Tables = require("./tables");
import Traversal = require("./traversal");
import Types = require("./types");
import UndoManager = require("./undo");
import Util = require("./util");

function expandRangeForCopy(range: Range.Range): Range.Range {
    if (range == null)
        return range;

    let startInLI: Node = null;
    for (let node = range.start.node; node != null; node = node.parentNode) {
        if (node._type == ElementTypes.HTML_LI)
            startInLI = node;
    }

    let endInLI: Node = null;
    for (let node = range.end.node; node != null; node = node.parentNode) {
        if (node._type == ElementTypes.HTML_LI)
            endInLI = node;
    }

    if ((startInLI != null) && (startInLI == endInLI)) {
        let beforeRange = new Range.Range(startInLI,0,
                                    range.start.node,range.start.offset);
        let afterRange = new Range.Range(range.end.node,range.end.offset,
                                   endInLI,DOM.maxChildOffset(endInLI));
        let contentBefore = Range.hasContent(beforeRange);
        let contentAfter = Range.hasContent(afterRange);

        if (!contentBefore && !contentAfter) {
            let li = startInLI;
            let offset = DOM.nodeOffset(li);
            range = new Range.Range(li.parentNode,offset,li.parentNode,offset+1);
        }
    }
    return range;
}

function copyRange(range: Range.Range): { [key: string]: string } {
    let html = "";
    let text = "";

    if (range != null) {
        let nodes: Node[];
        let region = Tables.regionFromRange(range);
        if (region != null) {
            nodes = [Tables.cloneRegion(region)];
        }
        else {
            nodes = Range.cloneContents(range);
        };

        let div = DOM.createElement(document,"DIV");
        for (let i = 0; i < nodes.length; i++)
            DOM.appendChild(div,nodes[i]);
        Main.removeSpecial(div);

        html = div.innerHTML;
        text = htmlToText(div);
    }

    return { "text/html": html,
             "text/plain": text };
}

// public (FIXME: temp: for testing)
export function htmlToText(node: Node): string {
    return Markdown.htmlToMarkdown(node);
}

// public
export function cut(): { [key: string]: string } {
    UndoManager.newGroup("Cut");
    let content: { [key: string]: string };

    let range = Selection.get();
    range = expandRangeForCopy(range);
    content = copyRange(range);

    Selection.set(range.start.node,range.start.offset,range.end.node,range.end.offset);
    Selection.deleteContents(false);
    let selRange = Selection.get();
    if (selRange != null) {
        Range.trackWhileExecuting(selRange,function() {
            let node = Position.closestActualNode(selRange.start);
            while (node != null) {
                let parent = node.parentNode;
                switch (node._type) {
                case ElementTypes.HTML_LI:
                    if (!Util.nodeHasContent(node))
                        DOM.deleteNode(node);
                    break;
                case ElementTypes.HTML_UL:
                case ElementTypes.HTML_OL: {
                    let haveLI = false;
                    for (let c = node.firstChild; c != null; c = c.nextSibling) {
                        if (c._type == ElementTypes.HTML_LI) {
                            haveLI = true;
                            break;
                        }
                    }
                    if (!haveLI)
                        DOM.deleteNode(node);
                    break;
                }
                }
                node = parent;
            }
        });

        let pos = Position.closestMatchForwards(selRange.start,Position.okForMovement);
        Selection.set(pos.node,pos.offset,pos.node,pos.offset);
    }

    Cursor.ensureCursorVisible();

    PostponedActions.add(UndoManager.newGroup);
    return content;
}

// public
export function copy(): { [key: string]: string } {
    let range = Selection.get();
    range = expandRangeForCopy(range);
    return copyRange(range);
}

// public
export function pasteText(text: string): void {
    let converter = new Showdown.converter();
    let html = converter.makeHtml(text);
    UndoManager.newGroup("Paste");
    pasteHTML(html);
    UndoManager.newGroup();
}

// public
export function pasteHTML(html: string): void {
    if (html.match(/^\s*<thead/i))
        html = "<table>" + html + "</table>";
    else if (html.match(/^\s*<tbody/i))
        html = "<table>" + html + "</table>";
    else if (html.match(/^\s*<tfoot/i))
        html = "<table>" + html + "</table>";
    else if (html.match(/^\s*<tr/i))
        html = "<table>" + html + "</table>";
    else if (html.match(/^\s*<td/i))
        html = "<table><tr>" + html + "</tr></table>";
    else if (html.match(/^\s*<th/i))
        html = "<table><tr>" + html + "</tr></table>";
    else if (html.match(/^\s*<li/i))
        html = "<ul>" + html + "</ul>";

    let div = DOM.createElement(document,"DIV");
    div.innerHTML = html;
    for (let child = div.firstChild; child != null; child = child.nextSibling)
        DOM.assignNodeIds(child);

    let nodes = new Array();
    for (let child = div.firstChild; child != null; child = child.nextSibling)
        nodes.push(child);

    UndoManager.newGroup("Paste");
    let region = Tables.regionFromRange(Selection.get(),true);
    if ((region != null) && (nodes.length == 1) && (nodes[0]._type == ElementTypes.HTML_TABLE))
        pasteTable(nodes[0],region);
    else
        pasteNodes(nodes);
    UndoManager.newGroup();
}

function pasteTable(srcTable: HTMLElement, dest: Tables.TableRegion): void {
    let src = Tables.analyseStructure(srcTable);

    // In the destination table, the region into which we will paste the cells will the
    // the same size as that of the source table, regardless of how many rows and columns
    // were selected - i.e. we only pay attention to the top-left most cell, ignoring
    // whatever the bottom-right is set to
    dest.bottom = dest.top + src.numRows - 1;
    dest.right = dest.left + src.numCols - 1;

    // Make sure the destination table is big enough to hold all the cells we want to paste.
    // This will add rows and columns as appropriate, with empty cells that only contain a
    // <p><br></p> (to ensure they have non-zero height)
    if (dest.structure.numRows < dest.bottom + 1)
        dest.structure.numRows = dest.bottom + 1;
    if (dest.structure.numCols < dest.right + 1)
        dest.structure.numCols = dest.right + 1;
    dest.structure = Tables.Table_fix(dest.structure);

    // To simplify the paste, split any merged cells that are in the region of the destination
    // table we're pasting into. We have to re-analyse the table structure after this to
    // get the correct cell array.
    Tables.TableRegion_splitCells(dest);
    dest.structure = Tables.analyseStructure(dest.structure.element);

    // Do the actual paste
    Selection.preserveWhileExecuting(function() {
        replaceCells(src,dest.structure,dest.top,dest.left);
    });

    // If any new columns were added, calculate a width for them
    Tables.Table_fixColumnWidths(dest.structure);

    // Remove duplicate ids
    let found: { [key: string]: Node } = {};
    removeDuplicateIds(dest.structure.element,found);

    // Place the cursor in the bottom-right cell that was pasted
    let bottomRightCell = Tables.Table_get(dest.structure,dest.bottom,dest.right);
    let node = bottomRightCell.element;
    Selection.set(node,node.childNodes.length,node,node.childNodes.length);
}

function replaceCells(src: Tables.Table, dest: Tables.Table, destRow: number, destCol: number): void {
    // By this point, all of the cells have been split. So it is guaranteed that every cell
    // in dest will have rowspan = 1 and colspan = 1.
    for (let srcRow = 0; srcRow < src.numRows; srcRow++) {
        for (let srcCol = 0; srcCol < src.numCols; srcCol++) {
            let srcCell = Tables.Table_get(src,srcRow,srcCol);
            let destCell = Tables.Table_get(dest,srcRow+destRow,srcCol+destCol);

            if ((srcRow != srcCell.row) || (srcCol != srcCell.col))
                continue;

            if (destCell.rowspan != 1)
                throw new Error("unexpected rowspan: "+destCell.rowspan);
            if (destCell.colspan != 1)
                throw new Error("unexpected colspan: "+destCell.colspan);

            DOM.insertBefore(destCell.element.parentNode,srcCell.element,destCell.element);

            let destTop = destRow + srcRow;
            let destLeft = destCol + srcCol;
            let destBottom = destTop + srcCell.rowspan - 1;
            let destRight = destLeft + srcCell.colspan - 1;
            Tables.Table_setRegion(dest,destTop,destLeft,destBottom,destRight,srcCell);
        }
    }
}

function insertChildrenBefore(parent: Node, child: Node, nextSibling: Node, pastedNodes: Node[]): void {
    let next: Node;
    for (let grandChild = child.firstChild; grandChild != null; grandChild = next) {
        next = grandChild.nextSibling;
        pastedNodes.push(grandChild);
        DOM.insertBefore(parent,grandChild,nextSibling);
    }
}

function fixParagraphStyles(node: Node, paragraphClass: string): void {
    if ((node instanceof HTMLElement) && Types.isParagraphNode(node)) {
        if (node._type == ElementTypes.HTML_P) {
            let className = DOM.getAttribute(node,"class");
            if ((className == null) || (className == "")) {
                Util.debug("Setting paragraph class to "+paragraphClass);
                DOM.setAttribute(node,"class",paragraphClass);
            }
        }
    }
    else {
        for (let child = node.firstChild; child != null; child = child.nextSibling) {
            fixParagraphStyles(child,paragraphClass);
        }
    }
}

// public
export function pasteNodes(nodes: Node[]): void {
    if (nodes.length == 0)
        return;

    let paragraphClass = Styles.getParagraphClass();
    if (paragraphClass != null) {
        for (let i = 0; i < nodes.length; i++) {
            fixParagraphStyles(nodes[i],paragraphClass);
        }
    }

    // Remove any elements which don't belong in the document body (in case an entire
    // HTML document is being pasted in)
    let i = 0;
    while (i < nodes.length) {
        switch (nodes[i]._type) {
        case ElementTypes.HTML_HTML:
        case ElementTypes.HTML_BODY:
        case ElementTypes.HTML_META:
        case ElementTypes.HTML_TITLE:
        case ElementTypes.HTML_SCRIPT:
        case ElementTypes.HTML_STYLE:
            nodes.splice(i,1);
            break;
        default:
            i++;
        }
    }

    let found: { [key: string]: Node } = {};
    for (let i = 0; i < nodes.length; i++)
        removeDuplicateIds(nodes[i],found);

//        if ((nodes.length == 0) && (nodes[0]._type == ElementTypes.HTML_TABLE)) {
//            // FIXME: this won't work; selectionRange is not defined
//            let fromRegion = Tables.getTableRegionFromTable(nodes[0]);
//            let toRegion = Tables.regionFromRange(selectionRange);
//            if (toRegion != null) {
//                return;
//            }
//        }

    Selection.deleteContents(true);
    let range = Selection.get();
    if (range == null)
        throw new Error("No current selection");

    let parent: Node;
    let previousSibling: Node;
    let nextSibling: Node;

    let start = range.start;
    start = Position.preferElementPosition(start);
    if (start.node instanceof Element) {
        parent = start.node;
        nextSibling = start.node.childNodes[start.offset];
        previousSibling = start.node.childNodes[start.offset-1];
    }
    else {
        Formatting.splitTextAfter(start);
        parent = start.node.parentNode;
        nextSibling = start.node.nextSibling;
        previousSibling = start.node;
    }

    let prevLI: HTMLElement = null;
    let inItem: Node = null;
    let inList: Node = null;
    let containerParent: Node = null;

    for (let temp = parent; temp != null; temp = temp.parentNode) {
        if (Types.isContainerNode(temp)) {
            switch (temp._type) {
            case ElementTypes.HTML_LI:
                inItem = temp;
                break;
            case ElementTypes.HTML_UL:
            case ElementTypes.HTML_OL:
                inList = temp;
                break;
            }
            containerParent = temp.parentNode;
            break;
        }
    }

    let pastedNodes: Node[];
    if (inItem) {
        pastedNodes = new Array();
        for (let i = 0; i < nodes.length; i++) {
            let child = nodes[i];

            let offset = DOM.nodeOffset(nextSibling,parent);

            switch (child._type) {
            case ElementTypes.HTML_UL:
            case ElementTypes.HTML_OL:
                Formatting.movePreceding(new Position.Position(parent,offset),
                                         function(x) { return (x == containerParent); });
                insertChildrenBefore(inItem.parentNode,child,inItem,pastedNodes);
                break;
            case ElementTypes.HTML_LI:
                Formatting.movePreceding(new Position.Position(parent,offset),
                                         function(x) { return (x == containerParent); });
                DOM.insertBefore(inItem.parentNode,child,inItem);
                pastedNodes.push(child);
                break;
            default:
                DOM.insertBefore(parent,child,nextSibling);
                pastedNodes.push(child);
                break;
            }
        }
    }
    else if (inList) {
        pastedNodes = new Array();
        for (let i = 0; i < nodes.length; i++) {
            let child = nodes[i];

            let offset = DOM.nodeOffset(nextSibling,parent);

            switch (child._type) {
            case ElementTypes.HTML_UL:
            case ElementTypes.HTML_OL:
                insertChildrenBefore(parent,child,nextSibling,pastedNodes);
                prevLI = null;
                break;
            case ElementTypes.HTML_LI:
                DOM.insertBefore(parent,child,nextSibling);
                pastedNodes.push(child);
                prevLI = null;
                break;
            default:
                if (!Traversal.isWhitespaceTextNode(child)) {
                    if (prevLI == null)
                        prevLI = DOM.createElement(document,"LI");
                    DOM.appendChild(prevLI,child);
                    DOM.insertBefore(parent,prevLI,nextSibling);
                    pastedNodes.push(child);
                }
            }
        }
    }
    else {
        pastedNodes = nodes;
        for (let i = 0; i < nodes.length; i++) {
            let child = nodes[i];
            DOM.insertBefore(parent,child,nextSibling);
        }
    }

    let prevOffset: number;
    if (previousSibling == null)
        prevOffset = 0;
    else
        prevOffset = DOM.nodeOffset(previousSibling);
    let nextOffset = DOM.nodeOffset(nextSibling,parent);

    let origRange = new Range.Range(parent,prevOffset,parent,nextOffset);

    let firstPasted = pastedNodes[0];
    let lastPasted = pastedNodes[pastedNodes.length-1];
    let pastedRange = new Range.Range(firstPasted,0,lastPasted,DOM.maxChildOffset(lastPasted));
    Range.trackWhileExecuting(origRange,function() {
    Range.trackWhileExecuting(pastedRange,function() {
        if (previousSibling != null)
            Formatting.mergeWithNeighbours(previousSibling,Formatting.MERGEABLE_INLINE);
        if (nextSibling != null)
            Formatting.mergeWithNeighbours(nextSibling,Formatting.MERGEABLE_INLINE);

        Cursor.updateBRAtEndOfParagraph(parent);

        Range.ensureValidHierarchy(pastedRange,true);
    })});

    let pos = new Position.Position(origRange.end.node,origRange.end.offset);
    Range.trackWhileExecuting(pastedRange,function() {
    Position.trackWhileExecuting([pos],function() {
        while (true) {
            if (pos.node == document.body)
                break;
            if (Types.isContainerNode(pos.node) && (pos.node._type != ElementTypes.HTML_LI))
                break;
            if (!Util.nodeHasContent(pos.node)) {
                let oldNode = pos.node;
                pos = new Position.Position(pos.node.parentNode,DOM.nodeOffset(pos.node));
                DOM.deleteNode(oldNode);
            }
            else
                break;
        }
    });
    });

    pos = new Position.Position(pastedRange.end.node,pastedRange.end.offset);
    while (Types.isOpaqueNode(pos.node))
        pos = new Position.Position(pos.node.parentNode,DOM.nodeOffset(pos.node)+1);
    pos = Position.closestMatchBackwards(pos,Position.okForInsertion);

    Selection.set(pos.node,pos.offset,pos.node,pos.offset);
    Cursor.ensureCursorVisible();
}

function removeDuplicateIds(node: Node, found: { [key: string]: Node }): void {
    if ((node instanceof Element) && node.hasAttribute("id")) {
        let id = node.getAttribute("id");

        let existing: Node = document.getElementById(id);
        if (existing == null)
            existing = found[id];

        if ((existing != null) && (existing != node))
            DOM.removeAttribute(node,"id");
        else
            found[id] = node;
    }
    for (let child = node.firstChild; child != null; child = child.nextSibling)
        removeDuplicateIds(child,found);
}

function pasteImage(href: string): void {
    // FIXME
}
