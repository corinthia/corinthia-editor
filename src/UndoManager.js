// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var UndoManager_getLength;
var UndoManager_getIndex;
var UndoManager_setIndex;
var UndoManager_print;
var UndoManager_undo;
var UndoManager_redo;
var UndoManager_addAction;
var UndoManager_newGroup;
var UndoManager_groupType;

(function() {

    function UndoGroup(type)
    {
        this.type = type;
        this.actions = new Array();
    }

    function UndoAction(fun,description)
    {
        this.fun = fun;
        this.description = description;
    }

    var undoStack = new Array();
    var redoStack = new Array();
    var inUndo = false;
    var inRedo = false;
    var currentGroup = null;

    // public
    function getLength()
    {
        return undoStack.length + redoStack.length;
    }

    // public
    function getIndex()
    {
        return undoStack.length;
    }

    // public
    function setIndex(index)
    {
        while (undoStack.length > index)
            UndoManager_undo();
        while (undoStack.length < index)
            UndoManager_redo();
    }

    // public
    function print()
    {
        debug("");
        debug("--------------------------------------------------------------------");
        debug("Undo stack:");
        for (var groupIndex = 0; groupIndex < undoStack.length; groupIndex++) {
            var group = undoStack[groupIndex];
            debug("    "+group.type);
            for (var actionIndex = 0; actionIndex < group.actions.length; actionIndex++) {
                var action = group.actions[actionIndex];
                debug("        "+action.description);
            }
        }
        debug("Redo stack:");
        for (var groupIndex = 0; groupIndex < redoStack.length; groupIndex++) {
            var group = redoStack[groupIndex];
            debug("    "+group.type);
            for (var actionIndex = 0; actionIndex < group.actions.length; actionIndex++) {
                var action = group.actions[actionIndex];
                debug("        "+action.description);
            }
        }
        debug("Current group = "+currentGroup);
        debug("--------------------------------------------------------------------");
        debug("");
    }

    // public
    function undo()
    {
        currentGroup = null;
        if (undoStack.length > 0) {
            var group = undoStack.pop();
            inUndo = true;
            for (var i = group.actions.length-1; i >= 0; i--)
                group.actions[i].fun();
            inUndo = false;
        }
        currentGroup = null;
    }

    // public
    function redo()
    {
        currentGroup = null;
        if (redoStack.length > 0) {
            var group = redoStack.pop();
            inRedo = true;
            for (var i = group.actions.length-1; i >= 0; i--)
                group.actions[i].fun();
            inRedo = false;
        }
        currentGroup = null;
    }

    function addActionInternal(fun,description)
    {
        if (!inUndo && !inRedo && (redoStack.length > 0))
            redoStack.length = 0;

        var stack = inUndo ? redoStack : undoStack;
        if (currentGroup == null)
            UndoManager_newGroup(null);

        if (currentGroup.actions.length == 0) {
            stack.push(currentGroup);
        }

        var action = new UndoAction(fun,description);
        currentGroup.actions.push(action);
    }

    // public
    function addAction(fun) // remaining parameters are arguments to be supplied to fun
    {
        var args = arrayCopy(arguments);
        args.shift();
        addActionInternal(function () {
            fun.apply(null,args);
        },"");
    }

    // public
    function newGroup(type)
    {
        // We don't actually add the group to the undo stack until the first request to add an
        // action to it. This way we don't end up with empty groups in the undo stack, which
        // simplifies logic for moving back and forward through the undo history.

        if ((type == null) || (type == ""))
            type = "Anonymous";
        currentGroup = new UndoGroup(type);
    }

    // public
    function groupType()
    {
        if (undoStack.length > 0)
            return undoStack[undoStack.length-1].type;
        else
            return null;
    }

    UndoManager_getLength = trace(getLength);
    UndoManager_getIndex = trace(getIndex);
    UndoManager_setIndex = trace(setIndex);
    UndoManager_print = trace(print);
    UndoManager_undo = trace(undo);
    UndoManager_redo = trace(redo);
    UndoManager_addAction = trace(addAction);
    UndoManager_newGroup = trace(newGroup);
    UndoManager_groupType = trace(groupType);

})();

window.undoSupported = true;
