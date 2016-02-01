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

define("tests.InputTests",function(require,exports) {
    "use strict";

    var Input = require("Input");
    var Outline = require("Outline");
    var Position = require("Position");
    var PostponedActions = require("PostponedActions");
    var Range = require("Range");
    var Selection = require("Selection");
    var TestLib = require("tests.TestLib");
    var Traversal = require("Traversal");

    function getNodeArrayText(nodes) {
        var strings = new Array();
        for (var i = 0; i < nodes.length; i++)
            strings.push(Traversal.getNodeText(nodes[i]));
        return strings.join("");
    }

    function textBetweenPositions(from,to) {
        var range = new Range.Range(from.node,from.offset,to.node,to.offset);
        var contents = Range.cloneContents(range);
        return getNodeArrayText(contents);
    }

    function testMovement(direction,count) {
        Outline.init();
        PostponedActions.perform();
        var posId = Input.addPosition(Selection.get().start);
        for (var i = 0; i < count; i++)
            posId = Input.positionFromPositionInDirectionOffset(posId,direction,1);
        Input.setSelectedTextRange(posId,posId);
        TestLib.showSelection();
    }

    function testPositionFun(fun,granularity,direction) {
        var lines = new Array();
        var start = new Position.Position(document.body,0);
        var end = new Position.Position(document.body,document.body.childNodes.length);

        start = Position.closestMatchForwards(start,Position.okForMovement);
        end = Position.closestMatchBackwards(end,Position.okForMovement);

        var pos = start;
        while (pos != null) {

            var before = textBetweenPositions(start,pos);
            var after = textBetweenPositions(pos,end);
            var total = before+"|"+after;

            var result = fun(pos,granularity,direction);
            lines.push(JSON.stringify(total)+" -- "+result+"\n");

            pos = Position.nextMatch(pos,Position.okForMovement);
        }

        return lines.join("");
    }

    function testPositionWithin(granularity,direction) {
        return testPositionFun(Input.isPositionWithinTextUnitInDirection,granularity,direction);
    }

    function testPositionAtBoundary(granularity,direction) {
        return testPositionFun(Input.isPositionAtBoundaryGranularityInDirection,granularity,direction);
    }

    function testPositionToBoundary(granularity,direction) {
        var lines = new Array();
        var start = new Position.Position(document.body,0);
        var end = new Position.Position(document.body,document.body.childNodes.length);

        start = Position.closestMatchForwards(start,Position.okForMovement);
        end = Position.closestMatchBackwards(end,Position.okForMovement);

        var pos = start;
        while (pos != null) {

            var oldBefore = textBetweenPositions(start,pos);
            var oldAfter = textBetweenPositions(pos,end);
            var oldTotal = oldBefore+"|"+oldAfter;

            var resultId = Input.positionFromPositionToBoundaryInDirection(pos,granularity,direction);
            var result = Input.getPosition(resultId);

            var newBefore = textBetweenPositions(start,result);
            var newAfter = textBetweenPositions(result,end);
            var newTotal = newBefore+"|"+newAfter;

            lines.push(JSON.stringify(oldTotal)+" -- "+JSON.stringify(newTotal)+"\n");

            pos = Position.nextMatch(pos,Position.okForMovement);
        }

        return lines.join("");
    }

    function testRangeEnclosing(granularity,direction) {
        var lines = new Array();
        var start = new Position.Position(document.body,0);
        var end = new Position.Position(document.body,document.body.childNodes.length);

        start = Position.closestMatchForwards(start,Position.okForMovement);
        end = Position.closestMatchBackwards(end,Position.okForMovement);

        var pos = start;
        while (pos != null) {

            var oldBefore = textBetweenPositions(start,pos);
            var oldAfter = textBetweenPositions(pos,end);
            var oldTotal = oldBefore+"|"+oldAfter;

            var resultIds =
                Input.rangeEnclosingPositionWithGranularityInDirection(pos,granularity,direction);
            if (resultIds != null) {
                var startId = resultIds.startId;
                var endId = resultIds.endId;
                var rangeStart = Input.getPosition(startId);
                var rangeEnd = Input.getPosition(endId);

                var before = textBetweenPositions(start,rangeStart);
                var middle = textBetweenPositions(rangeStart,rangeEnd);
                var after = textBetweenPositions(rangeEnd,end);

                var newTotal = before+"["+middle+"]"+after;

                lines.push(JSON.stringify(oldTotal)+" -- "+JSON.stringify(newTotal)+"\n");
            }
            else {
                lines.push(JSON.stringify(oldTotal)+" -- null\n");
            }

            pos = Position.nextMatch(pos,Position.okForMovement);
        }

        return lines.join("");
    }

    exports.getNodeArrayText = getNodeArrayText;
    exports.textBetweenPositions = textBetweenPositions;
    exports.testMovement = testMovement;
    exports.testPositionFun = testPositionFun;
    exports.testPositionWithin = testPositionWithin;
    exports.testPositionAtBoundary = testPositionAtBoundary;
    exports.testPositionToBoundary = testPositionToBoundary;
    exports.testRangeEnclosing = testRangeEnclosing;

});
