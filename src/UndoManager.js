// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var UndoManager_monitors;
var UndoManager_monitorObject;
var UndoManager_unmonitorObject;
var UndoManager_monitorWhileExecuting;
var UndoManager_getLength;
var UndoManager_getIndex;
var UndoManager_setIndex;
var UndoManager_print;
var UndoManager_undo;
var UndoManager_redo;
var UndoManager_newGroup;
var UndoManager_addAction;
var UndoManager_group;

(function() {

    function Monitor(id,object,property)
    {
        this.id = id;
        this.object = object;
        this.property = property;
    }

    Monitor.prototype.toString = function()
    {
        return "[Monitor "+this.property+"]";
    }

    var nextTrackingId = 0;
    var monitors = UndoManager_monitors = new Object(); // public

    function monitorProperty(object,name)
    {
        var _name = "__"+name;

        // Check that we're not already being tracked
        if (object[_name+"_oldDescriptor"] != null)
            throw new Error("Property \""+name+"\" is already being tracked");

        // Save original descriptor
        object[_name+"_oldDescriptor"] = Object.getOwnPropertyDescriptor(object,name);

        // Record property as tracked
        var monitoredProperty = new Monitor(nextTrackingId++,object,name);
        monitors[monitoredProperty.id] = monitoredProperty;
        object[_name+"_monitoredProperty"] = monitoredProperty;

        // Move value to hidden property
        object[_name] = object[name];
        delete object[name];

        // Establish new property descriptor with getter and setters
        var descriptor = new Object();

        descriptor.get = function() {
            //        debug("get: "+name);
            return object[_name];
        };

        descriptor.set = function(newValue) {
            var oldValue = object[_name];
            UndoManager_addAction(function() {
                object[name] = oldValue;
            },"Set "+name+" to "+oldValue);
            //        debug("set: "+name+" = "+newValue);
            object[_name] = newValue;
        };

        descriptor.enumerable = true;
        descriptor.configurable = true;
        Object.defineProperty(object,name,descriptor);
    }

    function unmonitorProperty(object,name)
    {
        var _name = "__"+name;

        // Restore original descriptor
        var oldDescriptor = object[_name+"_oldDescriptor"];
        if (oldDescriptor == null) {
            // Property has been added since tracking started, and is thus not being tracked.
            // Don't try to untrack it.
            return;
        }
        delete object[_name+"_oldDescriptor"];
        Object.defineProperty(object,name,oldDescriptor);

        // Remove record of tracked property
        var monitoredProperty = object[_name+"_monitoredProperty"];
        delete object[_name+"_monitoredProperty"];
        delete monitors[monitoredProperty.id];

        // Restore original value
        var value = object[_name];
        delete object[_name];
        object[name] = value;
    }

    // public
    function monitorObject(object)
    {
        var names = Object.getOwnPropertyNames(object);

        UndoManager_addAction(function() {
            UndoManager_unmonitorObject(object);
        },"Untrack object");

        for (var i = 0; i < names.length; i++)
            monitorProperty(object,names[i]);
    }

    // public
    function unmonitorObject(object)
    {
        UndoManager_addAction(function() {
            UndoManager_monitorObject(object);
        },"Track object");

        var names = Object.getOwnPropertyNames(object);
        for (var i = 0; i < names.length; i++) {
            if (names[i].indexOf("__") != 0)
                unmonitorProperty(object,names[i]);
        }
    }

    // public
    function monitorWhileExecuting(object,fun)
    {
        UndoManager_monitorObject(object);
        try {
            return fun();
        }
        finally {
            UndoManager_unmonitorObject(object);
        }
    }



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
        //debug(context+": performing action \""+this.name+"\"");
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
        var length = UndoManager_getLength();
        while ((undoStack.length < index) && (redoStack.length > 0))
            UndoManager_redo();
        while ((redoStack.length < length - index) && (undoStack.length > 0))
            UndoManager_undo();
    }

    // public
    function print()
    {
        debug("Undo stack:");
        for (var i = 0; i < undoStack.length; i++)
            undoStack[i].print("    ",i);
        debug("Redo stack:");
        for (var i = 0; i < redoStack.length; i++)
            redoStack[i].print("    ",i);
    }

    // public
    function undo()
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
    function redo()
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
    function newGroup(name)
    {
        if (currentGroup != null)
            exitGroup();
        enterGroup(name);
    }

    // public
    function addAction(fun,name)
    {
        //debug("Undo action: "+name);
        if (currentGroup == null)
            enterGroup();
        currentGroup.addAction(new UndoAction(fun,name));
    }

    // public
    function group(fun)
    {
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

    UndoManager_monitorObject = trace(monitorObject);
    UndoManager_unmonitorObject = trace(unmonitorObject);
    UndoManager_monitorWhileExecuting = trace(monitorWhileExecuting);
    UndoManager_getLength = trace(getLength);
    UndoManager_getIndex = trace(getIndex);
    UndoManager_setIndex = trace(setIndex);
    UndoManager_print = trace(print);
    UndoManager_undo = trace(undo);
    UndoManager_redo = trace(redo);
    UndoManager_newGroup = trace(newGroup);
    UndoManager_addAction = trace(addAction);
    UndoManager_group = trace(group);

})();

window.undoSupported = true;
