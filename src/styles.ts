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

import DOM = require("./dom");
import ElementTypes = require("./elementTypes");
import Outline = require("./outline");
import Types = require("./types");
import UndoManager = require("./undo");

export class Rule {
    [property: string]: string;
}

export class RuleSet {
    [selector: string]: Rule;
}

let rules: RuleSet = new RuleSet();
let paragraphClass: string = null;

export function getRule(selector: string): Rule {
    return rules[selector];
}

export function nextSelectorAfter(element: HTMLElement): string {
    let selector = element.nodeName.toLowerCase();
    let className = DOM.getAttribute(element,"class");
    if (className != null)
        selector = selector+"."+className;

    let nextElementName: string = null;
    let nextClassName: string = null;

    let rule = getRule(selector);
    if (rule != null) {
        let nextSelector = rule["-uxwrite-next"];
        if (nextSelector != null) {
            try {
                nextSelector = JSON.parse(nextSelector);
                if (typeof(nextSelector) != "string")
                    nextSelector = null;
            }
            catch (e) {
                nextSelector = null;
            }
        }
        if (nextSelector != null) {
            let dotIndex = nextSelector.indexOf(".");
            if (dotIndex >= 0) {
                nextElementName = nextSelector.substring(0,dotIndex);
                nextClassName = nextSelector.substring(dotIndex+1);
            }
            else {
                nextElementName = nextSelector;
            }
        }
    }

    if ((nextElementName == null) ||
        (ElementTypes.fromString[nextElementName] == null) ||
        (!Types.PARAGRAPH_ELEMENTS[ElementTypes.fromString[nextElementName]])) {
        nextElementName = null;
        nextClassName = null;
    }

    if (Types.isHeadingNode(element)) {
        nextElementName = "p";
        nextClassName = getParagraphClass();
    }

    if (nextElementName == null)
        return null;
    else if (nextClassName == null)
        return nextElementName;
    else
        return nextElementName+"."+nextClassName;
}

export function getParagraphClass(): string {
    return paragraphClass;
}

export function setParagraphClass(cls: string): void {
    paragraphClass = cls;
}

export function headingNumbering(): boolean {
    return ((rules["h1::before"] != null) &&
            (rules["h1::before"]["content"] != null));
}

export function getCSSText(): string {
    let head = DOM.documentHead(document);
    let cssText = "";
    for (let child = head.firstChild; child != null; child = child.nextSibling) {
        if (child._type == ElementTypes.HTML_STYLE) {
            for (let t = child.firstChild; t != null; t = t.nextSibling) {
                if (t._type == ElementTypes.HTML_TEXT)
                    cssText += t.nodeValue;
            }
        }
    }
    return cssText;
}

// FIXME: This should return void (need to update Objective C interface)
export function setCSSText(cssText: string, cssRules: RuleSet): {} {
    UndoManager.newGroup("Update styles");
    let head = DOM.documentHead(document);
    let next: Node;
    for (let child = head.firstChild; child != null; child = next) {
        next = child.nextSibling;
        if (child._type == ElementTypes.HTML_STYLE)
            DOM.deleteNode(child);
    }
    let style = DOM.createElement(document,"STYLE");
    DOM.appendChild(style,DOM.createTextNode(document,cssText));
    DOM.appendChild(head,style);
    rules = cssRules; // FIXME: undo support? (must coordinate with ObjC code)
    Outline.scheduleUpdateStructure();
    return {}; // Objective C caller expects JSON result
}

function addBuiltinStylesheet(cssURL: string): void {
    let head = DOM.documentHead(document);
    for (let child = head.firstChild; child != null; child = child.nextSibling) {
        if ((child instanceof HTMLLinkElement) &&
            (child.getAttribute("rel") == "stylesheet") &&
            (child.getAttribute("href") == cssURL)) {
            // Link element was already added by HTMLInjectionProtocol
            return;
        }
    }

    // HTMLInjectionProtocol was unable to find <head> element and insert the stylesheet link,
    // so add it ourselves
    let link = DOM.createElement(document,"LINK");
    DOM.setAttribute(link,"rel","stylesheet");
    DOM.setAttribute(link,"href",cssURL);
    DOM.insertBefore(head,link,head.firstChild);
}

let builtinCSSURL: string = null;

export function getBuiltinCSSURL(): string {
    return builtinCSSURL;
}

// public
export function init(cssURL: string): void {
    if (cssURL != null)
        builtinCSSURL = cssURL;

    if (builtinCSSURL != null)
        addBuiltinStylesheet(builtinCSSURL);
}
