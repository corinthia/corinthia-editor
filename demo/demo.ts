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

import api = require("../src/externalapi");

class Action {
    constructor(public delay: number, public fun: () => void) { }
}

let actions: Action[] = [];
let actionIndex = 0;

function runNextAction() {
    if (actionIndex >= actions.length)
        return;

    let action = actions[actionIndex++];
    window.setTimeout(() => {
        try {
            action.fun();
        }
        catch (e) {
            console.log(e);
        }
        runNextAction();
    },action.delay);
}

function run(delay: number, fun: () => void) {
    actions.push(new Action(delay,fun));
}

function runInsertString(delay: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        run(delay,() => api.cursor.insertCharacter(str[i],true));
    }
}

function runInsertParagraph(delay: number, str: string) {
    runInsertString(delay,str);
    run(delay,() => api.cursor.enterPressed());
}

function wait(delay: number) {
    run(delay,() => null);
}

export function start(): void {
    api.main.init(768,100,null);
    run(100,() => api.selection.selectAll());
    run(500,() => api.cursor.deleteCharacter());
    runInsertParagraph(25,"Welcome!");
    wait(1000);
    runInsertParagraph(25,"This is a demo of the Corinthia editor library.");
    wait(1000);
    runInsertParagraph(25,"You can do some pretty cool stuff with it.");
    wait(1000);
    run(0,() => {
        for (let i = 0; i < "pretty cool stuff with it.".length+1; i++)
            api.cursor.moveLeft();
    });
    for (let i = 0; i < "pretty cool stuff".length; i++)
        run(25,() => api.selection.moveEndRight());
    run(250,() => api.formatting.applyFormattingChanges(null,{"font-weight": "bold"}));
    run(250,() => api.formatting.applyFormattingChanges(null,{"font-style": "italic"}));
    run(250,() => api.formatting.applyFormattingChanges(null,{"text-decoration": "underline"}));
    run(250,() => api.formatting.applyFormattingChanges(null,{"color": "red"}));
    run(250,() => api.formatting.applyFormattingChanges(null,{"padding": "8px"}));
    run(250,() => api.formatting.applyFormattingChanges(null,{"background-color": "#FFFFC0"}));
    run(100,() => api.formatting.applyFormattingChanges(null,{"border-top": "4px solid red"}));
    run(100,() => api.formatting.applyFormattingChanges(null,{"border-right": "4px solid red"}));
    run(100,() => api.formatting.applyFormattingChanges(null,{"border-bottom": "4px solid red"}));
    run(100,() => api.formatting.applyFormattingChanges(null,{"border-left": "4px solid red"}));
    run(100,() => { api.cursor.moveRight(); api.cursor.moveLeft(); });
    run(1000,() => api.formatting.applyFormattingChanges(null,{"text-align": "center"}));

    run(1000,() => api.cursor.moveToEndOfDocument());
    runInsertParagraph(25,"Let's insert a table.");
    run(1000,() => api.tables.insertTable(4,4,"40%",false,null,null));
    run(0,() => api.cursor.moveToEndOfDocument());
    wait(1000);
    run(0,() => api.cursor.enterPressed());
    runInsertString(25,"Cool.");
    wait(1000);
    runInsertParagraph(25," We should probably put some text in the cells.");
    run(1000,() => api.cursor.insertCharacter("[TO BE CONTINUED]",true));

    runNextAction();
}

// Exposing the start function as a global variable is only necessary for the version of the
// demo HTML file that does uses our own module loader, rather than require.js, since the former
// does not presently have a require() function that callable from scripts within HTML files.
let w: any = window;
w.startDemo = start;
