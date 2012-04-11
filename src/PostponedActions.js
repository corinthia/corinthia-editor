// Copyright (c) 2012 UX Productivity Pty Ltd. All rights reserved.

var PostponedActions_add;
var PostponedActions_perform;
var PostponedActions_performImmediately = false;

(function() {

    var actions = new Array();

    PostponedActions_add = function(action)
    {
        actions.push(action);
        if (PostponedActions_performImmediately)
            PostponedActions_perform();
    }

    PostponedActions_perform = function()
    {
        if (actions.length > 0) {
            var actionsToPerform = actions;
            actions = new Array();
            for (var i = 0; i < actionsToPerform.length; i++)
                actionsToPerform[i]();
            Selection_updateSelectionDisplay();
        }
    }

})();
