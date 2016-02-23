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
import Position = require("./position");
import Range = require("./range");
import Selection = require("./selection");
import Traversal = require("./traversal");

let showChangesEnabled = false;
let trackChangesEnabled = false;

export function showChanges(): boolean {
    return showChangesEnabled;
}

export function trackChanges(): boolean {
    return trackChangesEnabled;
}

export function setShowChanges(enabled: boolean): void {
    showChangesEnabled = enabled;
}

export function setTrackChanges(enabled: boolean): void {
    trackChangesEnabled = enabled;
}

export function acceptSelectedChanges(): void {
    let selRange = Selection.get();
    if (selRange == null)
        return;

    let outermost = Range.getOutermostNodes(selRange,true);
    let checkEmpty = new Array();

    Selection.preserveWhileExecuting(function() {
        for (let i = 0; i < outermost.length; i++) {
            recurse(outermost[i]);

            let next: Node;
            for (let ancestor = outermost[i].parentNode; ancestor != null; ancestor = next) {
                next = ancestor.parentNode;
                if (ancestor._type == ElementTypes.HTML_DEL) {
                    checkEmpty.push(ancestor.parentNode);
                    DOM.deleteNode(ancestor);
                }
                else if (ancestor._type == ElementTypes.HTML_INS)
                    DOM.removeNodeButKeepChildren(ancestor);
            }
        }

        for (let i = 0; i < checkEmpty.length; i++) {
            let node = checkEmpty[i];
            if (node == null)
                continue;
            let empty = true;
            for (let child = node.firstChild; child != null; child = child.nextSibling) {
                if (!Traversal.isWhitespaceTextNode(child)) {
                    empty = false;
                    break;
                }
            }
            if (empty) {
                switch (node._type) {
                case ElementTypes.HTML_LI:
                case ElementTypes.HTML_UL:
                case ElementTypes.HTML_OL:
                    checkEmpty.push(node.parentNode);
                    DOM.deleteNode(node);
                    break;
                }
            }
        }
    });

    selRange = Selection.get();
    if (selRange != null) {
        let start = Position.closestMatchForwards(selRange.start,Position.okForInsertion);
        let end = Position.closestMatchBackwards(selRange.end,Position.okForInsertion);
        if (!Range.isForwards(new Range(start.node,start.offset,end.node,end.offset)))
            end = Position.closestMatchForwards(selRange.end,Position.okForInsertion);
        Selection.set(start.node,start.offset,end.node,end.offset);
    }

    function recurse(node: Node): void {
        if (node._type == ElementTypes.HTML_DEL) {
            checkEmpty.push(node.parentNode);
            DOM.deleteNode(node);
            return;
        }

        let next: Node;
        for (let child = node.firstChild; child != null; child = next) {
            next = child.nextSibling;
            recurse(child);
        }

        if (node._type == ElementTypes.HTML_INS) {
            DOM.removeNodeButKeepChildren(node);
        }
    }
}
