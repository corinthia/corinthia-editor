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

interface ShowdownConverter {
    new (): any;
}

declare let Showdown: {
    converter: ShowdownConverter;
}

// https://developer.mozilla.org/en-US/docs/Web/API/CaretPosition
interface CaretPosition {
    offsetNode: Node;
    offset: number;
}

interface Document {
    // Firefox
    caretPositionFromPoint(x: number, y: number): CaretPosition;
    // WebKit/Blink/Edge
    caretRangeFromPoint(x: number, y: number): Range;
}

interface Node {
    _nodeId?: number;
    _type?: number;
    _trackedPositions: any[];
}
