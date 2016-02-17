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

let backMessages: any[] = [];

function addBackMessage(...args) {
    backMessages.push(Util.arrayCopy(args));
    return null;
}

export function getBackMessages(): string {
    let result = JSON.stringify(backMessages);
    backMessages = [];
    return result;
};

export function debug(str: string): void {
    addBackMessage("debug",str);
};

export function error(error: string, type?: string): void {
    if (type == null)
        type = "";
    addBackMessage("error",error.toString(),type);
};

export function addOutlineItem(itemId: string, type: string, title: string): void {
    addBackMessage("addOutlineItem",itemId,type,title);
};

export function updateOutlineItem(itemId: string, title: string): void {
    addBackMessage("updateOutlineItem",itemId,title);
};

export function removeOutlineItem(itemId: string): void {
    addBackMessage("removeOutlineItem",itemId);
};

export function outlineUpdated(): void {
    addBackMessage("outlineUpdated");
};

export function setCursor(x: number, y: number, width: number, height: number): void {
    addBackMessage("setCursor",x,y,width,height);
};

export function setSelectionHandles(x1: number, y1: number, height1: number,
                                    x2: number, y2: number, height2: number) {
    addBackMessage("setSelectionHandles",x1,y1,height1,x2,y2,height2);
};

export function setTableSelection(x: number, y: number, width: number, height: number): void {
    addBackMessage("setTableSelection",x,y,width,height);
};

export function setSelectionBounds(left: number, top: number, right: number, bottom: number): void {
    addBackMessage("setSelectionBounds",left,top,right,bottom);
};

export function clearSelectionHandlesAndCursor(): void {
    addBackMessage("clearSelectionHandlesAndCursor");
};

export function updateAutoCorrect(): void {
    addBackMessage("updateAutoCorrect");
};
