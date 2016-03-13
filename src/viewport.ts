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

import Cursor = require("./cursor");
import DOM = require("./dom");
import ElementTypes = require("./elementTypes");
import Selection = require("./selection");

let viewportMetaElement: HTMLElement = null;

// public
export function init(width: number, textScale: number): void {
    let head = DOM.documentHead(document);
    for (let child = head.firstChild; child != null; child = child.nextSibling) {
        if ((child instanceof HTMLMetaElement) && (child.getAttribute("name") == "viewport")) {
            viewportMetaElement = child;
            break;
        }
    }

    if (viewportMetaElement == null) {
        viewportMetaElement = DOM.createElement(document,"META");
        DOM.setAttribute(viewportMetaElement,"name","viewport");
        DOM.appendChild(head,viewportMetaElement);
    }

    if (width != 0) {
        // Only set the width and text scale if they are not already set, to avoid triggering
        // an extra layout at load time
        let contentValue = "width = "+width+", user-scalable = no";
        if (viewportMetaElement.getAttribute("content") != contentValue)
            DOM.setAttribute(viewportMetaElement,"content",contentValue);
    }

    if (textScale != 0) {
        let pct = textScale+"%";
        if (document.documentElement.style.getPropertyValue("-webkit-text-size-adjust") != pct)
            DOM.setStyleProperties(document.documentElement,{"-webkit-text-size-adjust": pct});
    }
}

// public
export function setViewportWidth(width: number): void {
    let contentValue = "width = "+width+", user-scalable = no";
    if (viewportMetaElement.getAttribute("content") != contentValue)
        DOM.setAttribute(viewportMetaElement,"content",contentValue);

    Selection.update();
    Cursor.scrollViewForCursor();
}

// public
export function setTextScale(textScale: number): void {
    let pct = textScale+"%";
    if (document.documentElement.style.getPropertyValue("-webkit-text-size-adjust") != pct)
        DOM.setStyleProperties(document.documentElement,{"-webkit-text-size-adjust": pct});

    Selection.update();
    Cursor.scrollViewForCursor();
}
