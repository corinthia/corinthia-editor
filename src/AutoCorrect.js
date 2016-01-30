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

define("AutoCorrect",function(require,exports) {

    var Collections = require("Collections");
    var DOM = require("DOM");
    var Editor = require("Editor");
    var Formatting = require("Formatting");
    var Position = require("Position");
    var PostponedActions = require("PostponedActions");
    var Range = require("Range");
    var Selection = require("Selection");
    var Traversal = require("Traversal");
    var Types = require("Types");
    var UndoManager = require("UndoManager");

    function removeCorrectionSpan(span) {
        if (span.parentNode == null)
            return;
        Selection.preserveWhileExecuting(function() {
            var firstChild = span.firstChild;
            DOM.removeNodeButKeepChildren(span);
            if (firstChild != null)
                Formatting.mergeWithNeighbours(firstChild,{});
        });
    }

    function Correction(span) {
        this.span = span;
        this.modificationListener = function(event) {
            if (DOM.getIgnoreMutations())
                return;
            PostponedActions.add(function() {
                // This will trigger a removeCorrection() call
                removeCorrectionSpan(span);
            });
        };
    }

    Correction.prototype.toString = function() {
        return this.span.getAttribute("original")+" -> "+Traversal.getNodeText(this.span);
    }

    var correctionsByNode = null;
    var correctionList = null;

    // private
    function docNodeInserted(event) {
        try {
            recurse(event.target);
        }
        catch (e) {
            Editor.error(e);
        }

        function recurse(node) {
            if (Types.isAutoCorrectNode(node))
                addCorrection(node);
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }

    // private
    function docNodeRemoved(event) {
        try {
            recurse(event.target);
        }
        catch (e) {
            Editor.error(e);
        }

        function recurse(node) {
            if (Types.isAutoCorrectNode(node))
                removeCorrection(node);
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }

    function init() {
        correctionsByNode = new Collections.NodeMap();
        correctionList = new Array();
        document.addEventListener("DOMNodeInserted",docNodeInserted);
        document.addEventListener("DOMNodeRemoved",docNodeRemoved);
    }

    // public (for the undo tests, when they report results)
    function removeListeners() {
        document.removeEventListener("DOMNodeInserted",docNodeInserted);
        document.removeEventListener("DOMNodeRemoved",docNodeRemoved);
    }

    function addCorrection(span) {
        var correction = new Correction(span);
        correctionsByNode.put(span,correction);
        correctionList.push(correction);
        Editor.updateAutoCorrect();

        span.addEventListener("DOMSubtreeModified",correction.modificationListener);
    }

    function removeCorrection(span) {
        var correction = correctionsByNode.get(span);
        if (correction == null)
            throw new Error("No autocorrect entry for "+JSON.stringify(Traversal.getNodeText(span)));

        var index = null;
        for (var i = 0; i < correctionList.length; i++) {
            if (correctionList[i].span == span) {
                index = i;
                break;
            }
        }
        if (index == null)
            throw new Error("Correction "+correction+" not found in correctionList");
        correctionList.splice(index,1);
        Editor.updateAutoCorrect();

        span.removeEventListener("DOMSubtreeModified",correction.modificationListener);
        correctionsByNode.remove(span);
    }

    function getCorrections() {
        var result = new Array();
        for (var i = 0; i < correctionList.length; i++) {
            var correction = correctionList[i];
            result.push({ original: correction.span.getAttribute("original"),
                          replacement: Traversal.getNodeText(correction.span)});
        }
        return result;
    }

    function correctPrecedingWord(numChars,replacement,confirmed) {
        Selection.preserveWhileExecuting(function() {
            var selRange = Selection.get();
            if ((selRange == null) && !Range.isEmpty(selRange))
                return;

            var node = selRange.start.node;
            var offset = selRange.start.offset;
            if (node.nodeType != Node.TEXT_NODE)
                return;

            var original = node.nodeValue.substring(offset-numChars,offset);

            if (confirmed) {
                DOM.replaceCharacters(node,offset-numChars,offset,replacement);
                return;
            }

            UndoManager.newGroup("Auto-correct");
            var before = node.nodeValue.substring(0,offset-numChars);
            var beforeText = DOM.createTextNode(document,before);
            var replacementText = DOM.createTextNode(document,replacement);
            var span = DOM.createElement(document,"SPAN");
            DOM.setAttribute(span,"class",Types.Keys.AUTOCORRECT_CLASS);
            DOM.setAttribute(span,"original",original);
            DOM.appendChild(span,replacementText);
            DOM.insertBefore(node.parentNode,beforeText,node);
            DOM.insertBefore(node.parentNode,span,node);
            DOM.deleteCharacters(node,0,offset);
            // Add the new group in a postponed action, so that the change to the style element
            // is not counted as a separate action
            PostponedActions.add(UndoManager.newGroup);
        });
    }

    function getCorrection() {
        var correction = getCurrent();
        if (correction == null)
            return null;

        return { original: correction.span.getAttribute("original"),
                 replacement: Traversal.getNodeText(correction.span) };
    }

    function getCorrectionCoords() {
        var correction = getCurrent();
        if (correction == null)
            return null;

        var textNode = correction.span.firstChild;
        if ((textNode == null) || (textNode.nodeType != Node.TEXT_NODE))
            return null;

        var offset = Math.floor(textNode.nodeValue.length/2);
        Selection.set(textNode,offset,textNode,offset);
        Cursor.ensureCursorVisible();
        var rect = Position.displayRectAtPos(new Position.Position(textNode,offset));

        if (rect == null) // FIXME: pos
            throw new Error("no rect for pos "+(new Position.Position(textNode,offset)));

        if (rect == null)
            return null;

        return { x: rect.left, y: rect.top };
    }

    function getCurrent() {
        var range = Selection.get();
        if (range != null) {
            var endNode = Position.closestActualNode(range.end);
            for (; endNode != null; endNode = endNode.parentNode) {
                if (Types.isAutoCorrectNode(endNode))
                    return correctionsByNode.get(endNode);
            }
        }

        if (correctionList.length > 0)
            return correctionList[correctionList.length-1];

        return null;
    }

    function acceptCorrection() {
        UndoManager.newGroup("Accept");
        var correction = getCurrent();
        if (correction == null)
            return;

        removeCorrectionSpan(correction.span);
        UndoManager.newGroup();
    }

    function revertCorrection() {
        var correction = getCurrent();
        if (correction == null)
            return;

        replaceCorrection(correction.span.getAttribute("original"));
    }

    function replaceCorrection(replacement) {
        UndoManager.newGroup("Replace");
        var correction = getCurrent();
        if (correction == null)
            return;

        Selection.preserveWhileExecuting(function() {
            var text = DOM.createTextNode(document,replacement);
            DOM.insertBefore(correction.span.parentNode,text,correction.span);
            DOM.deleteNode(correction.span);
            Formatting.mergeWithNeighbours(text,{});
        });
        UndoManager.newGroup();
    }

    exports.init = init;
    exports.removeListeners = removeListeners;
    exports.addCorrection = addCorrection;
    exports.removeCorrection = removeCorrection;
    exports.getCorrections = getCorrections;
    exports.correctPrecedingWord = correctPrecedingWord;
    exports.getCorrection = getCorrection;
    exports.getCorrectionCoords = getCorrectionCoords;
    exports.acceptCorrection = acceptCorrection;
    exports.revertCorrection = revertCorrection;
    exports.replaceCorrection = replaceCorrection;

});
