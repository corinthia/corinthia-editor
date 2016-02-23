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

import AutoCorrect = require("./autoCorrect");
import Callbacks = require("./callbacks")
import Cursor = require("./cursor");
import DOM = require("./dom");
import ElementTypes = require("./elementTypes");
import Outline = require("./outline");
import Position = require("./position");
import PostponedActions = require("./postponedActions");
import Range = require("./range");
import Selection = require("./selection");
import Styles = require("./styles");
import Types = require("./types");
import UndoManager = require("./undo");
import Util = require("./util");
import Viewport = require("./viewport");

// public
export function getLanguage(): string {
    let lang = document.documentElement.getAttribute("lang");
    if (lang != null)
        lang = lang.replace(/-/g,"_");
    return lang;
}

// public
export function setLanguage(lang: string): void {
    if ((lang == null) || (lang == "")) {
        DOM.removeAttribute(document.documentElement,"lang");
    }
    else {
        lang = lang.replace(/_/g,"-");
        DOM.setAttribute(document.documentElement,"lang",lang);
    }
}

// public
export function removeUnsupportedInput(): void {
    recurse(document.documentElement);

    function recurse(node: Node): void {
        // Delete comments and processing instructions
        if (!(node instanceof Text) &&
            !(node instanceof Element)) {
            DOM.deleteNode(node);
        }
        else {
            let next: Node;
            for (let child = node.firstChild; child != null; child = next) {
                next = child.nextSibling;
                recurse(child);
            }
        }
    }
}

// private
function addMetaCharset(): void {
    let head = DOM.documentHead(document);
    let next: Node;
    for (let child = head.firstChild; child != null; child = next) {
        next = child.nextSibling;
        if ((child instanceof HTMLMetaElement) && child.hasAttribute("charset")) {
            DOM.deleteNode(child);
        }
        else if ((child instanceof HTMLMetaElement) && child.hasAttribute("http-equiv") &&
                 (child.getAttribute("http-equiv").toLowerCase() == "content-type")) {
            DOM.deleteNode(child);
        }
    }

    let meta = DOM.createElement(document,"META");
    DOM.setAttribute(meta,"charset","utf-8");
    DOM.insertBefore(head,meta,head.firstChild);
}

// public
export function setGenerator(generator: string): string {
    return UndoManager.disableWhileExecuting(function() {
        let head = DOM.documentHead(document);
        for (let child = head.firstChild; child != null; child = child.nextSibling) {
            if ((child instanceof HTMLMetaElement) &&
                child.hasAttribute("name") &&
                (child.getAttribute("name").toLowerCase() == "generator")) {
                let origGenerator = DOM.getAttribute(child,"content");
                DOM.setAttribute(child,"content",generator);

                if (origGenerator == null)
                    return "";
                else
                    return origGenerator;
            }
        }

        let meta = DOM.createElement(document,"META");
        DOM.setAttribute(meta,"name","generator");
        DOM.setAttribute(meta,"content",generator);
        DOM.insertBefore(head,meta,head.firstChild);

        return "";
    });
}

// public
export function isEmptyDocument(): boolean {
    return !Types.nodeHasContent(document.body);
}

// public
export function prepareForSave(): boolean {
    // Force any end-of-group actions to be performed
    UndoManager.newGroup();
    return true;
}

// public
export function getHTML(): string {
    return document.documentElement.outerHTML;
}

interface SavedNode {
    tempNode?: Node;
    originalNodeValue?: string;
}

// public
export function getErrorReportingInfo(): string {
    if (document.documentElement == null)
        return "(document.documentElement is null)";
    try {
        let html: HTMLElement = htmlWithSelection();
        cleanse(html);
        return html.outerHTML;
    }
    catch (e) {
        try {
            let html = DOM.cloneNode(document.documentElement,true);
            cleanse(html);
            return html.outerHTML+"\n[Error getting selection: "+e+"]";
        }
        catch (e2) {
            return "[Error getting HTML: "+e2+"]";
        }
    }

    function cleanse(node: Node): void {
        switch (node._type) {
        case ElementTypes.HTML_TEXT:
        case ElementTypes.HTML_COMMENT:
            if ((node instanceof Text) || (node instanceof Comment)) // only needed for type guard
                DOM.setNodeValue(node,cleanseString(node.nodeValue));
            break;
        case ElementTypes.HTML_STYLE:
        case ElementTypes.HTML_SCRIPT:
            return;
        default:
            if (node instanceof HTMLElement) {
                cleanseAttribute(node,"original");
                if (node.hasAttribute("href") && !node.getAttribute("href").match(/^#/))
                    cleanseAttribute(node,"href");
                for (let child = node.firstChild; child != null; child = child.nextSibling)
                    cleanse(child);
            }
            break;
        }
    }

    function cleanseAttribute(node: HTMLElement, name: string): void {
        if (node.hasAttribute(name)) {
            let value = node.getAttribute(name);
            value = cleanseString(value);
            DOM.setAttribute(node,name,value);
        }
    }

    function cleanseString(str: string): string {
        return str.replace(/[^\s\.\@\^]/g,"X");
    }

    function htmlWithSelection(): HTMLElement {
        let selectionRange = Selection.get();
        if (selectionRange != null) {
            selectionRange = Range.forwards(selectionRange);
            let startSave: SavedNode = {};
            let endSave: SavedNode = {};

            let html: HTMLElement = null;

            Range.trackWhileExecuting(selectionRange,function() {
                // We use the strings @@^^ and ^^@@ to represent the selection
                // start and end, respectively. The reason for this is that after we have
                // cloned the tree, all text will be removed. We keeping the @ and ^
                // characters so we have some way to identifiy the selection markers;
                // leaving these in is not going to reveal any confidential information.

                addPositionMarker(selectionRange.end,"^^@@",endSave);
                addPositionMarker(selectionRange.start,"@@^^",startSave);

                html = DOM.cloneNode(document.documentElement,true);

                removePositionMarker(selectionRange.start,startSave);
                removePositionMarker(selectionRange.end,endSave);
            });

            return html;
        }
        else {
            return DOM.cloneNode(document.documentElement,true);
        }
    }

    function addPositionMarker(pos: Position, name: string, save: SavedNode): void {
        let node = pos.node;
        let offset = pos.offset;
        if (node instanceof Element) {
            save.tempNode = DOM.createTextNode(document,name);
            DOM.insertBefore(node,save.tempNode,node.childNodes[offset]);
        }
        else if (node instanceof Text) {
            save.originalNodeValue = node.nodeValue;
            node.nodeValue = node.nodeValue.slice(0,offset) + name + node.nodeValue.slice(offset);
        }
    }

    function removePositionMarker(pos: Position, save: SavedNode): void {
        let node = pos.node;
        let offset = pos.offset;
        if (pos.node instanceof Element) {
            DOM.deleteNode(save.tempNode);
        }
        else if (pos.node instanceof Text) {
            node.nodeValue = save.originalNodeValue;
        }
    }
}

// public
export function removeSpecial(node: Node): void {
    // We process the children first, so that if there are any nested removable elements (e.g.
    // a selection span inside of an autocorrect span), all levels of nesting are taken care of
    let next: Node;
    for (let child = node.firstChild; child != null; child = next) {
        next = child.nextSibling;
        removeSpecial(child);
    }

    let cssClass: string = null;
    if ((node instanceof Element) && node.hasAttribute("class"))
        cssClass = node.getAttribute("class");

    if ((cssClass == Types.Keys.HEADING_NUMBER) ||
        (cssClass == Types.Keys.FIGURE_NUMBER) ||
        (cssClass == Types.Keys.TABLE_NUMBER) ||
        (cssClass == Types.Keys.AUTOCORRECT_CLASS) ||
        (cssClass == Types.Keys.SELECTION_CLASS) ||
        (cssClass == Types.Keys.SELECTION_HIGHLIGHT)) {
        DOM.removeNodeButKeepChildren(node);
    }
    else if ((node instanceof HTMLMetaElement) &&
             node.hasAttribute("name") &&
             (node.getAttribute("name").toLowerCase() == "viewport")) {
        DOM.deleteNode(node);
    }
    else if ((node instanceof HTMLLinkElement)) {
        if ((node.getAttribute("rel") == "stylesheet") &&
            (node.getAttribute("href") == Styles.getBuiltinCSSURL())) {
            DOM.deleteNode(node);
        }
    }
}

function simplifyStackString(e: any): string {
    if (e.stack == null)
        return "";
    let lines = e.stack.toString().split(/\n/);
    for (let i = 0; i < lines.length; i++) {
        let nameMatch = lines[i].match(/^(.*)@/);
        let name = (nameMatch != null) ? nameMatch[1] : "(anonymous function)";
        let locMatch = lines[i].match(/:([0-9]+:[0-9]+)$/);
        let loc = (locMatch != null) ? locMatch[1] : "?";
        lines[i] = "stack["+(lines.length-i-1)+"] = "+name+"@"+loc;
    }
    return lines.join("\n");
}

// public
export function execute<T>(fun: () => T): T {
    try {
        let res = fun();
        PostponedActions.perform();
        return res;
    }
    catch (e) {
        let message = (e.message != null) ? e.message : e.toString();
        let stack = simplifyStackString(e);
        Callbacks.error(message+"\n"+stack);
    }
}

function fixEmptyBody(): void {
    for (let child = document.body.firstChild; child != null; child = child.nextSibling) {
        if (Types.nodeHasContent(child))
            return;
    }

    for (let child = document.body.firstChild; child != null; child = child.nextSibling) {
        if (child._type == ElementTypes.HTML_P) {
            Cursor.updateBRAtEndOfParagraph(child);
            return;
        }
    }

    let p = DOM.createElement(document,"P");
    let br = DOM.createElement(document,"BR");
    DOM.appendChild(p,br);
    DOM.appendChild(document.body,p);
}

// public
export function init(width: number, textScale: number, cssURL: string): any {
    try {
        if (document.documentElement == null)
            throw new Error("document.documentElement is null");
        if (document.body == null)
            throw new Error("document.body is null");
        let timing = new Util.TimingInfo();
        timing.start();
        DOM.assignNodeIds(document);
        timing.addEntry("DOM.assignNodeIds");
        removeUnsupportedInput();
        timing.addEntry("Main.removeUnsupportedInput");
        addMetaCharset();
        timing.addEntry("addMetaCharset");
        fixEmptyBody();
        timing.addEntry("fixEmptyBody");
        Outline.init();
        timing.addEntry("Outline.init");
        Styles.init(cssURL);
        timing.addEntry("Styles.init");
        Viewport.init(width,textScale);
        timing.addEntry("Viewport.init");
        AutoCorrect.init();
        timing.addEntry("AutoCorrect.init");

        PostponedActions.perform();
        timing.addEntry("PostponedActions.perform");
        Cursor.moveToStartOfDocument();
        timing.addEntry("Cursor.moveToStartOfDocument");

        UndoManager.clear();
        timing.addEntry("UndoManager.clear");
//        timing.print();

        return true;
    }
    catch (e) {
        return e.toString();
    }
}
