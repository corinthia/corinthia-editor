// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

// FIXME: place a limit on the number of undo steps recorded - say, 30-50?

var UndoManager_getLength;
var UndoManager_getIndex;
var UndoManager_setIndex;
var UndoManager_print;
var UndoManager_undo;
var UndoManager_redo;
var UndoManager_addAction;
var UndoManager_newGroup;
var UndoManager_groupType;
var UndoManager_disableWhileExecuting;
var UndoManager_isDisabled;

(function() {

    function UndoGroup(type)
    {
        this.type = type;
        this.actions = new Array();
    }

    function UndoAction(fun,args)
    {
        this.fun = fun;
        this.args = args;
    }

    UndoAction.prototype.toString = function()
    {
        var name;
        if (this.fun.wrappedName != null)
            name = this.fun.wrappedName;
        else
            name = this.fun.name;

        var argStrings = new Array();
        for (var i = 0; i < this.args.length; i++) {
            if (this.args[i] instanceof Node)
                argStrings.push(nodeString(this.args[i]));
            else if (this.args[i] == null)
                argStrings.push("null");
            else
                argStrings.push(this.args[i].toString());
        }

        return name + "(" + argStrings.join(",") + ")";
    }

    var undoStack = new Array();
    var redoStack = new Array();
    var inUndo = false;
    var inRedo = false;
    var currentGroup = null;
    var disabled = 0;

    // public
    UndoManager_getLength = trace(function getLength()
    {
        return undoStack.length + redoStack.length;
    });

    // public
    UndoManager_getIndex = trace(function getIndex()
    {
        return undoStack.length;
    });

    // public
    UndoManager_setIndex = trace(function setIndex(index)
    {
        while (undoStack.length > index)
            UndoManager_undo();
        while (undoStack.length < index)
            UndoManager_redo();
    });

    // public
    UndoManager_print = trace(function print()
    {
        debug("");
        debug("--------------------------------------------------------------------");
        debug("Undo stack:");
        for (var groupIndex = 0; groupIndex < undoStack.length; groupIndex++) {
            var group = undoStack[groupIndex];
            debug("    "+group.type);
            for (var actionIndex = 0; actionIndex < group.actions.length; actionIndex++) {
                var action = group.actions[actionIndex];
                debug("        "+action);
            }
        }
        debug("Redo stack:");
        for (var groupIndex = 0; groupIndex < redoStack.length; groupIndex++) {
            var group = redoStack[groupIndex];
            debug("    "+group.type);
            for (var actionIndex = 0; actionIndex < group.actions.length; actionIndex++) {
                var action = group.actions[actionIndex];
                debug("        "+action);
            }
        }
        debug("Current group = "+currentGroup);
        debug("--------------------------------------------------------------------");
        debug("");
    });

    // public
    UndoManager_undo = trace(function undo()
    {
        currentGroup = null;
        if (undoStack.length > 0) {
            var group = undoStack.pop();
            inUndo = true;
            for (var i = group.actions.length-1; i >= 0; i--)
                group.actions[i].fun.apply(null,group.actions[i].args);
            inUndo = false;
        }
        currentGroup = null;
    });

    // public
    UndoManager_redo = trace(function redo()
    {
        currentGroup = null;
        if (redoStack.length > 0) {
            var group = redoStack.pop();
            inRedo = true;
            for (var i = group.actions.length-1; i >= 0; i--)
                group.actions[i].fun.apply(null,group.actions[i].args);
            inRedo = false;
        }
        currentGroup = null;
    });

    // public
    UndoManager_addAction = trace(function addAction(fun)
    {
        if (disabled > 0)
            return;

        // remaining parameters after fun are arguments to be supplied to fun
        var args = new Array();
        for (var i = 1; i < arguments.length; i++)
            args.push(arguments[i]);

        if (!inUndo && !inRedo && (redoStack.length > 0))
            redoStack.length = 0;

        var stack = inUndo ? redoStack : undoStack;
        if (currentGroup == null)
            UndoManager_newGroup(null);

        // Only add a group to the undo stack one it has at least one action, to avoid having
        // empty groups present.
        if (currentGroup.actions.length == 0)
            stack.push(currentGroup);

        currentGroup.actions.push(new UndoAction(fun,args));
    });

    // public
    UndoManager_newGroup = trace(function newGroup(type)
    {
        if (disabled > 0)
            return;

        // We don't actually add the group to the undo stack until the first request to add an
        // action to it. This way we don't end up with empty groups in the undo stack, which
        // simplifies logic for moving back and forward through the undo history.

        if ((type == null) || (type == ""))
            type = "Anonymous";
        currentGroup = new UndoGroup(type);
    });

    // public
    UndoManager_groupType = trace(function groupType()
    {
        if (undoStack.length > 0)
            return undoStack[undoStack.length-1].type;
        else
            return null;
    });

    UndoManager_disableWhileExecuting = trace(function disableWhileExecuting(fun) {
        disabled++;
        try {
            return fun();
        }
        finally {
            disabled--;
        }
    });

    UndoManager_isDisabled = trace(function isDisabled() {
        return (disabled > 0);
    });

})();

window.undoSupported = true;
