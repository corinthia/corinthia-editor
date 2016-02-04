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

function oldInsertCharacter(character) {
    var selectionRange = Selection.get();
    if (selectionRange == null)
        return;

    if (!Range.isEmpty(selectionRange))
        Selection.deleteContents();
    var pos = selectionRange.start;
    var node = pos.node;
    var offset = pos.offset;

    if (node.nodeType == Node.ELEMENT_NODE) {
        var prev = node.childNodes[offset-1];
        var next = node.childNodes[offset];
        var emptyTextNode = DOM.createTextNode(document,"");
        if (offset >= node.childNodes.length)
            DOM.appendChild(node,emptyTextNode);
        else
            DOM.insertBefore(node,emptyTextNode,node.childNodes[offset]);
        node = emptyTextNode;
        offset = 0;
    }

    DOM.insertCharacters(node,offset,character);
    Selection.set(node,offset+1,node,offset+1);
}

export function showValidPositions() {
    var validPositions = new Array();
    var pos = new Position.Position(document.body,0);
    while (pos != null) {
        if (Position.okForMovement(pos)) {
//            Util.debug("Valid position: "+pos);
            validPositions.push(pos);
        }
        pos = Position.next(pos);
    }

    Position.trackWhileExecuting(validPositions,function() {
//        for (var i = 0; i < validPositions.length; i++) {
        for (var i = validPositions.length-1; i >= 0; i--) {
            var pos = validPositions[i];
            Selection.setEmptySelectionAt(pos.node,pos.offset);
            oldInsertCharacter('.');
        }
    });
}

function flattenTreeToString(node) {
    var result = new Array();
    recurse(node);
    return result.join("").replace(/\n/g," ");

    function recurse(node) {
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
            else if (node.nodeType == Node.ELEMENT_NODE) {
                for (var child = node.firstChild; child != null; child = child.nextSibling) {
                    recurse(child);
                }
            }
            break;
        }
    }
}

function findCursorPositionErrors(text) {
    var detail = "";
    for (var i = 0; i < text.length; i++) {
        var prevChar = (i > 0) ? text.charAt(i-1) : null;
        var nextChar = (i < text.length-1) ? text.charAt(i+1) : null;
        var curChar = text.charAt(i);

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

function checkCursorPositions(node) {
    var text = flattenTreeToString(document.body);
    var detail = findCursorPositionErrors(text);
    return text+"\n"+detail;
}

export function addEmptyTextNode(parent) {
    var text = DOM.createTextNode(document,"");
    DOM.appendChild(parent,text);
}
