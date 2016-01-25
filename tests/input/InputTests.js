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

var InputTests_getNodeArrayText;
var InputTests_textBetweenPositions;
var InputTests_testMovement;
var InputTests_testPositionFun;
var InputTests_testPositionWithin;
var InputTests_testPositionAtBoundary;
var InputTests_testPositionToBoundary;
var InputTests_testRangeEnclosing;

(function() {

    InputTests_getNodeArrayText = function(nodes) {
        var strings = new Array();
        for (var i = 0; i < nodes.length; i++)
            strings.push(Traversal_getNodeText(nodes[i]));
        return strings.join("");
    }

    InputTests_textBetweenPositions = function(from,to) {
        var range = new Range_Range(from.node,from.offset,to.node,to.offset);
        var contents = Range_cloneContents(range);
        return InputTests_getNodeArrayText(contents);
    }

    InputTests_testMovement = function(direction,count) {
        Outline_init();
        PostponedActions_perform();
        var posId = Input_addPosition(Selection_get().start);
        for (var i = 0; i < count; i++)
            posId = Input_positionFromPositionInDirectionOffset(posId,direction,1);
        Input_setSelectedTextRange(posId,posId);
        TestLib_showSelection();
    }

    InputTests_testPositionFun = function(fun,granularity,direction) {
        var lines = new Array();
        var start = new Position_Position(document.body,0);
        var end = new Position_Position(document.body,document.body.childNodes.length);

        start = Position_closestMatchForwards(start,Position_okForMovement);
        end = Position_closestMatchBackwards(end,Position_okForMovement);

        var pos = start;
        while (pos != null) {

            var before = InputTests_textBetweenPositions(start,pos);
            var after = InputTests_textBetweenPositions(pos,end);
            var total = before+"|"+after;

            var result = fun(pos,granularity,direction);
            lines.push(JSON.stringify(total)+" -- "+result+"\n");

            pos = Position_nextMatch(pos,Position_okForMovement);
        }

        return lines.join("");
    }

    InputTests_testPositionWithin = function(granularity,direction) {
        return InputTests_testPositionFun(Input_isPositionWithinTextUnitInDirection,granularity,direction);
    }

    InputTests_testPositionAtBoundary = function(granularity,direction) {
        return InputTests_testPositionFun(Input_isPositionAtBoundaryGranularityInDirection,granularity,direction);
    }

    InputTests_testPositionToBoundary = function(granularity,direction) {
        var lines = new Array();
        var start = new Position_Position(document.body,0);
        var end = new Position_Position(document.body,document.body.childNodes.length);

        start = Position_closestMatchForwards(start,Position_okForMovement);
        end = Position_closestMatchBackwards(end,Position_okForMovement);

        var pos = start;
        while (pos != null) {

            var oldBefore = InputTests_textBetweenPositions(start,pos);
            var oldAfter = InputTests_textBetweenPositions(pos,end);
            var oldTotal = oldBefore+"|"+oldAfter;

            var resultId = Input_positionFromPositionToBoundaryInDirection(pos,granularity,direction);
            var result = Input_getPosition(resultId);

            var newBefore = InputTests_textBetweenPositions(start,result);
            var newAfter = InputTests_textBetweenPositions(result,end);
            var newTotal = newBefore+"|"+newAfter;

            lines.push(JSON.stringify(oldTotal)+" -- "+JSON.stringify(newTotal)+"\n");

            pos = Position_nextMatch(pos,Position_okForMovement);
        }

        return lines.join("");
    }

    InputTests_testRangeEnclosing = function(granularity,direction) {
        var lines = new Array();
        var start = new Position_Position(document.body,0);
        var end = new Position_Position(document.body,document.body.childNodes.length);

        start = Position_closestMatchForwards(start,Position_okForMovement);
        end = Position_closestMatchBackwards(end,Position_okForMovement);

        var pos = start;
        while (pos != null) {

            var oldBefore = InputTests_textBetweenPositions(start,pos);
            var oldAfter = InputTests_textBetweenPositions(pos,end);
            var oldTotal = oldBefore+"|"+oldAfter;

            var resultIds =
                Input_rangeEnclosingPositionWithGranularityInDirection(pos,granularity,direction);
            if (resultIds != null) {
                var startId = resultIds.startId;
                var endId = resultIds.endId;
                var rangeStart = Input_getPosition(startId);
                var rangeEnd = Input_getPosition(endId);

                var before = InputTests_textBetweenPositions(start,rangeStart);
                var middle = InputTests_textBetweenPositions(rangeStart,rangeEnd);
                var after = InputTests_textBetweenPositions(rangeEnd,end);

                var newTotal = before+"["+middle+"]"+after;

                lines.push(JSON.stringify(oldTotal)+" -- "+JSON.stringify(newTotal)+"\n");
            }
            else {
                lines.push(JSON.stringify(oldTotal)+" -- null\n");
            }

            pos = Position_nextMatch(pos,Position_okForMovement);
        }

        return lines.join("");
    }

})();
