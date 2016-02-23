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

import Paragraph = require("../src/paragraph");
import Position = require("../src/position");
import Selection = require("../src/selection");
import Txt = require("../src/text");
import UndoManager = require("../src/undo");

function pad(str: string, length: number): string {
    str = ""+str;
    while (str.length < length)
        str += " ";
    return str;
}

function selectRange(p: Node, start: number, end: number): void {
    let paragraph = Txt.analyseParagraph(new Position(p,0));
    let startPos = Paragraph.positionAtOffset(paragraph,start);
    let endPos = Paragraph.positionAtOffset(paragraph,end);
    Selection.set(startPos.node,startPos.offset,endPos.node,endPos.offset);
}

function makeStringArray(input: any[]): string[] {
    let result: string[] = [];
    for (let i = 0; i < input.length; i++)
        result.push(input[i].toString());
    return result;
}

function createTable(arrays: string[][]): string {
    let maxLength = 0;
    for (let col = 0; col < arrays.length; col++) {
        if (maxLength < arrays[col].length)
            maxLength = arrays[col].length;
    }
    let colWidths = new Array();
    for (let col = 0; col < arrays.length; col++) {
        let width = 0;
        for (let row = 0; row < arrays[col].length; row++) {
            if (width < arrays[col][row].length)
                width = arrays[col][row].length;
        }
        colWidths.push(width);
    }

    let output = new Array();
    let spacer = "   ->   ";
    for (let row = 0; row < maxLength; row++) {
        for (let col = 0; col < arrays.length; col++) {
            if (col > 0)
                output.push(spacer);
            output.push(pad(arrays[col][row],colWidths[col]));
        }
        output.push("\n");
    }
    return output.join("");
}

function rangeString(text: string, start: number, end: number): string {
    return JSON.stringify(text.substring(0,start) + "[" +
                          text.substring(start,end) + "]" +
                          text.substring(end));
}

let positionList: Position[] = null

function setPositionList(newList: Position[]): void {
    UndoManager.addAction(setPositionList,positionList);
    if (newList == null)
        positionList = null;
    else
        positionList = newList.map(function (pos) { return new Position(pos.node,pos.offset); });
}

function getPositionList(): Position[] {
    return positionList;
}

export function positionTest(start1: number, end1: number, start2: number, end2: number): string {
    let ps = document.getElementsByTagName("P");

    let p = ps[0];
    let text = <Text>p.firstChild;

    let testDescription = "From "+rangeString(text.nodeValue,start1,end1) + "\n" +
                          "To   "+rangeString(text.nodeValue,start2,end2) + "\n";

    let positions = new Array();
    for (let i = 0; i <= text.length; i++)
        positions.push(new Position(text,i));
    setPositionList(positions);

    let origStrings = makeStringArray(positions);
    UndoManager.newGroup();

    Position.trackWhileExecuting(positions,function() { selectRange(p,start1,end1); });
    setPositionList(positions);
    let strings1 = makeStringArray(positions);

    UndoManager.newGroup();

    Position.trackWhileExecuting(positions,function() { selectRange(p,start2,end2); });
    setPositionList(positions);
    let strings2 = makeStringArray(positions);

    UndoManager.undo();
    positions = getPositionList();
    let undo1 = makeStringArray(positions);

    UndoManager.undo();
    positions = getPositionList();
    let undo2 = makeStringArray(positions);

    let checks = new Array();
    for (let i = 0; i < positions.length; i++) {
        let str = "";
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
