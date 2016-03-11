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

// We only import the externalapi module to get access to the type definitions it contains.
// The external API functions are *not* intended for use by internal modules.
import ExternallyVisibleTypes = require("./externalapi");
export type EventReceiver = ExternallyVisibleTypes.EventReceiver;

class StoredReceiver {

    private backMessages: any[] = [];

    private addBackMessage(...args: any[]): void {
        this.backMessages.push(Util.arrayCopy(args));
        return null;
    }

    public clearBackMessages(): void {
        this.backMessages = [];
    }

    public getBackMessages(): string {
        return JSON.stringify(this.backMessages);
    };

    public debug(message: any): void {
        this.addBackMessage("debug",message.toString());
    };

    public error(error: string, type?: string): void {
        if (type == null)
            type = "";
        this.addBackMessage("error",error.toString(),type);
    };

    public addOutlineItem(itemId: string, type: string, title: string): void {
        this.addBackMessage("addOutlineItem",itemId,type,title);
    };

    public updateOutlineItem(itemId: string, title: string): void {
        this.addBackMessage("updateOutlineItem",itemId,title);
    };

    public removeOutlineItem(itemId: string): void {
        this.addBackMessage("removeOutlineItem",itemId);
    };

    public outlineUpdated(): void {
        this.addBackMessage("outlineUpdated");
    };

    public setCursor(x: number, y: number, width: number, height: number): void {
        this.addBackMessage("setCursor",x,y,width,height);
    };

    public setSelectionHandles(x1: number, y1: number, height1: number,
                                        x2: number, y2: number, height2: number): void {
        this.addBackMessage("setSelectionHandles",x1,y1,height1,x2,y2,height2);
    };

    public setTableSelection(x: number, y: number, width: number, height: number): void {
        this.addBackMessage("setTableSelection",x,y,width,height);
    };

    public setSelectionBounds(left: number, top: number, right: number, bottom: number): void {
        this.addBackMessage("setSelectionBounds",left,top,right,bottom);
    };

    public clearSelectionHandlesAndCursor(): void {
        this.addBackMessage("clearSelectionHandlesAndCursor");
    };

    public updateAutoCorrect(): void {
        this.addBackMessage("updateAutoCorrect");
    };

    public documentModified(): void {
        this.addBackMessage("documentModified");
    }

}

let storedReceiver = new StoredReceiver();
let customReceiver: EventReceiver = null;
let pending: ((r: EventReceiver) => void)[] = [];

export function getBackMessages(): string {
    return storedReceiver.getBackMessages();
}

function addPending(fun: (r: EventReceiver) => void) {
    pending.push(fun);
}

export function executePending() {
    storedReceiver.clearBackMessages();
    pending.forEach((fun) => fun(storedReceiver));
    if (customReceiver != null)
        pending.forEach((fun) => fun(customReceiver));
    pending = [];
}

export function debug(message: any): void {
    addPending((r) => {
        if (r.debug !== undefined)
            r.debug(message);
    });
}

export function error(error: string, type?: string): void {
    if (type == null)
        type = "";
    addPending((r) => {
        if (r.error !== undefined)
            r.error(error,type);
    });
}

export function addOutlineItem(itemId: string, type: string, title: string): void {
    addPending((r) => {
        if (r.addOutlineItem !== undefined)
            r.addOutlineItem(itemId,type,title);
    });
}

export function updateOutlineItem(itemId: string, title: string): void {
    addPending((r) => {
        if (r.updateOutlineItem !== undefined)
            r.updateOutlineItem(itemId,title);
    });
}

export function removeOutlineItem(itemId: string): void {
    addPending((r) => {
        if (r.removeOutlineItem !== undefined)
            r.removeOutlineItem(itemId);
    });
}

export function outlineUpdated(): void {
    addPending((r) => {
        if (r.outlineUpdated !== undefined)
            r.outlineUpdated();
    });
}

export function setCursor(x: number, y: number, width: number, height: number): void {
    addPending((r) => {
        if (r.setCursor !== undefined)
            r.setCursor(x,y,width,height);
    });
}

export function setSelectionHandles(x1: number, y1: number, height1: number,
                                    x2: number, y2: number, height2: number): void {
    addPending((r) => {
        if (r.setSelectionHandles !== undefined)
            r.setSelectionHandles(x1,y1,height1,x2,y2,height2);
    });
}

export function setTableSelection(x: number, y: number, width: number, height: number): void {
    addPending((r) => {
        if (r.setTableSelection !== undefined)
            r.setTableSelection(x,y,width,height);
    });
}

export function setSelectionBounds(left: number, top: number, right: number, bottom: number): void {
    addPending((r) => {
        if (r.setSelectionBounds !== undefined)
            r.setSelectionBounds(left,top,right,bottom);
    });
}

export function clearSelectionHandlesAndCursor(): void {
    addPending((r) => {
        if (r.clearSelectionHandlesAndCursor !== undefined)
            r.clearSelectionHandlesAndCursor();
    });
}

export function updateAutoCorrect(): void {
    addPending((r) => {
        if (r.updateAutoCorrect !== undefined)
            r.updateAutoCorrect();
    });
}

export function documentModified(): void {
    addPending((r) => {
        if (r.documentModified !== undefined)
            r.documentModified();
    });
}

export function setReceiver(receiver: EventReceiver): void {
    customReceiver = receiver;
}
