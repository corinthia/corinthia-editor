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

import Collections = require("../src/collections");
import DOM = require("../src/dom");
import Position = require("../src/position");
import Range = require("../src/range");
import Traversal = require("../src/traversal");
import Util = require("../src/util");

function positionKey(pos) {
    return pos.node._nodeId+","+pos.offset;
}

export function removeWhitespaceTextNodes(parent) {
    var next;
    for (var child = parent.firstChild; child != null; child = next) {
        next = child.nextSibling;
        if (Traversal.isWhitespaceTextNode(child) || (child.nodeType == Node.COMMENT_NODE))
            DOM.deleteNode(child);
        else
            removeWhitespaceTextNodes(child);
    }
}

export var allPositions = null;
export var allPositionsIndexMap = null;

export function setup(root) {
    allPositions = getAllPositions(root);

    allPositionsIndexMap = new Object();
    for (var i = 0; i < allPositions.length; i++) {
        var pos = allPositions[i];
        allPositionsIndexMap[positionKey(pos)] = i;
    }
}

export function comparePositionsBeforeAndAfter(fun) {
    var messages = new Array();
    var positions = getAllPositions(document.body);
    var positionStrings = new Array();
    for (var i = 0; i < positions.length; i++) {
        messages.push("Before: positions["+i+"] = "+positions[i]);
        positionStrings[i] = positions[i].toString();
    }

    Position.trackWhileExecuting(positions,function() {
        fun();

    });

    messages.push("");
    for (var i = 0; i < positions.length; i++) {
        if (positionStrings[i] != positions[i].toString())
            messages.push("After: positions["+i+"] = "+positions[i]+" - changed from "+
                          positionStrings[i]);
        else
            messages.push("After: positions["+i+"] = "+positions[i]);
    }

    return messages.join("\n");
}

export function getAllPositions(root) {
    var includeEmptyElements = true;

    var positions = new Array();
    var rootOffset = DOM.nodeOffset(root);
//    positions.push(new Position.Position(root.parentNode,rootOffset));
    recurse(root);
//    positions.push(new Position.Position(root.parentNode,rootOffset+1));
    return positions;

    function recurse(node) {
        if (node.nodeType == Node.TEXT_NODE) {
            for (var offset = 0; offset <= node.nodeValue.length; offset++)
                positions.push(new Position.Position(node,offset));
        }
        else if ((node.nodeType == Node.ELEMENT_NODE) &&
                 (node.firstChild != null) || includeEmptyElements) {
            var offset = 0;
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                positions.push(new Position.Position(node,offset));
                recurse(child);
                offset++;
            }
            positions.push(new Position.Position(node,offset));
        }
    }
}

export function getPositionIndex(pos) {
    var result = allPositionsIndexMap[pos.node._nodeId+","+pos.offset];
    if (result == null)
        throw new Error(pos+": no index for position");
    return result;
}

export function isForwardsSimple(range) {
    var startIndex = getPositionIndex(range.start);
    var endIndex = getPositionIndex(range.end);
//    Util.debug("startIndex = "+indices.startIndex+", endIndex = "+indices.endIndex);
    return (endIndex >= startIndex);
}

export function getOutermostNodesSimple(range) {
    if (!isForwardsSimple(range)) {
        var reverse = new Range.Range(range.end.node,range.end.offset,
                                range.start.node,range.start.offset);
        if (!Range.isForwards(reverse)) {
            var startIndex = getPositionIndex(range.start);
            var endIndex = getPositionIndex(range.end);
            Util.debug("startIndex = "+startIndex+", endIndex = "+endIndex);
            throw new Error("Both range "+range+" and its reverse are not forwards");
        }
        return getOutermostNodesSimple(reverse);
    }

    var startIndex = getPositionIndex(range.start);
    var endIndex = getPositionIndex(range.end);
    var havePositions = new Object();

    var allArray = new Array();
    var allSet = new Collections.NodeSet();

    for (var i = startIndex; i <= endIndex; i++) {
        var pos = allPositions[i];

        if ((pos.node.nodeType == Node.TEXT_NODE) && (i < endIndex)) {
            allArray.push(pos.node);
            allSet.add(pos.node);
        }
        else if (pos.node.nodeType == Node.ELEMENT_NODE) {
            var prev = new Position.Position(pos.node,pos.offset-1);
            if (havePositions[positionKey(prev)]) {
                var target = pos.node.childNodes[pos.offset-1];
                allArray.push(target);
                allSet.add(target);
            }
            havePositions[positionKey(pos)] = true;
        }

    }

    var outermostArray = new Array();
    var outermostSet = new Collections.NodeSet();

    allArray.forEach(function (node) {
        if (!outermostSet.contains(node) && !setContainsAncestor(allSet,node)) {
            outermostArray.push(node);
            outermostSet.add(node);
        }
    });

    return outermostArray;

    function setContainsAncestor(set,node) {
        for (var ancestor = node.parentNode; ancestor != null; ancestor = ancestor.parentNode) {
            if (set.contains(ancestor))
                return true;
        }
        return false;
    }
}
