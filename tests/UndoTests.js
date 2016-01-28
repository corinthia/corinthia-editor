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

    var UndoTests = api.tests.UndoTests; // export

    var AutoCorrect = api.AutoCorrect; // import
    var DOM = api.DOM; // import
    var Outline = api.Outline; // import
    var PostponedActions = api.PostponedActions; // import
    var Selection = api.Selection; // import
    var UndoManager = api.UndoManager; // import

    UndoTests.testUndo = function(versions,node) {
        var numSteps = UndoManager.getLength();

        var back1 = new Array();
        var forwards2 = new Array();
        var back2 = new Array();

        var expected = new Array();
        for (var i = 0; i < versions.length; i++)
            expected.push(PrettyPrinter.getHTML(versions[i]));

        for (var i = 0; i < numSteps; i++) {
            UndoManager.undo();
            PostponedActions.perform();
            var version = versions.length-2-i;
            if (PrettyPrinter.getHTML(node) == expected[version])
                back1.push(DOM.createTextNode(document,"First undo to version "+version+": OK"));
            else
                back1.push(DOM.createTextNode(document,"First undo to version "+version+": INVALID"));
        }

        for (var i = 0; i < numSteps; i++) {
            UndoManager.redo();
            PostponedActions.perform();
            var version = i+1;
            if (PrettyPrinter.getHTML(node) == expected[version])
                forwards2.push(DOM.createTextNode(document,"Redo to version "+version+": OK"));
            else
                forwards2.push(DOM.createTextNode(document,"Redo to version "+version+": INVALID"));
        }

        for (var i = 0; i < numSteps; i++) {
            UndoManager.undo();
            PostponedActions.perform();
            var version = versions.length-2-i;
            if (PrettyPrinter.getHTML(node) == expected[version])
                back2.push(DOM.createTextNode(document,"Second undo to version "+version+": OK"));
            else
                back2.push(DOM.createTextNode(document,"Second undo to version "+version+": INVALID"));
        }

        var initialLength = versions.length;

        Array.prototype.push.apply(versions,back1);
        Array.prototype.push.apply(versions,forwards2);
        Array.prototype.push.apply(versions,back2);

        Outline.removeListeners(); // prevent it from adding number spans etc.
        AutoCorrect.removeListeners();
        DOM.deleteAllChildren(document.body);
        for (var i = 0; i < versions.length; i++) {
            if (i < initialLength) {
                var str = "==================== Version "+i+" ====================";
                DOM.appendChild(document.body,DOM.createTextNode(document,str));
            }
            else if (i == initialLength) {
                var str = "===================================================";
                DOM.appendChild(document.body,DOM.createTextNode(document,str));
            }
            DOM.appendChild(document.body,versions[i]);
        }
    }

    UndoTests.placeCursorAfterElement = function(id) {
        UndoManager.disableWhileExecuting(function() {
            var element = document.getElementById(id);
            var node = element.parentNode;
            var offset = DOM.nodeOffset(element)+1;
            Selection.set(node,offset,node,offset);
        });
    }

})(globalAPI);
