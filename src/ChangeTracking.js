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

define("ChangeTracking",function(require,exports) {

    var DOM = require("DOM");
    var ElementTypes = require("ElementTypes");
    var Position = require("Position");
    var Range = require("Range");
    var Selection = require("Selection");
    var Traversal = require("Traversal");

    var showChangesEnabled = false;
    var trackChangesEnabled = false;

    function showChanges() {
        return showChangesEnabled;
    }

    function trackChanges() {
        return trackChangesEnabled;
    }

    function setShowChanges(enabled) {
        showChangesEnabled = enabled;
    }

    function setTrackChanges(enabled) {
        trackChangesEnabled = enabled;
    }

    function acceptSelectedChanges() {
        var selRange = Selection.get();
        if (selRange == null)
            return;

        var outermost = Range.getOutermostNodes(selRange,true);
        var checkEmpty = new Array();

        Selection.preserveWhileExecuting(function() {
            for (var i = 0; i < outermost.length; i++) {
                recurse(outermost[i]);

                var next;
                for (ancestor = outermost[i].parentNode; ancestor != null; ancestor = next) {
                    next = ancestor.parentNode;
                    if (ancestor._type == ElementTypes.HTML_DEL) {
                        checkEmpty.push(ancestor.parentNode);
                        DOM.deleteNode(ancestor);
                    }
                    else if (ancestor._type == ElementTypes.HTML_INS)
                        DOM.removeNodeButKeepChildren(ancestor);
                }
            }

            for (var i = 0; i < checkEmpty.length; i++) {
                var node = checkEmpty[i];
                if (node == null)
                    continue;
                var empty = true;
                for (var child = node.firstChild; child != null; child = child.nextSibling) {
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

        var selRange = Selection.get();
        if (selRange != null) {
            var start = Position.closestMatchForwards(selRange.start,Position.okForInsertion);
            var end = Position.closestMatchBackwards(selRange.end,Position.okForInsertion);
            if (!Range.isForwards(new Range.Range(start.node,start.offset,end.node,end.offset)))
                end = Position.closestMatchForwards(selRange.end,Position.okForInsertion);
            Selection.set(start.node,start.offset,end.node,end.offset);
        }

        function recurse(node) {
            if (node._type == ElementTypes.HTML_DEL) {
                checkEmpty.push(node.parentNode);
                DOM.deleteNode(node);
                return;
            }

            var next;
            for (var child = node.firstChild; child != null; child = next) {
                next = child.nextSibling;
                recurse(child);
            }

            if (node._type == ElementTypes.HTML_INS) {
                DOM.removeNodeButKeepChildren(node);
            }
        }
    }

    exports.showChanges = showChanges;
    exports.trackChanges = trackChanges;
    exports.setShowChanges = setShowChanges;
    exports.setTrackChanges = setTrackChanges;
    exports.acceptSelectedChanges = acceptSelectedChanges;

});
