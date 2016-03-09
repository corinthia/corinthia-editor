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

import Events = require("./events")
import Util = require("./util");

let UNDO_LIMIT = 50;

class UndoGroup {

    public type: string;
    public onClose: () => void;
    public actions: UndoAction[];

    constructor(type: string, onClose: () => void) {
        this.type = type;
        this.onClose = onClose;
        this.actions = [];
    }

}

class UndoAction {

    public fun: Function;
    public args: any[];

    constructor(fun: Function, args: any[]) {
        this.fun = fun;
        this.args = args;
    }

    public toString(): string {
        let argStrings = new Array();
        for (let i = 0; i < this.args.length; i++) {
            if (this.args[i] instanceof Node)
                argStrings.push(Util.nodeString(this.args[i]));
            else if (this.args[i] == null)
                argStrings.push("null");
            else
                argStrings.push(this.args[i].toString());
        }

        return name + "(" + argStrings.join(",") + ")";
    }
}

let undoStack: UndoGroup[] = [];
let redoStack: UndoGroup[] = [];
let inUndo = false;
let inRedo = false;
let currentGroup: UndoGroup = null;
let disabled = 0;

// public
export function getLength(): number {
    return undoStack.length + redoStack.length;
}

// public
export function getIndex(): number {
    return undoStack.length;
}

// public
export function setIndex(index: number): void {
    while (undoStack.length > index)
        undo();
    while (undoStack.length < index)
        redo();
}

// public
export function print(): void {
    Events.debug("");
    Events.debug("--------------------------------------------------------------------");
    Events.debug("Undo stack:");
    for (let groupIndex = 0; groupIndex < undoStack.length; groupIndex++) {
        let group = undoStack[groupIndex];
        Events.debug("    "+group.type);
        for (let actionIndex = 0; actionIndex < group.actions.length; actionIndex++) {
            let action = group.actions[actionIndex];
            Events.debug("        "+action);
        }
    }
    Events.debug("Redo stack:");
    for (let groupIndex = 0; groupIndex < redoStack.length; groupIndex++) {
        let group = redoStack[groupIndex];
        Events.debug("    "+group.type);
        for (let actionIndex = 0; actionIndex < group.actions.length; actionIndex++) {
            let action = group.actions[actionIndex];
            Events.debug("        "+action);
        }
    }
    Events.debug("Current group = "+currentGroup);
    Events.debug("--------------------------------------------------------------------");
    Events.debug("");
}

function closeCurrentGroup(): void {
    if ((currentGroup != null) && (currentGroup.onClose != null))
        currentGroup.onClose();
    currentGroup = null;
}

// public
export function undo(): void {
    closeCurrentGroup();
    if (undoStack.length > 0) {
        let group = undoStack.pop();
        inUndo = true;
        for (let i = group.actions.length-1; i >= 0; i--)
            group.actions[i].fun.apply(null,group.actions[i].args);
        inUndo = false;
    }
    closeCurrentGroup();
}

// public
export function redo(): void {
    closeCurrentGroup();
    if (redoStack.length > 0) {
        let group = redoStack.pop();
        inRedo = true;
        for (let i = group.actions.length-1; i >= 0; i--)
            group.actions[i].fun.apply(null,group.actions[i].args);
        inRedo = false;
    }
    closeCurrentGroup();
}

// public
export function addAction(fun: Function, ...rest: any[]): void {
    if (disabled > 0)
        return;

    // remaining parameters after fun are arguments to be supplied to fun
    let args = new Array();
    for (let i = 1; i < arguments.length; i++)
        args.push(arguments[i]);

    if (!inUndo && !inRedo && (redoStack.length > 0))
        redoStack.length = 0;

    let stack = inUndo ? redoStack : undoStack;
    if (currentGroup == null)
        newGroup(null);

    // Only add a group to the undo stack one it has at least one action, to avoid having
    // empty groups present.
    if (currentGroup.actions.length == 0) {
        if (!inUndo && !inRedo && (stack.length == UNDO_LIMIT))
            stack.shift();
        stack.push(currentGroup);
    }

    currentGroup.actions.push(new UndoAction(fun,args));
}

// public
export function newGroup(type?: string, onClose?: () => void): void {
    if (disabled > 0)
        return;

    closeCurrentGroup();

    // We don't actually add the group to the undo stack until the first request to add an
    // action to it. This way we don't end up with empty groups in the undo stack, which
    // simplifies logic for moving back and forward through the undo history.

    if ((type == null) || (type == ""))
        type = "Anonymous";
    currentGroup = new UndoGroup(type,onClose);
}

// public
export function groupType(): string {
    if (undoStack.length > 0)
        return undoStack[undoStack.length-1].type;
    else
        return null;
}

export function disableWhileExecuting<T>(fun: () => T): T {
    disabled++;
    try {
        return fun();
    }
    finally {
        disabled--;
    }
}

export function isActive(): boolean {
    return (inUndo || inRedo);
}

export function isDisabled(): boolean {
    return (disabled > 0);
}

export function clear(): void {
    undoStack.length = 0;
    redoStack.length = 0;
}

function saveProperty(obj: Object, name: string): void {
    if (obj.hasOwnProperty(name))
        addAction(setProperty,obj,name,obj[name]);
    else
        addAction(deleteProperty,obj,name);
}

export function setProperty(obj: Object, name: string, value: any): void {
    if (obj.hasOwnProperty(name) && (obj[name] == value))
        return; // no point in adding an undo action
    saveProperty(obj,name);
    obj[name] = value;
}

export function deleteProperty(obj: Object, name: string): void {
    if (!obj.hasOwnProperty(name))
        return; // no point in adding an undo action
    saveProperty(obj,name);
    delete obj[name];
}

export let undoSupported = true;
