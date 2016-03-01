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

import DOM = require("../src/dom");
import Input = require("../src/input");
import Outline = require("../src/outline");
import Position = require("../src/position");
import PostponedActions = require("../src/postponedActions");
import Range = require("../src/range");
import Selection = require("../src/selection");
import TestLib = require("./testlib");
import Traversal = require("../src/traversal");

// We only import the externalapi module to get access to the type definitions it contains.
// The external API functions are *not* intended for use by internal modules.
import ExternallyVisibleTypes = require("../src/externalapi");
export type Granularity = ExternallyVisibleTypes.Granularity;
export type Direction = ExternallyVisibleTypes.Direction;

export function getNodeArrayText(nodes: Node[]): string {
    let strings = new Array();
    for (let i = 0; i < nodes.length; i++)
        strings.push(Traversal.getNodeText(nodes[i]));
    return strings.join("");
}

export function textBetweenPositions(from: Position, to: Position): string {
    let range = new Range(from.node,from.offset,to.node,to.offset);
    let contents = DOM.cloneRangeContents(range);
    return getNodeArrayText(contents);
}

export function testMovement(direction: Direction, count: number): void {
    Outline.init();
    PostponedActions.perform();
    let posId = Input.addPosition(Selection.get().start);
    for (let i = 0; i < count; i++)
        posId = Input.positionRelativeTo(posId,direction,1);
    Input.setSelectedTextRange(posId,posId);
    TestLib.showSelection();
}

export function testPositionFun(fun: (p: number, g: string, d: string) => boolean,
                                granularity: string, direction: string): string {
    let lines = new Array();
    let start = new Position(document.body,0);
    let end = new Position(document.body,document.body.childNodes.length);

    start = Position.closestMatchForwards(start,Position.okForMovement);
    end = Position.closestMatchBackwards(end,Position.okForMovement);

    let pos = start;
    while (pos != null) {

        let before = textBetweenPositions(start,pos);
        let after = textBetweenPositions(pos,end);
        let total = before+"|"+after;

        let posId = Input.addPosition(pos);
        let result = fun(posId,granularity,direction);
        lines.push(JSON.stringify(total)+" -- "+result+"\n");

        pos = pos.nextMatch(Position.okForMovement);
    }

    return lines.join("");
}

export function testPositionWithin(granularity: string, direction: string): string {
    return testPositionFun(Input.isPositionWithinTextUnit,granularity,direction);
}

export function testPositionAtBoundary(granularity: string, direction: string): string {
    return testPositionFun(Input.isPositionAtBoundary,granularity,direction);
}

export function testPositionToBoundary(granularity: Granularity, direction: Direction): string {
    let lines = new Array();
    let start = new Position(document.body,0);
    let end = new Position(document.body,document.body.childNodes.length);

    start = Position.closestMatchForwards(start,Position.okForMovement);
    end = Position.closestMatchBackwards(end,Position.okForMovement);

    let pos = start;
    while (pos != null) {

        let oldBefore = textBetweenPositions(start,pos);
        let oldAfter = textBetweenPositions(pos,end);
        let oldTotal = oldBefore+"|"+oldAfter;

        let posId = Input.addPosition(pos);
        let resultId = Input.positionToBoundary(posId,granularity,direction);
        let result = Input.getPosition(resultId);

        let newBefore = textBetweenPositions(start,result);
        let newAfter = textBetweenPositions(result,end);
        let newTotal = newBefore+"|"+newAfter;

        lines.push(JSON.stringify(oldTotal)+" -- "+JSON.stringify(newTotal)+"\n");

        pos = pos.nextMatch(Position.okForMovement);
    }

    return lines.join("");
}

export function testRangeEnclosing(granularity: Granularity, direction: Direction): string {
    let lines = new Array();
    let start = new Position(document.body,0);
    let end = new Position(document.body,document.body.childNodes.length);

    start = Position.closestMatchForwards(start,Position.okForMovement);
    end = Position.closestMatchBackwards(end,Position.okForMovement);

    let pos = start;
    while (pos != null) {

        let oldBefore = textBetweenPositions(start,pos);
        let oldAfter = textBetweenPositions(pos,end);
        let oldTotal = oldBefore+"|"+oldAfter;

        let posId = Input.addPosition(pos);
        let resultIds = Input.rangeEnclosingPosition(posId,granularity,direction);
        if (resultIds != null) {
            let startId = resultIds.startId;
            let endId = resultIds.endId;
            let rangeStart = Input.getPosition(startId);
            let rangeEnd = Input.getPosition(endId);

            let before = textBetweenPositions(start,rangeStart);
            let middle = textBetweenPositions(rangeStart,rangeEnd);
            let after = textBetweenPositions(rangeEnd,end);

            let newTotal = before+"["+middle+"]"+after;

            lines.push(JSON.stringify(oldTotal)+" -- "+JSON.stringify(newTotal)+"\n");
        }
        else {
            lines.push(JSON.stringify(oldTotal)+" -- null\n");
        }

        pos = pos.nextMatch(Position.okForMovement);
    }

    return lines.join("");
}
