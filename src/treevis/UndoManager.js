// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function() {

    function UndoGroup(direction,name)
    {
        this.name = name;
        this.actions = new Array();
        this.parentGroup = null;
        this.direction = direction;
    }

    UndoGroup.BACKWARDS = new Object();
    UndoGroup.FORWARDS = new Object();

    UndoGroup.prototype.addAction = function(action)
    {
        this.actions.push(action);
    }

    UndoGroup.prototype.perform = function(context)
    {
        enterGroup(this.name);
        for (var i = this.actions.length-1; i >= 0; i--)
            this.actions[i].perform(context);
        exitGroup();
    }

    UndoGroup.prototype.print = function(indent,index)
    {
        if (this.direction == UndoGroup.FORWARDS) {
            debug(indent+"Forwards group "+index+": "+this.name);
            for (var i = 0; i < this.actions.length; i++)
                this.actions[i].print(indent+"    ",i);
        }
        else if (this.direction == UndoGroup.BACKWARDS) {
            debug(indent+"Backwards group "+index+": "+this.name);
            for (var i = 0; i < this.actions.length; i++)
                this.actions[i].print(indent+"    ",i);
        }
    }



    function UndoAction(fun,name)
    {
        this.fun = fun;
        this.name = name;
    }

    UndoAction.prototype.perform = function(context)
    {
        //    debug(context+": performing action \""+this.name+"\"");
        this.fun();
    }

    UndoAction.prototype.print = function(indent,index)
    {
        debug(indent+"Action "+index+": "+this.name);
    }



    var inUndo = false;
    var inRedo = false;
    var undoStack = new Array();
    var redoStack = new Array();
    var currentGroup = null;

    function enterGroup(name)
    {
        var group;
        if (inUndo)
            group = new UndoGroup(UndoGroup.BACKWARDS,name);
        else
            group = new UndoGroup(UndoGroup.FORWARDS,name);
        group.parentGroup = currentGroup;
        if (currentGroup != null) {
            currentGroup.addAction(group);
        }
        else if (inUndo) {
            redoStack.push(group);
        }
        else if (inRedo) {
            undoStack.push(group);
        }
        else {
            redoStack.length = 0;
            undoStack.push(group);
        }
        currentGroup = group;
    }

    function exitAllGroups()
    {
        while (currentGroup != null)
            exitGroup();
    }

    function exitGroup()
    {
        if (currentGroup != null) {
            currentGroup = currentGroup.parentGroup;
        }
    }

    window.UndoManager = new Object();

    // public
    UndoManager.getLength = function()
    {
        return undoStack.length + redoStack.length;
    }

    // public
    UndoManager.getIndex = function()
    {
        return undoStack.length;
    }

    // public
    UndoManager.setIndex = function(index)
    {
        var length = this.getLength();
        while ((undoStack.length < index) && (redoStack.length > 0))
            this.redo();
        while ((redoStack.length < length - index) && (undoStack.length > 0))
            this.undo();
    }

    // public
    UndoManager.print = function()
    {
        debug("Undo stack:");
        for (var i = 0; i < undoStack.length; i++)
            undoStack[i].print("    ",i);
        debug("Redo stack:");
        for (var i = 0; i < redoStack.length; i++)
            redoStack[i].print("    ",i);
    }

    // public
    UndoManager.undo = function()
    {
        if (undoStack.length > 0) {
            exitAllGroups();
            inUndo = true;
            var group = undoStack.pop();
            try {
                group.perform("undo");
            }
            finally {
                exitAllGroups();
                inUndo = false;
            }
        }
    }

    // public
    UndoManager.redo = function()
    {
        if (redoStack.length > 0) {
            exitAllGroups();
            inRedo = true;
            var group = redoStack.pop();
            try {
                group.perform("redo");
            }
            finally {
                exitAllGroups();
                inRedo = false;
            }
        }
    }

    // public
    UndoManager.newGroup = function(name)
    {
        if (currentGroup != null)
            exitGroup();
        enterGroup(name);
    }

    // public
    UndoManager.addAction = function(fun,name)
    {
        //    debug("Undo action: "+name);
        if (currentGroup == null)
            enterGroup();
        currentGroup.addAction(new UndoAction(fun,name));
    }

    // public
    UndoManager.group = function(fun)
    {
        debug("UndoManager.namedGroup: "+name+" "+fun);
        // We enter two levels of grouping here, so that if fun calls newGroup(), it will still
        // remain within the scope of the outer group defined here.
        enterGroup();
        enterGroup();
        try {
            return fun.apply(null,Array.prototype.slice.call(arguments,1));
        }
        finally {
            exitGroup();
            exitGroup();
        }
    }

})();
