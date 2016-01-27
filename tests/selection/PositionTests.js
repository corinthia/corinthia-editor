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

    var PositionTests = api.tests.PositionTests = {}; // export

    var Paragraph = api.Paragraph; // import
    var Position = api.Position; // import
    var Selection = api.Selection; // import
    var Text = api.Text; // import
    var UndoManager = api.UndoManager; // import

    function pad(str,length) {
        str = ""+str;
        while (str.length < length)
            str += " ";
        return str;
    }

    function selectRange(p,start,end) {
        var paragraph = Text.analyseParagraph(new Position.Position(p,0));
        var startPos = Paragraph.positionAtOffset(paragraph,start);
        var endPos = Paragraph.positionAtOffset(paragraph,end);
        Selection.set(startPos.node,startPos.offset,endPos.node,endPos.offset);
    }

    function makeStringArray(input) {
        var result = new Array();
        for (var i = 0; i < input.length; i++)
            result.push(input[i].toString());
        return result;
    }

    function createTable(arrays) {
        var maxLength = 0;
        for (var col = 0; col < arrays.length; col++) {
            if (maxLength < arrays[col].length)
                maxLength = arrays[col].length;
        }
        var colWidths = new Array();
        for (var col = 0; col < arrays.length; col++) {
            var width = 0;
            for (var row = 0; row < arrays[col].length; row++) {
                if (width < arrays[col][row].length)
                    width = arrays[col][row].length;
            }
            colWidths.push(width);
        }

        var output = new Array();
        var spacer = "   ->   ";
        for (var row = 0; row < maxLength; row++) {
            for (var col = 0; col < arrays.length; col++) {
                if (col > 0)
                    output.push(spacer);
                output.push(pad(arrays[col][row],colWidths[col]));
            }
            output.push("\n");
        }
        return output.join("");
    }

    function rangeString(text,start,end) {
        return JSON.stringify(text.substring(0,start) + "[" +
                              text.substring(start,end) + "]" +
                              text.substring(end));
    }

    var positionList = null

    function setPositionList(newList) {
        UndoManager.addAction(setPositionList,positionList);
        if (newList == null)
            positionList = null;
        else
            positionList = newList.map(function (pos) { return new Position.Position(pos.node,pos.offset); });
    }

    function getPositionList() {
        return positionList;
    }

    PositionTests.positionTest = function(start1,end1,start2,end2) {
        var ps = document.getElementsByTagName("P");

        var p = ps[0];
        var text = p.firstChild;

        var testDescription = "From "+rangeString(text.nodeValue,start1,end1) + "\n" +
                              "To   "+rangeString(text.nodeValue,start2,end2) + "\n";

        var positions = new Array();
        for (var i = 0; i <= text.length; i++)
            positions.push(new Position.Position(text,i));
        setPositionList(positions);

        var origStrings = makeStringArray(positions);
        UndoManager.newGroup();

        Position.trackWhileExecuting(positions,function() { selectRange(p,start1,end1); });
        setPositionList(positions);
        var strings1 = makeStringArray(positions);

        UndoManager.newGroup();

        Position.trackWhileExecuting(positions,function() { selectRange(p,start2,end2); });
        setPositionList(positions);
        var strings2 = makeStringArray(positions);

        UndoManager.undo();
        positions = getPositionList();
        var undo1 = makeStringArray(positions);

        UndoManager.undo();
        positions = getPositionList();
        var undo2 = makeStringArray(positions);

        var checks = new Array();
        for (var i = 0; i < positions.length; i++) {
            var str = "";
            if (undo1[i] == strings1[i])
                str += "YES";
            else
                str += "NO";

            if (undo2[i] == origStrings[i])
                str += "/YES";
            else
                str += "/NO";
            checks.push(str);
        }

        return testDescription + "\n" + createTable([origStrings,strings1,strings2,checks]);
    }

})(globalAPI);
