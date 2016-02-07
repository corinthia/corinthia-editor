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

import Util = require("./util");

let UNDO_LIMIT = 50;

function UndoGroup(type,onClose) {
    this.type = type;
    this.onClose = onClose;
    this.actions = new Array();
}

function UndoAction(fun,args) {
    this.fun = fun;
    this.args = args;
}

UndoAction.prototype.toString = function() {
    let name;
    if (this.fun.wrappedName != null)
        name = this.fun.wrappedName;
    else
        name = this.fun.name;

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

let undoStack = new Array();
let redoStack = new Array();
let inUndo = false;
let inRedo = false;
let currentGroup = null;
let disabled = 0;

// public
export function getLength() {
    return undoStack.length + redoStack.length;
}

// public
export function getIndex() {
    return undoStack.length;
}

// public
export function setIndex(index) {
    while (undoStack.length > index)
        undo();
    while (undoStack.length < index)
        redo();
}

// public
export function print() {
    Util.debug("");
    Util.debug("--------------------------------------------------------------------");
    Util.debug("Undo stack:");
    for (let groupIndex = 0; groupIndex < undoStack.length; groupIndex++) {
        let group = undoStack[groupIndex];
        Util.debug("    "+group.type);
        for (let actionIndex = 0; actionIndex < group.actions.length; actionIndex++) {
            let action = group.actions[actionIndex];
            Util.debug("        "+action);
        }
    }
    Util.debug("Redo stack:");
    for (let groupIndex = 0; groupIndex < redoStack.length; groupIndex++) {
        let group = redoStack[groupIndex];
        Util.debug("    "+group.type);
        for (let actionIndex = 0; actionIndex < group.actions.length; actionIndex++) {
            let action = group.actions[actionIndex];
            Util.debug("        "+action);
        }
    }
    Util.debug("Current group = "+currentGroup);
    Util.debug("--------------------------------------------------------------------");
    Util.debug("");
}

function closeCurrentGroup() {
    if ((currentGroup != null) && (currentGroup.onClose != null))
        currentGroup.onClose();
    currentGroup = null;
}

// public
export function undo() {
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
export function redo() {
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
export function addAction(fun,...rest) {
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
export function newGroup(type?,onClose?) {
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
export function groupType() {
    if (undoStack.length > 0)
        return undoStack[undoStack.length-1].type;
    else
        return null;
}

export function disableWhileExecuting(fun) {
    disabled++;
    try {
        return fun();
    }
    finally {
        disabled--;
    }
}

export function isActive() {
    return (inUndo || inRedo);
}

export function isDisabled() {
    return (disabled > 0);
}

export function clear() {
    undoStack.length = 0;
    redoStack.length = 0;
}

function saveProperty(obj,name) {
    if (obj.hasOwnProperty(name))
        addAction(setProperty,obj,name,obj[name]);
    else
        addAction(deleteProperty,obj,name);
}

export function setProperty(obj,name,value) {
    if (obj.hasOwnProperty(name) && (obj[name] == value))
        return; // no point in adding an undo action
    saveProperty(obj,name);
    obj[name] = value;
}

export function deleteProperty(obj,name) {
    if (!obj.hasOwnProperty(name))
        return; // no point in adding an undo action
    saveProperty(obj,name);
    delete obj[name];
}

export let undoSupported = true;
