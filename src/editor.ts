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

import Util = require("./util");

var backMessages = new Array();

function addBackMessage(...args) {
    backMessages.push(Util.arrayCopy(arguments));
    return null;
}

export function getBackMessages() {
    var result = JSON.stringify(backMessages);
    backMessages = new Array();
    return result;
};

export function debug(str) {
    addBackMessage("debug",str);
};

export function error(error,type?) {
    if (type == null)
        type = "";
    addBackMessage("error",error.toString(),type);
};

export function addOutlineItem(itemId,type,title) {
    addBackMessage("addOutlineItem",itemId,type,title);
};

export function updateOutlineItem(itemId,title) {
    addBackMessage("updateOutlineItem",itemId,title);
};

export function removeOutlineItem(itemId) {
    addBackMessage("removeOutlineItem",itemId);
};

export function outlineUpdated() {
    addBackMessage("outlineUpdated");
};

export function setCursor(x,y,width,height) {
    addBackMessage("setCursor",x,y,width,height);
};

export function setSelectionHandles(x1,y1,height1,x2,y2,height2) {
    addBackMessage("setSelectionHandles",x1,y1,height1,x2,y2,height2);
};

export function setTableSelection(x,y,width,height) {
    addBackMessage("setTableSelection",x,y,width,height);
};

export function setSelectionBounds(left,top,right,bottom) {
    addBackMessage("setSelectionBounds",left,top,right,bottom);
};

export function clearSelectionHandlesAndCursor() {
    addBackMessage("clearSelectionHandlesAndCursor");
};

export function updateAutoCorrect() {
    addBackMessage("updateAutoCorrect");
};
