// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function() {

    function TrackedProperty(id,object,property)
    {
        this.id = id;
        this.object = object;
        this.property = property;
    }

    TrackedProperty.prototype.toString = function()
    {
        return "[TrackedProperty "+this.property+"]";
    }

    var nextId = 0;

    // public
    var allTrackedProperties = new Object();

    function trackProperty(object,name)
    {
        var _name = "__"+name;

        // Check that we're not already being tracked
        if (object[_name+"_oldDescriptor"] != null)
            throw new Error("Property \""+name+"\" is already being tracked");

        // Save original descriptor
        object[_name+"_oldDescriptor"] = Object.getOwnPropertyDescriptor(object,name);

        // Record property as tracked
        var trackedProperty = new TrackedProperty(nextId++,object,name);
        allTrackedProperties[trackedProperty.id] = trackedProperty;
        object[_name+"_trackedProperty"] = trackedProperty;

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
            UndoManager.addAction(function() {
                object[name] = oldValue;
            },"Set "+name+" to "+oldValue);
            //        debug("set: "+name+" = "+newValue);
            object[_name] = newValue;
        };

        descriptor.enumerable = true;
        descriptor.configurable = true;
        Object.defineProperty(object,name,descriptor);
    }

    function untrackProperty(object,name)
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
        var trackedProperty = object[_name+"_trackedProperty"];
        delete object[_name+"_trackedProperty"];
        delete allTrackedProperties[trackedProperty.id];

        // Restore original value
        var value = object[_name];
        delete object[_name];
        object[name] = value;
    }

    function trackObject(object)
    {
        var names = Object.getOwnPropertyNames(object);

        UndoManager.addAction(function() {
            untrackObject(object);
        },"Untrack object");

        for (var i = 0; i < names.length; i++)
            trackProperty(object,names[i]);
    }

    function untrackObject(object)
    {
        UndoManager.addAction(function() {
            trackObject(object);
        },"Track object");

        var names = Object.getOwnPropertyNames(object);
        for (var i = 0; i < names.length; i++) {
            if (names[i].indexOf("__") != 0)
                untrackProperty(object,names[i]);
        }
    }

    var PropertyTracker = {
        allTrackedProperties: allTrackedProperties
    };

    // public
    PropertyTracker.trackAndExecute = function(object,fun)
    {
        trackObject(object);
        try {
            return fun();
        }
        finally {
            untrackObject(object);
        }
    }

    window.PropertyTracker = PropertyTracker;

})();
