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

import Callbacks = require("../src/callbacks")
import Collections = require("../src/collections");
import DOM = require("../src/dom");
import Position = require("../src/position");
import Range = require("../src/range");
import Traversal = require("../src/traversal");
import Util = require("../src/util");

function positionKey(pos: Position.Position): string {
    return pos.node._nodeId+","+pos.offset;
}

export function removeWhitespaceTextNodes(parent: Node): void {
    let next: Node;
    for (let child = parent.firstChild; child != null; child = next) {
        next = child.nextSibling;
        if (Traversal.isWhitespaceTextNode(child) || (child instanceof Comment))
            DOM.deleteNode(child);
        else
            removeWhitespaceTextNodes(child);
    }
}

export let allPositions: Position.Position[] = null;
export let allPositionsIndexMap: { [key: string]: number } = null;

export function setup(root: Node): void {
    allPositions = getAllPositions(root);

    allPositionsIndexMap = {};
    for (let i = 0; i < allPositions.length; i++) {
        let pos = allPositions[i];
        allPositionsIndexMap[positionKey(pos)] = i;
    }
}

export function comparePositionsBeforeAndAfter(fun: () => void): string {
    let messages = new Array();
    let positions = getAllPositions(document.body);
    let positionStrings = new Array();
    for (let i = 0; i < positions.length; i++) {
        messages.push("Before: positions["+i+"] = "+positions[i]);
        positionStrings[i] = positions[i].toString();
    }

    Position.trackWhileExecuting(positions,fun);

    messages.push("");
    for (let i = 0; i < positions.length; i++) {
        if (positionStrings[i] != positions[i].toString())
            messages.push("After: positions["+i+"] = "+positions[i]+" - changed from "+
                          positionStrings[i]);
        else
            messages.push("After: positions["+i+"] = "+positions[i]);
    }

    return messages.join("\n");
}

export function getAllPositions(root: Node): Position.Position[] {
    let includeEmptyElements = true;

    let positions: Position.Position[] = [];
    let rootOffset = DOM.nodeOffset(root);
//    positions.push(new Position.Position(root.parentNode,rootOffset));
    recurse(root);
//    positions.push(new Position.Position(root.parentNode,rootOffset+1));
    return positions;

    function recurse(node: Node): void {
        if (node instanceof Text) {
            for (let offset = 0; offset <= node.nodeValue.length; offset++)
                positions.push(new Position.Position(node,offset));
        }
        else if ((node instanceof Element) &&
                 (node.firstChild != null) || includeEmptyElements) {
            let offset = 0;
            for (let child = node.firstChild; child != null; child = child.nextSibling) {
                positions.push(new Position.Position(node,offset));
                recurse(child);
                offset++;
            }
            positions.push(new Position.Position(node,offset));
        }
    }
}

export function getPositionIndex(pos: Position.Position): number {
    let result = allPositionsIndexMap[pos.node._nodeId+","+pos.offset];
    if (result == null)
        throw new Error(pos+": no index for position");
    return result;
}

export function isForwardsSimple(range: Range.Range): boolean {
    let startIndex = getPositionIndex(range.start);
    let endIndex = getPositionIndex(range.end);
//    Callbacks.debug("startIndex = "+indices.startIndex+", endIndex = "+indices.endIndex);
    return (endIndex >= startIndex);
}

export function getOutermostNodesSimple(range: Range.Range): Node[] {
    if (!isForwardsSimple(range)) {
        let reverse = new Range.Range(range.end.node,range.end.offset,
                                range.start.node,range.start.offset);
        if (!Range.isForwards(reverse)) {
            let startIndex = getPositionIndex(range.start);
            let endIndex = getPositionIndex(range.end);
            Callbacks.debug("startIndex = "+startIndex+", endIndex = "+endIndex);
            throw new Error("Both range "+range+" and its reverse are not forwards");
        }
        return getOutermostNodesSimple(reverse);
    }

    let startIndex = getPositionIndex(range.start);
    let endIndex = getPositionIndex(range.end);
    let havePositions = new Object();

    let allArray = new Array();
    let allSet = new Collections.NodeSet();

    for (let i = startIndex; i <= endIndex; i++) {
        let pos = allPositions[i];

        if ((pos.node instanceof Text) && (i < endIndex)) {
            allArray.push(pos.node);
            allSet.add(pos.node);
        }
        else if (pos.node instanceof Element) {
            let prev = new Position.Position(pos.node,pos.offset-1);
            if (havePositions[positionKey(prev)]) {
                let target = pos.node.childNodes[pos.offset-1];
                allArray.push(target);
                allSet.add(target);
            }
            havePositions[positionKey(pos)] = true;
        }

    }

    let outermostArray: Node[] = [];
    let outermostSet = new Collections.NodeSet();

    allArray.forEach(function (node) {
        if (!outermostSet.contains(node) && !setContainsAncestor(allSet,node)) {
            outermostArray.push(node);
            outermostSet.add(node);
        }
    });

    return outermostArray;

    function setContainsAncestor(set: Collections.NodeSet, node: Node): boolean {
        for (let ancestor = node.parentNode; ancestor != null; ancestor = ancestor.parentNode) {
            if (set.contains(ancestor))
                return true;
        }
        return false;
    }
}
