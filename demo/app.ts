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

import externalapi = require("../src/externalapi");
type PositionRef = externalapi.PositionRef;
type Granularity = externalapi.Granularity;
type Direction = externalapi.Direction;

type StartOrEnd = "start" | "end";

let api: typeof externalapi = null;

enum Key {
    Up,
    Down,
    Left,
    Right,
    Backspace
}

class SelectionState {
    dragging: boolean = false;
    dragStartPos: PositionRef = null;
    keyboardMoveFrom: StartOrEnd = null;
}

let selectionState = new SelectionState();

class AppEventReceiver {

    constructor() {
    }

    // debug?(message: any): void { }
    // error?(error: string, type?: string): void;
    addOutlineItem(itemId: string, type: string, title: string): void {
        console.log("AppEventReceiver addOutlineItem "+JSON.stringify(itemId));
    }
    updateOutlineItem(itemId: string, title: string): void {

    }
    // removeOutlineItem?(itemId: string): void;
    // outlineUpdated?(): void;
    setCursor(x: number, y: number, width: number, height: number): void {
        selectionState.keyboardMoveFrom = null;
    }
    // setSelectionHandles(x1: number, y1: number, height1: number, x2: number, y2: number, height2: number): void;
    // setTableSelection(x: number, y: number, width: number, height: number): void;
    // setSelectionBounds?(left: number, top: number, right: number, bottom: number): void;
    clearSelectionHandlesAndCursor(): void {
        selectionState.keyboardMoveFrom = null;
    }
    // updateAutoCorrect?(): void;
    // documentModified?(): void;

}

let appEventReceiver = new AppEventReceiver();


function showMouseEvent(name: string, event: MouseEvent) {
    console.log(name+" "+event.clientX+","+event.clientY);
}

function addListener(target: EventTarget, name: string, fun: (event: MouseEvent) => void) {
    target.addEventListener(name,(event: MouseEvent) => {
        event.preventDefault();
        showMouseEvent(name,event);
        fun(event);
    },true);
}

function getKeyFromEvent(event: KeyboardEvent): Key {
    switch (event.keyCode) {
        case 38: return Key.Up;
        case 40: return Key.Down;
        case 37: return Key.Left;
        case 39: return Key.Right;
        case 8: return Key.Backspace;
        default: return null;
    }
}

function isSpecialKey(key: Key): boolean {
    switch (key) {
        case Key.Up:
        case Key.Down:
        case Key.Left:
        case Key.Right:
        case Key.Backspace:
            return true;
        default:
            return false;
    }
}

function keyEventStr(event: KeyboardEvent): string {
    return ("char "+JSON.stringify(event.char)+
            ", charCode "+JSON.stringify(event.charCode)+
            ", key "+JSON.stringify(event.key)+
            ", keyCode "+JSON.stringify(event.keyCode));
}

function modifierKeysString(event: KeyboardEvent): string {
    let extra = "";
    if (event.ctrlKey)
        extra += " ctrl";
    if (event.metaKey)
        extra += " meta";
    if (event.shiftKey)
        extra += " shift";
    return extra;
}

function isForward(direction: Direction): boolean {
    return ((direction == "forward") ||
            (direction == "right") ||
            (direction == "down"));
}

function adjustSelection(event: KeyboardEvent, direction: Direction) {
    let granularity: Granularity = null;
    if (event.metaKey) {
        if ((direction == "up") || (direction == "down"))
            granularity = "document";
        else
            granularity = "line";
    }
    else if (event.ctrlKey) {
        if ((direction == "up") || (direction == "down"))
            granularity = "paragraph";
        else
            granularity = "word";
    }
    else {
        granularity = "character";
    }

    let moveFrom: StartOrEnd = isForward(direction) ? "end" : "start";
    if (event.shiftKey) {
        if (selectionState.keyboardMoveFrom != null)
            moveFrom = selectionState.keyboardMoveFrom;
        else
            selectionState.keyboardMoveFrom = moveFrom;
    }

    let fromPos = (moveFrom == "start") ? api.input.selectionStartAnchor() : api.input.selectionEndAnchor();

    let count = 1;
    if (((granularity == "word") || (granularity == "paragraph")) &&
        !api.input.isPositionWithinTextUnit(fromPos,granularity,direction))
        count = 2;

    let toPos = fromPos;
    for (let i = 0; i < count; i++)
        toPos = api.input.positionToBoundary(toPos,granularity,direction);

    if (event.shiftKey) {
        if (selectionState.keyboardMoveFrom == "start")
            api.input.setSelectedTextRange(toPos,api.input.selectionEndAnchor());
        else
            api.input.setSelectedTextRange(api.input.selectionStartAnchor(),toPos);
    }
    else {
        api.input.setSelectedTextRange(toPos,toPos);
    }
}

function setupEditor(iframe: HTMLIFrameElement) {

    iframe.contentWindow.addEventListener("mousedown",(event) => {
        event.preventDefault();
        let pos = api.input.closestPositionToPoint(event.clientX,event.clientY);
        if (pos != null) {
            api.input.setSelectedTextRange(pos,pos);
            selectionState.dragging = true;
            selectionState.dragStartPos = pos;
        }
    });

    iframe.contentWindow.addEventListener("mouseup",(event) => {
        event.preventDefault();
        selectionState.dragging = false;
        selectionState.dragStartPos = null;
    });

    iframe.contentWindow.addEventListener("mousemove",(event) => {
        event.preventDefault();
        if (selectionState.dragging) {
            let pos = api.input.closestPositionToPoint(event.clientX,event.clientY);
            if (pos != null) {
                api.input.setSelectedTextRange(selectionState.dragStartPos,pos);
            }
        }
    });

    document.addEventListener("keydown",(event: KeyboardEvent) => {
        let key = getKeyFromEvent(event);
        switch (key) {
            case Key.Up: {
                adjustSelection(event,"up");
                event.preventDefault();
                break;
            }
            case Key.Down: {
                adjustSelection(event,"down");
                event.preventDefault();
                break;
            }
            case Key.Left: {
                adjustSelection(event,"left");
                event.preventDefault();
                break;
            }
            case Key.Right: {
                adjustSelection(event,"right");
                event.preventDefault();
                break;
            }
            case Key.Backspace: {
                api.cursor.deleteCharacter();
                event.preventDefault();
                break;
            }
            // default:
            //     console.log("Unknown key down ",event.char,event.charCode,event.keyCode);
        }
    });

    document.addEventListener("keypress",(event: KeyboardEvent) => {
        // console.log("keypress: "+keyEventStr(event));
        if (isSpecialKey(getKeyFromEvent(event)))
            return;
        let str: string = null;
        if ((event.charCode != null) && (event.charCode != 0))
            str = String.fromCharCode(event.charCode);
        if (str != null) {
            let extra = modifierKeysString(event);
            if ((str == "\r") || (str == "\n")) {
                api.cursor.enterPressed();
            }
            else if ((str == "b") && (event.metaKey)) {
                let fmt = api.formatting.getFormatting();
                console.log(fmt);
                if (fmt["font-weight"] !== "bold")
                    api.formatting.applyFormattingChanges(null,{"font-weight": "bold"});
                else
                    api.formatting.applyFormattingChanges(null,{"font-weight": null});
            }
            else if ((str == "i") && (event.metaKey)) {
                let fmt = api.formatting.getFormatting();
                console.log(fmt);
                if (fmt["font-style"] !== "italic")
                    api.formatting.applyFormattingChanges(null,{"font-style": "italic"});
                else
                    api.formatting.applyFormattingChanges(null,{"font-style": null});
            }
            else {
                api.cursor.insertCharacter(str,true);
            }
            event.preventDefault();
        }
    });
}

function injectRequireJS(iframe: HTMLIFrameElement, main: string, onLoad: () => void) {
    var requireScript = iframe.contentDocument.createElement("script");
    requireScript.src = "require.js";
    requireScript.setAttribute("data-main","../build/demo/app");
    requireScript.addEventListener("load",onLoad);
    iframe.contentDocument.body.appendChild(requireScript);
}

export function init() {
    let iframe = document.createElement("iframe");
    let content = document.getElementById("content");

    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.src = "content.html";
    iframe.addEventListener("load",(event) => {
        console.log("iframe loaded");
        injectRequireJS(iframe,"../build/demo/app",() => {
            console.log("require.js loaded in iframe context");
            let w: any = iframe.contentWindow;
            w.require(["../src/externalapi"],function(apiObject: typeof externalapi) {
                console.log("externalapi module loaded in iframe context");
                api = apiObject;
                api.events.setReceiver(appEventReceiver);
                setupEditor(iframe);
                api.main.init(768,100,"../tests/generic.css");
                console.log("initialization complete");
            });
        });
    });
    content.appendChild(iframe);
}
