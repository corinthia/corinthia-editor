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

var RangeTests_allPositions;
var RangeTests_allPositionsIndexMap;
var RangeTests_removeWhitespaceTextNodes;
var RangeTests_setup;
var RangeTests_comparePositionsBeforeAndAfter;
var RangeTests_getAllPositions;
var RangeTests_getPositionIndex;
var RangeTests_isForwardsSimple;
var RangeTests_getOutermostNodesSimple;

(function() {

    function positionKey(pos) {
        return pos.node._nodeId+","+pos.offset;
    }

    RangeTests_removeWhitespaceTextNodes = function(parent) {
        var next;
        for (var child = parent.firstChild; child != null; child = next) {
            next = child.nextSibling;
            if (Traversal_isWhitespaceTextNode(child) || (child.nodeType == Node.COMMENT_NODE))
                DOM_deleteNode(child);
            else
                RangeTests_removeWhitespaceTextNodes(child);
        }
    }

    RangeTests_setup = function(root) {
        RangeTests_allPositions = RangeTests_getAllPositions(root);

        RangeTests_allPositionsIndexMap = new Object();
        for (var i = 0; i < RangeTests_allPositions.length; i++) {
            var pos = RangeTests_allPositions[i];
            RangeTests_allPositionsIndexMap[positionKey(pos)] = i;
        }
    }

    RangeTests_comparePositionsBeforeAndAfter = function(fun) {
        var messages = new Array();
        var positions = RangeTests_getAllPositions(document.body);
        var positionStrings = new Array();
        for (var i = 0; i < positions.length; i++) {
            messages.push("Before: positions["+i+"] = "+positions[i]);
            positionStrings[i] = positions[i].toString();
        }

        Position_trackWhileExecuting(positions,function() {
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

    RangeTests_getAllPositions = function(root) {
        var includeEmptyElements = true;

        var positions = new Array();
        var rootOffset = DOM_nodeOffset(root);
    //    positions.push(new Position_Position(root.parentNode,rootOffset));
        recurse(root);
    //    positions.push(new Position_Position(root.parentNode,rootOffset+1));
        return positions;

        function recurse(node) {
            if (node.nodeType == Node.TEXT_NODE) {
                for (var offset = 0; offset <= node.nodeValue.length; offset++)
                    positions.push(new Position_Position(node,offset));
            }
            else if ((node.nodeType == Node.ELEMENT_NODE) &&
                     (node.firstChild != null) || includeEmptyElements) {
                var offset = 0;
                for (var child = node.firstChild; child != null; child = child.nextSibling) {
                    positions.push(new Position_Position(node,offset));
                    recurse(child);
                    offset++;
                }
                positions.push(new Position_Position(node,offset));
            }
        }
    }

    RangeTests_getPositionIndex = function(pos) {
        var result = RangeTests_allPositionsIndexMap[pos.node._nodeId+","+pos.offset];
        if (result == null)
            throw new Error(pos+": no index for position");
        return result;
    }

    RangeTests_isForwardsSimple = function(range) {
        var startIndex = RangeTests_getPositionIndex(range.start);
        var endIndex = RangeTests_getPositionIndex(range.end);
    //    debug("startIndex = "+indices.startIndex+", endIndex = "+indices.endIndex);
        return (endIndex >= startIndex);
    }

    RangeTests_getOutermostNodesSimple = function(range) {
        if (!RangeTests_isForwardsSimple(range)) {
            var reverse = new Range_Range(range.end.node,range.end.offset,
                                    range.start.node,range.start.offset);
            if (!Range_isForwards(reverse)) {
                var startIndex = RangeTests_getPositionIndex(range.start);
                var endIndex = RangeTests_getPositionIndex(range.end);
                debug("startIndex = "+startIndex+", endIndex = "+endIndex);
                throw new Error("Both range "+range+" and its reverse are not forwards");
            }
            return RangeTests_getOutermostNodesSimple(reverse);
        }

        var startIndex = RangeTests_getPositionIndex(range.start);
        var endIndex = RangeTests_getPositionIndex(range.end);
        var havePositions = new Object();

        var allArray = new Array();
        var allSet = new Collections_NodeSet();

        for (var i = startIndex; i <= endIndex; i++) {
            var pos = RangeTests_allPositions[i];

            if ((pos.node.nodeType == Node.TEXT_NODE) && (i < endIndex)) {
                allArray.push(pos.node);
                allSet.add(pos.node);
            }
            else if (pos.node.nodeType == Node.ELEMENT_NODE) {
                var prev = new Position_Position(pos.node,pos.offset-1);
                if (havePositions[positionKey(prev)]) {
                    var target = pos.node.childNodes[pos.offset-1];
                    allArray.push(target);
                    allSet.add(target);
                }
                havePositions[positionKey(pos)] = true;
            }

        }

        var outermostArray = new Array();
        var outermostSet = new Collections_NodeSet();

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

})();
