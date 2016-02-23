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

import DOM = require("../src/dom");
import ElementTypes = require("../src/elementTypes");
import Formatting = require("../src/formatting");
import Outline = require("../src/outline");
import Position = require("../src/position");
import PostponedActions = require("../src/postponedActions");
import Range = require("../src/range");
import Selection = require("../src/selection");
import Styles = require("../src/styles");
import Traversal = require("../src/traversal");
import Types = require("../src/types");
import UndoManager = require("../src/undo");

export function testHarnessSetup(): void {
    DOM.assignNodeIds(document);

    let start: Position;
    let track: Position[];
    let end: Position;


    UndoManager.disableWhileExecuting(function() {
        start = extractPositionFromCharacter("[");
        track = (start == null) ? [] : [start];
        Position.trackWhileExecuting(track,function() {
            end = extractPositionFromCharacter("]");
        });
    });

    if ((start != null) && (end == null))
        throw new Error("Start of selection specified, but not end");
    if ((start == null) && (end != null))
        throw new Error("End of selection specified, but not start");

    if ((start != null) && (end != null)) {
        let range = new Range(start.node,start.offset,end.node,end.offset);

        UndoManager.disableWhileExecuting(function() {
            Range.trackWhileExecuting(range,function() {
                positionMergeWithNeighbours(start);
                positionMergeWithNeighbours(end);
            });
        });

        range.start = range.start.preferTextPosition();
        range.end = range.end.preferTextPosition();

        Selection.set(range.start.node,range.start.offset,range.end.node,range.end.offset);
    }

    return;

    function positionMergeWithNeighbours(pos: Position): void {
        let node = pos.node;
        let offset = pos.offset;
        if ((node instanceof Element) && (offset < node.childNodes.length))
            Formatting.mergeWithNeighbours(node.childNodes[offset],Formatting.MERGEABLE_INLINE);
        else if ((node instanceof Element) && (node.lastChild != null))
            Formatting.mergeWithNeighbours(node.lastChild,Formatting.MERGEABLE_INLINE);
        else
            Formatting.mergeWithNeighbours(node,Formatting.MERGEABLE_INLINE);
    }

    function extractPositionFromCharacter(c: string): Position {
        return recurse(document.body);

        function recurse(node: Node): Position {
            if (node instanceof Text) {
                let index = node.nodeValue.indexOf(c);
                if (index >= 0) {
                    let offsetInParent = Traversal.nodeOffset(node);
                    if (index == 0) {
                        node.nodeValue = node.nodeValue.substring(1);
                        return new Position(node.parentNode,offsetInParent);
                    }
                    else if (index == node.nodeValue.length - 1) {
                        node.nodeValue = node.nodeValue.substring(0,node.nodeValue.length-1);
                        return new Position(node.parentNode,offsetInParent+1);
                    }
                    else {
                        let rest = node.nodeValue.substring(index+1);
                        node.nodeValue = node.nodeValue.substring(0,index);
                        let restNode = DOM.createTextNode(document,rest);
                        DOM.insertBefore(node.parentNode,restNode,node.nextSibling);
                        return new Position(node.parentNode,offsetInParent+1);
                    }
                }
            }
            else {
                for (let child = node.firstChild; child != null; child = child.nextSibling) {
                    let result = recurse(child);
                    if (result != null)
                        return result;
                }
            }
            return null;
        }
    }
}

export function insertAtPosition(position: Position, node: Node): void {
    if (position.node instanceof Element) {
        if (position.offset == position.node.childNodes.length)
            DOM.appendChild(position.node,node);
        else
            DOM.insertBefore(position.node,node,position.node.childNodes[position.offset]);
    }
    else if (position.node instanceof Text) {
        let newText = DOM.createTextNode(document,position.node.nodeValue.slice(position.offset));
        position.node.nodeValue = position.node.nodeValue.slice(0,position.offset);
        DOM.insertBefore(position.node.parentNode,newText,position.node.nextSibling);
        DOM.insertBefore(position.node.parentNode,node,position.node.nextSibling);
    }
}

export function insertTextAtPosition(position: Position, str: string): void {
    if (position.node instanceof Element) {
        let before = position.node.childNodes[position.offset-1];
        let after = position.node.childNodes[position.offset];
        if ((after != null) && (after instanceof Text))
            position = new Position(after,0);
        else if ((before != null) && (before instanceof Text))
            position = new Position(before,before.nodeValue.length);
    }
    if (position.node instanceof Element) {
        insertAtPosition(position,DOM.createTextNode(document,str));
    }
    else if (position.node instanceof Text) {
        position.node.nodeValue = position.node.nodeValue.slice(0,position.offset) + str +
                                  position.node.nodeValue.slice(position.offset);
    }
}

export function showRangeAsBrackets(range: Range): void {
    if (range.isEmpty()) {
        insertTextAtPosition(range.end,"[]");
    }
    else {
        insertTextAtPosition(range.end,"]");
        insertTextAtPosition(range.start,"[");
    }
}

export function showSelection(): void {
    let range = Selection.get();
    if (range != null) {
        range.assertValid("Selection");
        showRangeAsBrackets(range);
    }
}

export function removeIds(): void {
    recurse(document.body);

    function recurse(node: Node): void {
        if (node instanceof Element) {
            DOM.removeAttribute(node,"id");
            for (let child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }
}

export function selectNode(node: Node): void {
    let offset = Traversal.nodeOffset(node);
    Selection.set(node.parentNode,offset,node.parentNode,offset+1);
}

export function removeWhitespaceAndCommentNodes(root: Node): void {
    Selection.preserveWhileExecuting(function() {
        recurse(root);
    });

    function recurse(node: Node): void {
        if (Traversal.isWhitespaceTextNode(node) || (node instanceof Comment)) {
            DOM.deleteNode(node);
        }
        else {
            let next: Node;
            for (let child = node.firstChild; child != null; child = next) {
                next = child.nextSibling;
                recurse(child);
            }
        }
    }
}

// selectionWrapElement() and selectionUnwrapElement() used to be in formatting.js but have
// now been made obselete by the addition of applyFormattingChanges(). However there are still
// a few tests which use them.
export function selectionWrapElement(elementName: string): void {
    if (elementName == "B")
        Formatting.applyFormattingChanges(null,{"font-weight": "bold"});
    else if (elementName == "I")
        Formatting.applyFormattingChanges(null,{"font-style": "italic"});
    else if (elementName == "U")
        Formatting.applyFormattingChanges(null,{"text-decoration": "underline"});
}

export function selectionUnwrapElement(elementName: string): void {
    if (elementName == "B")
        Formatting.applyFormattingChanges(null,{"font-weight": null});
    else if (elementName == "I")
        Formatting.applyFormattingChanges(null,{"font-style": null});
    else if (elementName == "U")
        Formatting.applyFormattingChanges(null,{"text-decoration": null});
}

export function showEmptyTextNodes(): void {
    recurse(document);

    function recurse(node: Node): void {
        if ((node instanceof Text) && (node.nodeValue.length == 0))
            node.nodeValue = "*";
        for (let child = node.firstChild; child != null; child = child.nextSibling)
            recurse(child);
    }
}

export function showClipboard(clipboard: { [key: string]: string }): string {
    let html = clipboard["text/html"];
    let text = clipboard["text/plain"];

    if ((html.length == 0) || (html.charAt(html.length-1) != "\n"))
        html += "\n";
    if ((text.length == 0) || (text.charAt(text.length-1) != "\n"))
        text += "\n";

    // Chrome and Safari behave differently when generating style attribute values for innerHTML.
    // Safari adds a space after the last property definition, while chrome doesn't. For consistent
    // results, we add the space if it is not already there (this was the original behaviour
    // of Chrome but it changed).
    html = html.replace(/(style="[^"]+;)"/g,"$1 \"");

    return "text/html\n"+
           "---------\n"+
           "\n"+
           html+
           "\n"+
           "text/plain\n"+
           "----------\n"+
           "\n"+
           text;
}

export function setNumbering(enabled: boolean): void {
    if (enabled)
        setupOutlineNumbering();

    recurse(document.body,enabled);
    PostponedActions.perform();

    function recurse(node: Node, enabled: boolean): void {
        switch (node._type) {
        case ElementTypes.HTML_H1:
        case ElementTypes.HTML_H2:
        case ElementTypes.HTML_H3:
        case ElementTypes.HTML_H4:
        case ElementTypes.HTML_H5:
        case ElementTypes.HTML_H6:
        case ElementTypes.HTML_FIGURE:
        case ElementTypes.HTML_TABLE:
            if ((node instanceof HTMLElement) && !Types.isInTOC(node)) {
                Outline.setNumbered(node.getAttribute("id"),enabled);
                return;
            }
            break;
        }

        for (let child = node.firstChild; child != null; child = child.nextSibling)
            recurse(child,enabled);
    }
}

export function readXML(filename: string): Document {
    let req = new XMLHttpRequest();
    req.open("GET",filename,false);
    req.send();
    let xml = req.responseXML;
    if (xml == null)
        return null;
    DOM.assignNodeIds(xml.documentElement);
    return xml;
}

export function findTextMatchingRecursive(node: Node, re: RegExp): Node {
    if (node instanceof Text) {
        if (node.nodeValue.match(re))
            return node;
        else
            return null;
    }
    else {
        for (let child = node.firstChild; child != null; child = child.nextSibling) {
            let result = findTextMatchingRecursive(child,re);
            if (result != null)
                return result;
        }
        return null;
    }
}

export function setupOutlineNumbering(): void {
    Styles.setCSSText("",{
        "h1": {
            "counter-reset": "h2 h3 h4 h5 h6",
            "counter-increment": "h1"
        },
        "h2": {
            "counter-reset": "h3 h4 h5 h6",
            "counter-increment": "h2"
        },
        "h3": {
            "counter-reset": "h4 h5 h6",
            "counter-increment": "h3"
        },
        "h4": {
            "counter-reset": "h5 h6",
            "counter-increment": "h4"
        },
        "h5": {
            "counter-reset": "h6",
            "counter-increment": "h5"
        },
        "h6": {
            "counter-increment": "h6"
        },
        "h1::before": {
            "content": "counter(h1) ' '"
        },
        "h2::before": {
            "content": "counter(h1) '.' counter(h2) ' '"
        },
        "h3::before": {
            "content": "counter(h1) '.' counter(h2) '.' counter(h3) ' '"
        },
        "h4::before": {
            "content": "counter(h1) '.' counter(h2) '.' counter(h3) '.' counter(h4) ' '"
        },
        "h5::before": {
            "content": "counter(h1) '.' counter(h2) '.' counter(h3) '.' counter(h4) '.' counter(h5) ' '"
        },
        "h6::before": {
            "content": "counter(h1) '.' counter(h2) '.' counter(h3) '.' counter(h4) '.' counter(h5) '.' counter(h6) ' '"
        },
    });
}

export function prependTableOfContents(): void {
    let nav = DOM.createElement(document,"NAV");
    DOM.setAttribute(nav,"class","tableofcontents");
    DOM.insertBefore(document.body,nav,document.body.firstChild);
    PostponedActions.perform();
}

export function simplifyTOCs(): void {
    recurse(document.body);

    function recurse(node: Node): void {
        if ((node instanceof HTMLElement) &&
            (node._type == ElementTypes.HTML_NAV) &&
            ((DOM.getAttribute(node,"class") == "tableofcontents") ||
             (DOM.getAttribute(node,"class") == "listoffigures") ||
             (DOM.getAttribute(node,"class") == "listoftables"))) {
            mergeAdjacentTextNodes(node);
        }
        else {
            for (let child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }

    function mergeAdjacentTextNodes(node: Node): void {
        let child = node.firstChild;
        while (child != null) {
            let curChild = child;
            let nextChild = child.nextSibling;
            if ((curChild instanceof Text) &&
                (nextChild != null) &&
                (nextChild instanceof Text)) {
                DOM.insertCharacters(curChild,child.nodeValue.length,nextChild.nodeValue);
                DOM.deleteNode(nextChild);
            }
            else {
                child = nextChild;
            }
        }

        for (let child = node.firstChild; child != null; child = child.nextSibling)
            mergeAdjacentTextNodes(child);
    }
}

export function showNonEmptyTextNodes(): void {
    recurse(document.body);

    function recurse(node: Node): void {
        if (node instanceof Text) {
            if (!Traversal.isWhitespaceTextNode(node))
                node.nodeValue = "{" + node.nodeValue + "}";
        }
        else {
            for (let child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }
}
