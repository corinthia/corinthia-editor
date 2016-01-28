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

(function(api) {

    var InputTests = api.tests.InputTests; // export

    var Input = api.Input; // import
    var Outline = api.Outline; // import
    var Position = api.Position; // import
    var PostponedActions = api.PostponedActions; // import
    var Range = api.Range; // import
    var Selection = api.Selection; // import
    var TestLib = api.tests.TestLib; // import
    var Traversal = api.Traversal; // import

    InputTests.getNodeArrayText = function(nodes) {
        var strings = new Array();
        for (var i = 0; i < nodes.length; i++)
            strings.push(Traversal.getNodeText(nodes[i]));
        return strings.join("");
    }

    InputTests.textBetweenPositions = function(from,to) {
        var range = new Range.Range(from.node,from.offset,to.node,to.offset);
        var contents = Range.cloneContents(range);
        return InputTests.getNodeArrayText(contents);
    }

    InputTests.testMovement = function(direction,count) {
        Outline.init();
        PostponedActions.perform();
        var posId = Input.addPosition(Selection.get().start);
        for (var i = 0; i < count; i++)
            posId = Input.positionFromPositionInDirectionOffset(posId,direction,1);
        Input.setSelectedTextRange(posId,posId);
        TestLib.showSelection();
    }

    InputTests.testPositionFun = function(fun,granularity,direction) {
        var lines = new Array();
        var start = new Position.Position(document.body,0);
        var end = new Position.Position(document.body,document.body.childNodes.length);

        start = Position.closestMatchForwards(start,Position.okForMovement);
        end = Position.closestMatchBackwards(end,Position.okForMovement);

        var pos = start;
        while (pos != null) {

            var before = InputTests.textBetweenPositions(start,pos);
            var after = InputTests.textBetweenPositions(pos,end);
            var total = before+"|"+after;

            var result = fun(pos,granularity,direction);
            lines.push(JSON.stringify(total)+" -- "+result+"\n");

            pos = Position.nextMatch(pos,Position.okForMovement);
        }

        return lines.join("");
    }

    InputTests.testPositionWithin = function(granularity,direction) {
        return InputTests.testPositionFun(Input.isPositionWithinTextUnitInDirection,granularity,direction);
    }

    InputTests.testPositionAtBoundary = function(granularity,direction) {
        return InputTests.testPositionFun(Input.isPositionAtBoundaryGranularityInDirection,granularity,direction);
    }

    InputTests.testPositionToBoundary = function(granularity,direction) {
        var lines = new Array();
        var start = new Position.Position(document.body,0);
        var end = new Position.Position(document.body,document.body.childNodes.length);

        start = Position.closestMatchForwards(start,Position.okForMovement);
        end = Position.closestMatchBackwards(end,Position.okForMovement);

        var pos = start;
        while (pos != null) {

            var oldBefore = InputTests.textBetweenPositions(start,pos);
            var oldAfter = InputTests.textBetweenPositions(pos,end);
            var oldTotal = oldBefore+"|"+oldAfter;

            var resultId = Input.positionFromPositionToBoundaryInDirection(pos,granularity,direction);
            var result = Input.getPosition(resultId);

            var newBefore = InputTests.textBetweenPositions(start,result);
            var newAfter = InputTests.textBetweenPositions(result,end);
            var newTotal = newBefore+"|"+newAfter;

            lines.push(JSON.stringify(oldTotal)+" -- "+JSON.stringify(newTotal)+"\n");

            pos = Position.nextMatch(pos,Position.okForMovement);
        }

        return lines.join("");
    }

    InputTests.testRangeEnclosing = function(granularity,direction) {
        var lines = new Array();
        var start = new Position.Position(document.body,0);
        var end = new Position.Position(document.body,document.body.childNodes.length);

        start = Position.closestMatchForwards(start,Position.okForMovement);
        end = Position.closestMatchBackwards(end,Position.okForMovement);

        var pos = start;
        while (pos != null) {

            var oldBefore = InputTests.textBetweenPositions(start,pos);
            var oldAfter = InputTests.textBetweenPositions(pos,end);
            var oldTotal = oldBefore+"|"+oldAfter;

            var resultIds =
                Input.rangeEnclosingPositionWithGranularityInDirection(pos,granularity,direction);
            if (resultIds != null) {
                var startId = resultIds.startId;
                var endId = resultIds.endId;
                var rangeStart = Input.getPosition(startId);
                var rangeEnd = Input.getPosition(endId);

                var before = InputTests.textBetweenPositions(start,rangeStart);
                var middle = InputTests.textBetweenPositions(rangeStart,rangeEnd);
                var after = InputTests.textBetweenPositions(rangeEnd,end);

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

})(globalAPI);
