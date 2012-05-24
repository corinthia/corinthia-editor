// Copyright (c) 2012 UX Productivity Pty Ltd. All rights reserved.

var PostponedActions_add;
var PostponedActions_perform;
var PostponedActions_performImmediately = false;

(function() {

    function PostponedAction(fun,undoDisabled)
    {
        this.fun = fun;
        this.undoDisabled = undoDisabled;
    }

    var actions = new Array();

    PostponedActions_add = function(action)
    {
        actions.push(new PostponedAction(action,UndoManager_isDisabled()));
        if (PostponedActions_performImmediately)
            PostponedActions_perform();
    }

    PostponedActions_perform = function()
    {
        var count = 0;
        while (actions.length > 0) {
            if (count >= 10)
                throw new Error("Too many postponed actions");
            var actionsToPerform = actions;
            actions = new Array();
            for (var i = 0; i < actionsToPerform.length; i++) {
                var action = actionsToPerform[i];
//                debug("PostponedActions: before executing "+action.fun.wrappedName);
                if (action.undoDisabled)
                    UndoManager_disableWhileExecuting(action.fun);
                else
                    action.fun();
//                debug("PostponedActions: after executing "+action.fun.wrappedName);
            }
//            Selection_updateSelectionDisplay();
            count++;
        }
    }

})();
