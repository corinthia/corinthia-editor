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

define("Clipboard",function(require,exports) {

    var Cursor = require("Cursor");
    var DOM = require("DOM");
    var ElementTypes = require("ElementTypes");
    var Formatting = require("Formatting");
    var Main = require("Main");
    var Markdown = require("Markdown");
    var Position = require("Position");
    var PostponedActions = require("PostponedActions");
    var Range = require("Range");
    var Selection = require("Selection");
    var Styles = require("Styles");
    var Tables = require("Tables");
    var Traversal = require("Traversal");
    var Types = require("Types");
    var UndoManager = require("UndoManager");
    var Util = require("Util");

    function expandRangeForCopy(range) {
        if (range == null)
            return range;

        var startInLI = null;
        for (var node = range.start.node; node != null; node = node.parentNode) {
            if (node._type == ElementTypes.HTML_LI)
                startInLI = node;
        }

        var endInLI = null;
        for (var node = range.end.node; node != null; node = node.parentNode) {
            if (node._type == ElementTypes.HTML_LI)
                endInLI = node;
        }

        if ((startInLI != null) && (startInLI == endInLI)) {
            var beforeRange = new Range.Range(startInLI,0,
                                        range.start.node,range.start.offset);
            var afterRange = new Range.Range(range.end.node,range.end.offset,
                                       endInLI,DOM.maxChildOffset(endInLI));
            var contentBefore = Range.hasContent(beforeRange);
            var contentAfter = Range.hasContent(afterRange);

            if (!contentBefore && !contentAfter) {
                var li = startInLI;
                var offset = DOM.nodeOffset(li);
                range = new Range.Range(li.parentNode,offset,li.parentNode,offset+1);
            }
        }
        return range;
    }

    function copyRange(range) {
        var html = "";
        var text = "";

        if (range != null) {
            var nodes;
            var region = Tables.regionFromRange(range);
            if (region != null) {
                nodes = [Tables.cloneRegion(region)];
            }
            else {
                nodes = Range.cloneContents(range);
            };

            var div = DOM.createElement(document,"DIV");
            for (var i = 0; i < nodes.length; i++)
                DOM.appendChild(div,nodes[i]);
            Main.removeSpecial(div);

            html = div.innerHTML;
            text = htmlToText(div);
        }

        return { "text/html": html,
                 "text/plain": text };
    }

    // public (FIXME: temp: for testing)
    function htmlToText(node) {
        return Markdown.htmlToMarkdown(node);
    }

    // public
    function cut() {
        UndoManager.newGroup("Cut");
        var content;

        var range = Selection.get();
        range = expandRangeForCopy(range);
        content = copyRange(range);

        Selection.set(range.start.node,range.start.offset,range.end.node,range.end.offset);
        Selection.deleteContents(false);
        var selRange = Selection.get();
        if (selRange != null) {
            Range.trackWhileExecuting(selRange,function() {
                var node = Position.closestActualNode(selRange.start);
                while (node != null) {
                    var parent = node.parentNode;
                    switch (node._type) {
                    case ElementTypes.HTML_LI:
                        if (!Util.nodeHasContent(node))
                            DOM.deleteNode(node);
                        break;
                    case ElementTypes.HTML_UL:
                    case ElementTypes.HTML_OL: {
                        var haveLI = false;
                        for (var c = node.firstChild; c != null; c = c.nextSibling) {
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

            var pos = Position.closestMatchForwards(selRange.start,Position.okForMovement);
            Selection.set(pos.node,pos.offset,pos.node,pos.offset);
        }

        Cursor.ensureCursorVisible();

        PostponedActions.perform(UndoManager.newGroup);
        return content;
    }

    // public
    function copy() {
        var range = Selection.get();
        range = expandRangeForCopy(range);
        return copyRange(range);
    }

    // public
    function pasteText(text) {
        var converter = new Showdown.converter();
        var html = converter.makeHtml(text);
        UndoManager.newGroup("Paste");
        pasteHTML(html);
        UndoManager.newGroup();
    }

    // public
    function pasteHTML(html) {
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

        var div = DOM.createElement(document,"DIV");
        div.innerHTML = html;
        for (var child = div.firstChild; child != null; child = child.nextSibling)
            DOM.assignNodeIds(child);

        var nodes = new Array();
        for (var child = div.firstChild; child != null; child = child.nextSibling)
            nodes.push(child);

        UndoManager.newGroup("Paste");
        var region = Tables.regionFromRange(Selection.get(),true);
        if ((region != null) && (nodes.length == 1) && (nodes[0]._type == ElementTypes.HTML_TABLE))
            pasteTable(nodes[0],region);
        else
            pasteNodes(nodes);
        UndoManager.newGroup();
    }

    function pasteTable(srcTable,dest) {
        var src = Tables.analyseStructure(srcTable);

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
        var found = new Object();
        removeDuplicateIds(dest.structure.element,found);

        // Place the cursor in the bottom-right cell that was pasted
        var bottomRightCell = Tables.Table_get(dest.structure,dest.bottom,dest.right);
        var node = bottomRightCell.element;
        Selection.set(node,node.childNodes.length,node,node.childNodes.length);
    }

    function replaceCells(src,dest,destRow,destCol) {
        // By this point, all of the cells have been split. So it is guaranteed that every cell
        // in dest will have rowspan = 1 and colspan = 1.
        for (var srcRow = 0; srcRow < src.numRows; srcRow++) {
            for (var srcCol = 0; srcCol < src.numCols; srcCol++) {
                var srcCell = Tables.Table_get(src,srcRow,srcCol);
                var destCell = Tables.Table_get(dest,srcRow+destRow,srcCol+destCol);

                if ((srcRow != srcCell.row) || (srcCol != srcCell.col))
                    continue;

                if (destCell.rowspan != 1)
                    throw new Error("unexpected rowspan: "+destCell.rowspan);
                if (destCell.colspan != 1)
                    throw new Error("unexpected colspan: "+destCell.colspan);

                DOM.insertBefore(destCell.element.parentNode,srcCell.element,destCell.element);

                var destTop = destRow + srcRow;
                var destLeft = destCol + srcCol;
                var destBottom = destTop + srcCell.rowspan - 1;
                var destRight = destLeft + srcCell.colspan - 1;
                Tables.Table_setRegion(dest,destTop,destLeft,destBottom,destRight,srcCell);
            }
        }
    }

    function insertChildrenBefore(parent,child,nextSibling,pastedNodes) {
        var next;
        for (var grandChild = child.firstChild; grandChild != null; grandChild = next) {
            next = grandChild.nextSibling;
            pastedNodes.push(grandChild);
            DOM.insertBefore(parent,grandChild,nextSibling);
        }
    }

    function fixParagraphStyles(node,paragraphClass) {
        if (Types.isParagraphNode(node)) {
            if (node._type == ElementTypes.HTML_P) {
                var className = DOM.getAttribute(node,"class");
                if ((className == null) || (className == "")) {
                    debug("Setting paragraph class to "+paragraphClass);
                    DOM.setAttribute(node,"class",paragraphClass);
                }
            }
        }
        else {
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                fixParagraphStyles(child,paragraphClass);
            }
        }
    }

    // public
    function pasteNodes(nodes) {
        if (nodes.length == 0)
            return;

        var paragraphClass = Styles.getParagraphClass();
        if (paragraphClass != null) {
            for (var i = 0; i < nodes.length; i++) {
                fixParagraphStyles(nodes[i],paragraphClass);
            }
        }

        // Remove any elements which don't belong in the document body (in case an entire
        // HTML document is being pasted in)
        var i = 0;
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

        var found = new Object();
        for (var i = 0; i < nodes.length; i++)
            removeDuplicateIds(nodes[i],found);

//        if ((nodes.length == 0) && (nodes[0]._type == ElementTypes.HTML_TABLE)) {
//            // FIXME: this won't work; selectionRange is not defined
//            var fromRegion = Tables.getTableRegionFromTable(nodes[0]);
//            var toRegion = Tables.regionFromRange(selectionRange);
//            if (toRegion != null) {
//                return;
//            }
//        }

        Selection.deleteContents(true);
        var range = Selection.get();
        if (range == null)
            throw new Error("No current selection");

        var parent;
        var previousSibling;
        var nextSibling;

        var start = range.start;
        start = Position.preferElementPosition(start);
        if (start.node.nodeType == Node.ELEMENT_NODE) {
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

        var prevLI = null;
        var inItem = null;
        var inList = null;
        var containerParent = null;

        for (var temp = parent; temp != null; temp = temp.parentNode) {
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

        var pastedNodes;
        if (inItem) {
            pastedNodes = new Array();
            for (var i = 0; i < nodes.length; i++) {
                var child = nodes[i];

                var offset = DOM.nodeOffset(nextSibling,parent);

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
            for (var i = 0; i < nodes.length; i++) {
                var child = nodes[i];

                var offset = DOM.nodeOffset(nextSibling,parent);

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
            for (var i = 0; i < nodes.length; i++) {
                var child = nodes[i];
                DOM.insertBefore(parent,child,nextSibling);
            }
        }

        var prevOffset;
        if (previousSibling == null)
            prevOffset = 0;
        else
            prevOffset = DOM.nodeOffset(previousSibling);
        var nextOffset = DOM.nodeOffset(nextSibling,parent);

        var origRange = new Range.Range(parent,prevOffset,parent,nextOffset);

        var firstPasted = pastedNodes[0];
        var lastPasted = pastedNodes[pastedNodes.length-1];
        var pastedRange = new Range.Range(firstPasted,0,lastPasted,DOM.maxChildOffset(lastPasted));
        Range.trackWhileExecuting(origRange,function() {
        Range.trackWhileExecuting(pastedRange,function() {
            if (previousSibling != null)
                Formatting.mergeWithNeighbours(previousSibling,Formatting.MERGEABLE_INLINE);
            if (nextSibling != null)
                Formatting.mergeWithNeighbours(nextSibling,Formatting.MERGEABLE_INLINE);

            Cursor.updateBRAtEndOfParagraph(parent);

            Range.ensureValidHierarchy(pastedRange,true);
        })});

        var pos = new Position.Position(origRange.end.node,origRange.end.offset);
        Range.trackWhileExecuting(pastedRange,function() {
        Position.trackWhileExecuting(pos,function() {
            while (true) {
                if (pos.node == document.body)
                    break;
                if (Types.isContainerNode(pos.node) && (pos.node._type != ElementTypes.HTML_LI))
                    break;
                if (!Util.nodeHasContent(pos.node)) {
                    var oldNode = pos.node;
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

    function removeDuplicateIds(node,found) {
        if ((node.nodeType == Node.ELEMENT_NODE) && node.hasAttribute("id")) {
            var id = node.getAttribute("id");

            var existing = document.getElementById(id);
            if (existing == null)
                existing = found[id];

            if ((existing != null) && (existing != node))
                DOM.removeAttribute(node,"id");
            else
                found[id] = node;
        }
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            removeDuplicateIds(child,found);
    }

    function pasteImage(href) {
        // FIXME
    }

    exports.htmlToText = htmlToText;
    exports.cut = cut;
    exports.copy = copy;
    exports.pasteText = pasteText;
    exports.pasteHTML = pasteHTML;
    exports.pasteNodes = pasteNodes;


});
