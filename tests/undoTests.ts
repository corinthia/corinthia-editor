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

import AutoCorrect = require("../src/autoCorrect");
import DOM = require("../src/dom");
import Outline = require("../src/outline");
import PostponedActions = require("../src/postponedActions");
import PrettyPrinter = require("./prettyPrinter");
import Selection = require("../src/selection");
import UndoManager = require("../src/undo");

export function testUndo(versions: Node[], node: Node): void {
    let numSteps = UndoManager.getLength();

    let back1 = new Array();
    let forwards2 = new Array();
    let back2 = new Array();

    let expected = new Array();
    for (let i = 0; i < versions.length; i++)
        expected.push(PrettyPrinter.getHTML(versions[i]));

    for (let i = 0; i < numSteps; i++) {
        UndoManager.undo();
        PostponedActions.perform();
        let version = versions.length-2-i;
        if (PrettyPrinter.getHTML(node) == expected[version])
            back1.push(DOM.createTextNode(document,"First undo to version "+version+": OK"));
        else
            back1.push(DOM.createTextNode(document,"First undo to version "+version+": INVALID"));
    }

    for (let i = 0; i < numSteps; i++) {
        UndoManager.redo();
        PostponedActions.perform();
        let version = i+1;
        if (PrettyPrinter.getHTML(node) == expected[version])
            forwards2.push(DOM.createTextNode(document,"Redo to version "+version+": OK"));
        else
            forwards2.push(DOM.createTextNode(document,"Redo to version "+version+": INVALID"));
    }

    for (let i = 0; i < numSteps; i++) {
        UndoManager.undo();
        PostponedActions.perform();
        let version = versions.length-2-i;
        if (PrettyPrinter.getHTML(node) == expected[version])
            back2.push(DOM.createTextNode(document,"Second undo to version "+version+": OK"));
        else
            back2.push(DOM.createTextNode(document,"Second undo to version "+version+": INVALID"));
    }

    let initialLength = versions.length;

    Array.prototype.push.apply(versions,back1);
    Array.prototype.push.apply(versions,forwards2);
    Array.prototype.push.apply(versions,back2);

    Outline.removeListeners(); // prevent it from adding number spans etc.
    AutoCorrect.removeListeners();
    DOM.deleteAllChildren(document.body);
    for (let i = 0; i < versions.length; i++) {
        if (i < initialLength) {
            let str = "==================== Version "+i+" ====================";
            DOM.appendChild(document.body,DOM.createTextNode(document,str));
        }
        else if (i == initialLength) {
            let str = "===================================================";
            DOM.appendChild(document.body,DOM.createTextNode(document,str));
        }
        DOM.appendChild(document.body,versions[i]);
    }
}

export function placeCursorAfterElement(id: string): void {
    UndoManager.disableWhileExecuting(function() {
        let element = document.getElementById(id);
        let node = element.parentNode;
        let offset = DOM.nodeOffset(element)+1;
        Selection.set(node,offset,node,offset);
    });
}
