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

define("Editor",function(require,exports) {
    "use strict";

    var Util = require("Util");

    var backMessages = new Array();

    function addBackMessage() {
        backMessages.push(Util.arrayCopy(arguments));
        return null;
    }

    function getBackMessages() {
        var result = JSON.stringify(backMessages);
        backMessages = new Array();
        return result;
    };

    function debug(str) {
        addBackMessage("debug",str);
    };

    function error(error,type) {
        if (type == null)
            type = "";
        addBackMessage("error",error.toString(),type);
    };

    function addOutlineItem(itemId,type,title) {
        addBackMessage("addOutlineItem",itemId,type,title);
    };

    function updateOutlineItem(itemId,title) {
        addBackMessage("updateOutlineItem",itemId,title);
    };

    function removeOutlineItem(itemId) {
        addBackMessage("removeOutlineItem",itemId);
    };

    function outlineUpdated() {
        addBackMessage("outlineUpdated");
    };

    function setCursor(x,y,width,height) {
        addBackMessage("setCursor",x,y,width,height);
    };

    function setSelectionHandles(x1,y1,height1,x2,y2,height2) {
        addBackMessage("setSelectionHandles",x1,y1,height1,x2,y2,height2);
    };

    function setTableSelection(x,y,width,height) {
        addBackMessage("setTableSelection",x,y,width,height);
    };

    function setSelectionBounds(left,top,right,bottom) {
        addBackMessage("setSelectionBounds",left,top,right,bottom);
    };

    function clearSelectionHandlesAndCursor() {
        addBackMessage("clearSelectionHandlesAndCursor");
    };

    function updateAutoCorrect() {
        addBackMessage("updateAutoCorrect");
    };

    exports.getBackMessages = getBackMessages;
    exports.debug = debug;
    exports.error = error;
    exports.addOutlineItem = addOutlineItem;
    exports.updateOutlineItem = updateOutlineItem;
    exports.removeOutlineItem = removeOutlineItem;
    exports.outlineUpdated = outlineUpdated;
    exports.setCursor = setCursor;
    exports.setSelectionHandles = setSelectionHandles;
    exports.setTableSelection = setTableSelection;
    exports.setSelectionBounds = setSelectionBounds;
    exports.clearSelectionHandlesAndCursor = clearSelectionHandlesAndCursor;
    exports.updateAutoCorrect = updateAutoCorrect;

});
