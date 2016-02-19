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
import ElementTypes = require("../src/elementTypes");
import Position = require("../src/position");
import Range = require("../src/range");
import Selection = require("../src/selection");
import Types = require("../src/types");
import Util = require("../src/util");

function oldInsertCharacter(character: string): void {
    let selectionRange = Selection.get();
    if (selectionRange == null)
        return;

    if (!Range.isEmpty(selectionRange))
        Selection.deleteContents();
    let pos = selectionRange.start;
    let node = pos.node;
    let offset = pos.offset;

    let textNode: Text = null;

    if (node instanceof Text) {
        textNode = <Text>node; // FIXME: TS: Compiler should allow this due to type guard
    }
    else {
        let prev = node.childNodes[offset-1];
        let next = node.childNodes[offset];
        textNode = DOM.createTextNode(document,"");
        if (offset >= node.childNodes.length)
            DOM.appendChild(node,textNode);
        else
            DOM.insertBefore(node,textNode,node.childNodes[offset]);
        node = textNode;
        offset = 0;
    }

    DOM.insertCharacters(textNode,offset,character);
    Selection.set(textNode,offset+1,textNode,offset+1);
}

export function showValidPositions(): void {
    let validPositions = new Array();
    let pos = new Position.Position(document.body,0);
    while (pos != null) {
        if (Position.okForMovement(pos)) {
//            Callbacks.debug("Valid position: "+pos);
            validPositions.push(pos);
        }
        pos = Position.next(pos);
    }

    Position.trackWhileExecuting(validPositions,function() {
//        for (let i = 0; i < validPositions.length; i++) {
        for (let i = validPositions.length-1; i >= 0; i--) {
            let pos = validPositions[i];
            Selection.setEmptySelectionAt(pos.node,pos.offset);
            oldInsertCharacter('.');
        }
    });
}

function flattenTreeToString(node: Node): string {
    let result = new Array();
    recurse(node);
    return result.join("").replace(/\n/g," ");

    function recurse(node: Node): void {
        switch (node._type) {
        case ElementTypes.HTML_TEXT:
            result.push(node.nodeValue);
            break;
        case ElementTypes.HTML_IMG:
            result.push("I");
            break;
        default:
            if (Types.isOpaqueNode(node)) {
                result.push("O");
            }
            else if (node instanceof Element) {
                for (let child = node.firstChild; child != null; child = child.nextSibling) {
                    recurse(child);
                }
            }
            break;
        }
    }
}

function findCursorPositionErrors(text: string): string {
    let detail = "";
    for (let i = 0; i < text.length; i++) {
        let prevChar = (i > 0) ? text.charAt(i-1) : null;
        let nextChar = (i < text.length-1) ? text.charAt(i+1) : null;
        let curChar = text.charAt(i);

        if (curChar == '.') {
            if ((prevChar == '.') || (nextChar == '.')) {
                // Two positions not separated by a space or character
                detail += "^";
            }
            else if ((prevChar != null) && (nextChar != null) &&
                     Util.isWhitespaceString(prevChar) && Util.isWhitespaceString(nextChar)) {
                // A position between two spaces
                detail += "^";
            }
            else {
                // OK
                detail += " ";
            }
        }
        else if (!Util.isWhitespaceString(curChar)) {
            if ((prevChar != '.') || (nextChar != '.'))
                detail += "^";
            else
                detail += " ";
        }
    }
    return detail;
}

function checkCursorPositions(node: Node): string {
    let text = flattenTreeToString(document.body);
    let detail = findCursorPositionErrors(text);
    return text+"\n"+detail;
}

export function addEmptyTextNode(parent: Node): void {
    let text = DOM.createTextNode(document,"");
    DOM.appendChild(parent,text);
}
