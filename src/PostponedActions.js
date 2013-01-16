// Copyright (c) 2012-2013 UX Productivity Pty Ltd. All rights reserved.

var PostponedActions_add;
var PostponedActions_perform;

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
                if (action.undoDisabled)
                    UndoManager_disableWhileExecuting(action.fun);
                else
                    action.fun();
            }
            count++;
        }
    }

})();
