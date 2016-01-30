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

define("PostponedActions",function(require,exports) {

    var UndoManager = require("UndoManager");

    function PostponedAction(fun,undoDisabled) {
        this.fun = fun;
        this.undoDisabled = undoDisabled;
    }

    var actions = new Array();

    function add(action) {
        actions.push(new PostponedAction(action,UndoManager.isDisabled()));
    }

    function perform() {
        var count = 0;
        while (actions.length > 0) {
            if (count >= 10)
                throw new Error("Too many postponed actions");
            var actionsToPerform = actions;
            actions = new Array();
            for (var i = 0; i < actionsToPerform.length; i++) {
                var action = actionsToPerform[i];
                if (action.undoDisabled)
                    UndoManager.disableWhileExecuting(action.fun);
                else
                    action.fun();
            }
            count++;
        }
    }

    exports.add = add;
    exports.perform = perform;

});
