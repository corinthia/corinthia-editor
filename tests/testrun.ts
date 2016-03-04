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
import Callbacks = require("../src/callbacks");
import ChangeTracking = require("../src/changeTracking");
import Clipboard = require("../src/clipboard");
import Cursor = require("../src/cursor");
import DOM = require("../src/dom");
import Figures = require("../src/figures");
import Formatting = require("../src/formatting");
import Hierarchy = require("../src/hierarchy");
import Input = require("../src/input");
import InputRef = require("../src/inputref");
import Lists = require("../src/lists");
import Main = require("../src/main");
import Outline = require("../src/outline");
import Position = require("../src/position");
import PostponedActions = require("../src/postponedActions");
import Range = require("../src/range");
import Scan = require("../src/scan");
import Selection = require("../src/selection");
import Styles = require("../src/styles");
import Tables = require("../src/tables");
import Traversal = require("../src/traversal");
import UndoManager = require("../src/undo");
import Util = require("../src/util");

import AutoCorrectTests = require("./autoCorrectTests");
import FiguresTests = require("./figuresTests");
import InputTests = require("./inputTests");
import OutlineTests = require("./outlineTests");
import PositionTests = require("./positionTests");
import PrettyPrinter = require("./prettyPrinter");
import RangeTests = require("./rangeTests");
import ScanTests = require("./scanTests");
import TableTests = require("./tableTests");
import TestLib = require("./testlib");
import TextTests = require("./textTests");
import UndoTests = require("./undoTests");
import ValidPositions = require("./validPositions");

function run() {
    let api = {
        AutoCorrect: AutoCorrect,
        Callbacks: Callbacks,
        ChangeTracking: ChangeTracking,
        Clipboard: Clipboard,
        Cursor: Cursor,
        DOM: DOM,
        Figures: Figures,
        Formatting: Formatting,
        Hierarchy: Hierarchy,
        Input: Input,
        InputRef: InputRef,
        Lists: Lists,
        Main: Main,
        Outline: Outline,
        Position: Position,
        PostponedActions: PostponedActions,
        Range: Range,
        Scan: Scan,
        Selection: Selection,
        Styles: Styles,
        Tables: Tables,
        Traversal: Traversal,
        UndoManager: UndoManager,
        Util: Util,
        tests: {
            AutoCorrectTests: AutoCorrectTests,
            FiguresTests: FiguresTests,
            InputTests: InputTests,
            OutlineTests: OutlineTests,
            PositionTests: PositionTests,
            PrettyPrinter: PrettyPrinter,
            RangeTests: RangeTests,
            ScanTests: ScanTests,
            TableTests: TableTests,
            TestLib: TestLib,
            TextTests: TextTests,
            UndoTests: UndoTests,
            ValidPositions: ValidPositions
        }
    };
    let w: any = window;

    Callbacks.debug = function(str: any) { console.log(str); };
    TestLib.testHarnessSetup();

    w.outputOptions = new Object();
    w.disableOutlineRedoHack = true;
    let resultText = w.performTest(api);
    if (!w.outputOptions.keepSelectionHighlights)
        Selection.clearSelection();
    if (resultText == null)
        resultText = PrettyPrinter.getHTML(document.documentElement,w.outputOptions)
    let messages = JSON.parse(Callbacks.getBackMessages());
    for (let i = 0; i < messages.length; i++) {
        let message = messages[i];
        if (message[0] == "error")
            throw new Error(message[1]);
    }

    return resultText;
}

// Expose the above function as a property of the global object, so it can be called by
// the test harness
(<any>window).run = run;
