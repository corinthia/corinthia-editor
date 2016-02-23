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

// FIXME: The TOC/ItemList stuff won't work with Undo, because we're making DOM mutations in
// response to other DOM mutations, so at undo time the changes will be made twice

// FIXME: DOM mutation events are deprecated; we'll need to implement our own custom mechanism
// of invoking the functions used in this module for the DOMNodeInserted, DOMNodeRemoved, and
// DOMSubtreeModified events.
//
// See: http://lists.w3.org/Archives/Public/public-webapps/2011JulSep/0779.html

import Callbacks = require("./callbacks")
import Clipboard = require("./clipboard");
import Collections = require("./collections");
import Cursor = require("./cursor");
import DOM = require("./dom");
import ElementTypes = require("./elementTypes");
import Hierarchy = require("./hierarchy");
import Position = require("./position");
import PostponedActions = require("./postponedActions");
import Range = require("./range");
import Selection = require("./selection");
import Styles = require("./styles");
import Traversal = require("./traversal");
import Types = require("./types");
import UndoManager = require("./undo");
import Util = require("./util");

let itemsByNode: Collections.NodeMap<OutlineItem> = null;
let refsById: { [id: string]: HTMLElement[] } = null;
let nextItemId = 1;
let outlineDirty = false;
let ignoreModifications = 0;
let sectionNumberRegex = /^\s*(Chapter\s+)?\d+(\.\d+)*\.?\s+/i;
let figureNumberRegex = /^\s*Figure\s+\d+(\.\d+)*:?\s*/i;
let tableNumberRegex = /^\s*Table\s+\d+(\.\d+)*:?\s*/i;
let sections: Category = null;
let figures: Category = null;
let tables: Category = null;
let doneInit = false;
let printMode = false;

class Category {

    public type: string;
    public nodeFilter: (element: HTMLElement) => boolean;
    public numberRegex: RegExp;
    public list: Util.DoublyLinkedList<OutlineItem>;
    public tocs: Collections.NodeMap<any>; // FIXME: element type

    constructor(type: string, nodeFilter: (element: HTMLElement) => boolean, numberRegex: RegExp) {
        this.type = type;
        this.nodeFilter = nodeFilter;
        this.numberRegex = numberRegex;
        this.list = new Util.DoublyLinkedList<OutlineItem>();
        this.tocs = new Collections.NodeMap();
    }

}

function addItemInternal(category: Category, item: OutlineItem, prevItem: OutlineItem, title: string): void {
    UndoManager.addAction(removeItemInternal,category,item);
    category.list.insertAfter(item,prevItem);
    item.title = title;
    category.tocs.forEach(function(node: Node, toc: TOC) { TOC_addOutlineItem(toc,item.id); });
    Callbacks.addOutlineItem(item.id,category.type,title);
}

function removeItemInternal(category: Category, item: OutlineItem): void {
    UndoManager.addAction(addItemInternal,category,item,item.prev,item.title);
    category.list.remove(item);
    category.tocs.forEach(function(node: Node, toc: TOC) { TOC_removeOutlineItem(toc,item.id); });
    item.title = null;
    Callbacks.removeOutlineItem(item.id);
}

function Category_add(category: Category, node: HTMLElement): OutlineItem {
    let item = itemsByNode.get(node);
    if (item == null)
        item = new OutlineItem(category,node);

    let prevItem = findPrevItemOfType(node,category.nodeFilter);
    addItemInternal(category,item,prevItem,null);

    // Register for notifications to changes to this item's node content. We may need to
    // update the title when such a modification occurs.
    node.addEventListener("DOMSubtreeModified",item.modificationListener);

    OutlineItem_updateItemTitle(item);
    scheduleUpdateStructure();
    return item;

    function findPrevItemOfType(node: Node, typeFun: (element: HTMLElement) => boolean) {
        do node = Traversal.prevNode(node);
        while ((node != null) && !((node instanceof HTMLElement) && typeFun(node)));
        return (node == null) ? null : itemsByNode.get(node);
    }
}

function findFirstTextDescendant(node: Node): Text {
    if (Traversal.isWhitespaceTextNode(node))
        return;
    if (node instanceof Text)
        return node;
    for (let child = node.firstChild; child != null; child = child.nextSibling) {
        let result = findFirstTextDescendant(child);
        if (result != null)
            return result;
    }
    return null;
}

function Category_remove(category: Category, node: HTMLElement): void {
    let item = itemsByNode.get(node);
    if (item == null) {
        throw new Error("Attempt to remove non-existant "+node.nodeName+
                        " item "+node.getAttribute("id"));
    }
    removeItemInternal(category,item);
    item.node.removeEventListener("DOMSubtreeModified",item.modificationListener);
    let titleNode = OutlineItem_getTitleNode(item,false);
    if ((titleNode != null) &&
        ((item.type == "figure") || (item.type == "table")) &&
        (titleNode.firstChild == null) &&
        (titleNode.lastChild == null)) {
        DOM.deleteNode(titleNode);
    }
    scheduleUpdateStructure();
}

function addTOCInternal(category: Category, node: HTMLElement, toc: TOC): void {
    UndoManager.addAction(removeTOCInternal,category,node);
    category.tocs.put(node,toc);
}

function removeTOCInternal(category: Category, node: HTMLElement): void {
    let toc = category.tocs.get(node);
    if (toc == null)
        throw new Error("Attempt to remove ItemList that doesn't exist");

    UndoManager.addAction(addTOCInternal,category,node,toc);

    category.tocs.remove(node);
}

function Category_addTOC(category: Category, node: HTMLElement): void {
    let toc = new TOC(node);
    addTOCInternal(category,node,toc);

    for (let item = category.list.first; item != null; item = item.next) {
        TOC_addOutlineItem(toc,item.id);
        TOC_updateOutlineItem(toc,item.id,item.title);
    }

    scheduleUpdateStructure();
}

function Category_removeTOC(category: Category, node: HTMLElement): void {
    removeTOCInternal(category,node);
}

class TOC {

    public node: HTMLElement;
    public textNodes: any; // FIXME: type

    constructor(node: HTMLElement) {
        this.node = node;
        this.textNodes = new Object();
    }

}

function TOC_addOutlineItem(toc: TOC, id: string): void {
    toc.textNodes[id] = DOM.createTextNode(document,"");
}

function TOC_removeOutlineItem(toc: TOC, id: string): void {
    delete toc.textNodes[id];
}

function TOC_updateOutlineItem(toc: TOC, id: string, title: string): void {
    DOM.setNodeValue(toc.textNodes[id],title);
}

function TOC_updateStructure(toc: TOC, structure: Structure, toplevelShadows: Shadow[], pageNumbers: Collections.NodeMap<number>): void {
    Hierarchy.ensureValidHierarchy(toc.node);
    DOM.deleteAllChildren(toc.node);

    let cls = toc.node.getAttribute("class");

    if (toplevelShadows.length == 0) {
        createEmptyTOC(toc.node);
    }
    else {
        recurse(toplevelShadows,toc.node,1);
    }

    if (printMode) {
        let brk = DOM.createElement(document,"DIV");
        DOM.setStyleProperties(brk,{ "clear": "both" });
        DOM.appendChild(toc.node,brk);
    }

    function createEmptyTOC(parent: HTMLElement): void {
        if (!printMode) {
            let str = "";

            if (cls == Types.Keys.SECTION_TOC)
                str = "[No sections defined]";
            else if (cls == Types.Keys.FIGURE_TOC)
                str = "[No figures defined]";
            else if (cls == Types.Keys.TABLE_TOC)
                str = "[No tables defined]";

            let text = DOM.createTextNode(document,str);

            let div = DOM.createElement(document,"P");
            DOM.setAttribute(div,"class","toc1");
            DOM.appendChild(div,text);
            DOM.appendChild(parent,div);
        }
    }

    function recurse(shadows: Shadow[], parent: HTMLElement, level: number): void {
        if (level > 3)
            return;

        for (let i = 0; i < shadows.length; i++) {
            let shadow = shadows[i];
            let item = shadow.item;

            if (printMode) {
                let div = DOM.createElement(document,"P");
                DOM.setAttribute(div,"class","toc"+level+"-print");
                DOM.appendChild(parent,div);

                let leftSpan = DOM.createElement(document,"SPAN");
                DOM.setAttribute(leftSpan,"class","toctitle");

                let rightSpan = DOM.createElement(document,"SPAN");
                DOM.setAttribute(rightSpan,"class","tocpageno");

                DOM.appendChild(div,leftSpan);
                DOM.appendChild(div,rightSpan);

                if (item.computedNumber != null) {
                    let text = DOM.createTextNode(document,item.computedNumber+" ");
                    DOM.appendChild(leftSpan,text);
                }

                DOM.appendChild(leftSpan,toc.textNodes[item.id]);
                let pageNo = pageNumbers ? pageNumbers.get(item.node) : null;
                if (pageNo == null)
                    DOM.appendChild(rightSpan,DOM.createTextNode(document,"XXXX"));
                else
                    DOM.appendChild(rightSpan,DOM.createTextNode(document,""+pageNo));
            }
            else {
                let div = DOM.createElement(document,"P");
                DOM.setAttribute(div,"class","toc"+level);
                DOM.appendChild(parent,div);

                let a = DOM.createElement(document,"A");
                DOM.setAttribute(a,"href","#"+item.id);
                DOM.appendChild(div,a);

                if (item.computedNumber != null)
                    DOM.appendChild(a,DOM.createTextNode(document,item.computedNumber+" "));
                DOM.appendChild(a,toc.textNodes[item.id]);
            }

            recurse(shadow.children,parent,level+1);
        }
    }
}

class OutlineItem {

    public id: string;
    public category: Category;
    public type: string;
    public node: HTMLElement;
    public title: string;
    public computedNumber: string;
    public spareSpan: HTMLElement;
    public spareTitle: HTMLElement;
    public numberSpan: HTMLElement; // FIXME: Does not seem to be set anywhere; still needed?
    public prev: OutlineItem;
    public next: OutlineItem;
    public modificationListener: (event: any) => void; // FIXME: TS: specify type of event parameter

    constructor(category: Category, node: HTMLElement) {
        let type = category.type;
        let item = this;
        if ((node != null) && (node.hasAttribute("id"))) {
            this.id = node.getAttribute("id");
        }
        else {
            this.id = generateItemId();
            if (node != null)
                DOM.setAttribute(node,"id",this.id);
        }
        this.category = category;
        this.type = type;
        this.node = node;
        this.title = null;
        this.computedNumber = null;

        this.spareSpan = DOM.createElement(document,"SPAN");
        DOM.appendChild(this.spareSpan,DOM.createTextNode(document,""));
        let spanClass: string = null;
        if (this.type == "section")
            spanClass = Types.Keys.HEADING_NUMBER;
        else if (this.type == "figure")
            spanClass = Types.Keys.FIGURE_NUMBER;
        else if (this.type == "table")
            spanClass = Types.Keys.TABLE_NUMBER;
        DOM.setAttribute(this.spareSpan,"class",spanClass);

        // titleNode
        if (this.type == "figure") {
            this.spareTitle = DOM.createElement(document,"FIGCAPTION");
        }
        else if (this.type == "table") {
            this.spareTitle = DOM.createElement(document,"CAPTION");
        }

        this.prev = null;
        this.next = null;
        this.modificationListener = function(event) { itemModified(item); }

        itemsByNode.put(this.node,this);

        Object.seal(this);
        return;

        function generateItemId(): string {
            let id: string;
            do {
                id = "item"+(nextItemId++);
            } while (document.getElementById(id) != null);
            return id;
        }
    }

}

function OutlineItem_getTitleNode(item: OutlineItem, create?: boolean): HTMLElement {
    if (item.type == "section") {
        return item.node;
    }
    else if (item.type == "figure") {
        let titleNode = findChild(item.node,ElementTypes.HTML_FIGCAPTION);
        if ((titleNode == null) && create) {
            titleNode = item.spareTitle;
            DOM.appendChild(item.node,titleNode);
        }
        return titleNode;
    }
    else if (item.type == "table") {
        let titleNode = findChild(item.node,ElementTypes.HTML_CAPTION);
        if ((titleNode == null) && create) {
            titleNode = item.spareTitle;
            DOM.insertBefore(item.node,titleNode,item.node.firstChild);
        }
        return titleNode;
    }

    function findChild(node: HTMLElement, type: number): HTMLElement {
        for (let child = node.firstChild; child != null; child = child.nextSibling) {
            if ((child instanceof HTMLElement) && (child._type == type))
                return child;
        }
        return null;
    }
}

function OutlineItem_updateItemTitle(item: OutlineItem): void {
    let titleNode = OutlineItem_getTitleNode(item,false);
    let newTitle: string;
    if (titleNode != null)
        newTitle = Util.normalizeWhitespace(Traversal.getNodeText(titleNode));
    else
        newTitle = "";

    if (item.title != newTitle) {
        UndoManager.addAction(Callbacks.updateOutlineItem,item.id,item.title);
        Callbacks.updateOutlineItem(item.id,newTitle);
        item.title = newTitle;
        item.category.tocs.forEach(function(node: Node, toc: TOC) {
            TOC_updateOutlineItem(toc,item.id,item.title);
        });
    }
}

function getNodeTextAfter(node: Node): string {
    let text = "";
    for (let child = node.nextSibling; child != null; child = child.nextSibling)
        text += Traversal.getNodeText(child);
    return text;
}

// private
function itemModified(item: OutlineItem): void {
    if (UndoManager.isActive())
        return;
    if (ignoreModifications > 0)
        return;
    OutlineItem_updateItemTitle(item);
    updateRefsForItem(item);
}

function addRefForId(id: string, node: HTMLElement): void {
    UndoManager.addAction(removeRefForId,id,node);
    if (refsById[id] == null)
        refsById[id] = new Array();
    refsById[id].push(node);
}

function removeRefForId(id: string, node: HTMLElement): void {
    UndoManager.addAction(addRefForId,id,node);
    if (refsById[id] == null)
        throw new Error("refRemoved: refsById["+id+"] is null");
    let index = refsById[id].indexOf(node);
    if (index < 0)
        throw new Error("refRemoved: refsById["+id+"] does not contain node");
    refsById[id].splice(index,1);
    if (refsById[id] == null)
        delete refsById[id];
}

// private
function refInserted(node: HTMLElement): void {
    let href = node.getAttribute("href");
    if (href.charAt(0) != "#")
        throw new Error("refInserted: not a # reference");
    let id = href.substring(1);
    addRefForId(id,node);
    scheduleUpdateStructure();
}

// private
function refRemoved(node: HTMLElement): void {
    let href = node.getAttribute("href");
    if (href.charAt(0) != "#")
        throw new Error("refInserted: not a # reference");
    let id = href.substring(1);
    removeRefForId(id,node);
}

// private
function acceptNode(node: Node): boolean {
    for (let p = node; p != null; p = p.parentNode) {
        if ((p instanceof HTMLSpanElement) && (p.getAttribute("class") == Types.Keys.HEADING_NUMBER))
            return false;
    }
    return true;
}

// private
function docNodeInserted(event: any): void { // FIXME: TS: event parameter
    if (UndoManager.isActive())
        return;
    if (DOM.getIgnoreMutations())
        return;
    try {
        if (!acceptNode(event.target))
            return;
        recurse(event.target);
    }
    catch (e) {
        Callbacks.error(e);
    }

    function recurse(node: Node): void {
        if (node instanceof HTMLElement) {
            switch (node._type) {
            case ElementTypes.HTML_H1:
            case ElementTypes.HTML_H2:
            case ElementTypes.HTML_H3:
            case ElementTypes.HTML_H4:
            case ElementTypes.HTML_H5:
            case ElementTypes.HTML_H6: {
                if (!Types.isInTOC(node))
                    Category_add(sections,node);
                break;
            }
            case ElementTypes.HTML_FIGURE:
                Category_add(figures,node);
                break;
            case ElementTypes.HTML_TABLE:
                Category_add(tables,node);
                break;
            case ElementTypes.HTML_A: {
                if (Types.isRefNode(node) && !Types.isInTOC(node)) {
                    refInserted(node);
                }
                break;
            }
            case ElementTypes.HTML_NAV: {
                let cls = node.getAttribute("class");
                if (cls == Types.Keys.SECTION_TOC)
                    Category_addTOC(sections,node);
                else if (cls == Types.Keys.FIGURE_TOC)
                    Category_addTOC(figures,node);
                else if (cls == Types.Keys.TABLE_TOC)
                    Category_addTOC(tables,node);
                break;
            }
            }
        }

        let next: Node;
        for (let child = node.firstChild; child != null; child = next) {
            next = child.nextSibling;
            recurse(child);
        }
    }
}

// private
function docNodeRemoved(event: any): void {
    if (UndoManager.isActive())
        return;
    if (DOM.getIgnoreMutations())
        return;
    try {
        if (!acceptNode(event.target))
            return;
        recurse(event.target);
    }
    catch (e) {
        Callbacks.error(e);
    }

    function recurse(node: Node): void {
        if (node instanceof HTMLElement) {
            switch (node._type) {
            case ElementTypes.HTML_H1:
            case ElementTypes.HTML_H2:
            case ElementTypes.HTML_H3:
            case ElementTypes.HTML_H4:
            case ElementTypes.HTML_H5:
            case ElementTypes.HTML_H6:
                if (!Types.isInTOC(node))
                    Category_remove(sections,node);
                break;
            case ElementTypes.HTML_FIGURE:
                Category_remove(figures,node);
                break;
            case ElementTypes.HTML_TABLE:
                Category_remove(tables,node);
                break;
            case ElementTypes.HTML_A:
                if (Types.isRefNode(node) && !Types.isInTOC(node))
                    refRemoved(node);
                break;
            case ElementTypes.HTML_NAV:
                let cls = node.getAttribute("class");
                if (cls == Types.Keys.SECTION_TOC)
                    Category_removeTOC(sections,node);
                else if (cls == Types.Keys.FIGURE_TOC)
                    Category_removeTOC(figures,node);
                else if (cls == Types.Keys.TABLE_TOC)
                    Category_removeTOC(tables,node);
                break;
            }
        }

        for (let child = node.firstChild; child != null; child = child.nextSibling)
            recurse(child);
    }
}

// private
export function scheduleUpdateStructure(): void {
    if (UndoManager.isActive())
        return;
    if (!outlineDirty) {
        outlineDirty = true;
        PostponedActions.add(updateStructure);
    }
}

// private
function updateStructure(): void {
    if (!outlineDirty)
        return;
    outlineDirty = false;
    if (UndoManager.isActive())
        throw new Error("Structure update event while undo or redo active");
    Selection.preserveWhileExecuting(function() {
        updateStructureReal();
    });
}

class Shadow {

    public node: HTMLElement;
    public item: OutlineItem;
    public children: Shadow[];
    public parent: Shadow;
    public level: number;
    public nextChildSectionNumber: number;

    constructor(node: HTMLElement) {
        this.node = node;
        this.item = itemsByNode.get(node);
        this.children = [];
        this.parent = null;

        switch (node._type) {
        case ElementTypes.HTML_H1:
            this.level = 1;
            break;
        case ElementTypes.HTML_H2:
            this.level = 2;
            break;
        case ElementTypes.HTML_H3:
            this.level = 3;
            break;
        case ElementTypes.HTML_H4:
            this.level = 4;
            break;
        case ElementTypes.HTML_H5:
            this.level = 5;
            break;
        case ElementTypes.HTML_H6:
            this.level = 6;
            break;
        default:
            this.level = 0;
            break;
        }
    }

}

function Shadow_last(shadow: Shadow): Shadow {
    if (shadow.children.length == 0)
        return shadow;
    else
        return Shadow_last(shadow.children[shadow.children.length-1]);
}

function Shadow_outerNext(shadow: Shadow, structure: Structure): Shadow {
    let last = Shadow_last(shadow);
    if (last == null)
        return null;
    else if (last.item.next == null)
        return null;
    else
        return structure.shadowsByNode.get(last.item.next.node);
}

function firstTextDescendant(node: Node): Text {
    if (node instanceof Text)
        return node;
    for (let child = node.firstChild; child != null; child = child.nextSibling) {
        let result = firstTextDescendant(child);
        if (result != null)
            return result;
    }
    return null;
}

class Structure {

    public toplevelSections: Shadow[];
    public toplevelFigures: Shadow[];
    public toplevelTables: Shadow[];
    public shadowsByNode: Collections.NodeMap<Shadow>;

    constructor() {
        this.toplevelSections = new Array<Shadow>();
        this.toplevelFigures = new Array<Shadow>();
        this.toplevelTables = new Array<Shadow>();
        this.shadowsByNode = new Collections.NodeMap<Shadow>();
    }

}

function discoverStructure(): Structure {
    let structure = new Structure();
    let nextToplevelSectionNumber = 1;
    let nextFigureNumber = 1;
    let nextTableNumber = 1;
    let headingNumbering = Styles.headingNumbering();

    let counters = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, table: 0, figure: 0 };

    let current: Shadow = null;

    for (let section = sections.list.first; section != null; section = section.next) {
        structure.shadowsByNode.put(section.node,new Shadow(section.node));
    }
    for (let figure = figures.list.first; figure != null; figure = figure.next) {
        structure.shadowsByNode.put(figure.node,new Shadow(figure.node));
    }
    for (let table = tables.list.first; table != null; table = table.next) {
        structure.shadowsByNode.put(table.node,new Shadow(table.node));
    }

    for (let section = sections.list.first; section != null; section = section.next) {
        let shadow = structure.shadowsByNode.get(section.node);
        shadow.parent = null;
        shadow.children = [];
        shadow.nextChildSectionNumber = 1;
    }

    ignoreModifications++;

    for (let section = sections.list.first; section != null; section = section.next) {
        let shadow = structure.shadowsByNode.get(section.node);
        let node = section.node;
        let item = shadow.item;

        if (!headingNumbering || (DOM.getAttribute(item.node,"class") == "Unnumbered")) {
            item.computedNumber = null;
        }
        else {
            let level = parseInt(node.nodeName.charAt(1));
            counters[node.nodeName.toLowerCase()]++;
            for (let inner = level+1; inner <= 6; inner++)
                counters["h"+inner] = 0;
            item.computedNumber = "";
            for (let i = 1; i <= level; i++) {
                if (i == 1)
                    item.computedNumber += counters["h"+i];
                else
                    item.computedNumber += "." + counters["h"+i];
            }
        }

        while ((current != null) && (shadow.level < current.level+1))
            current = current.parent;

        shadow.parent = current;
        if (current == null)
            structure.toplevelSections.push(shadow);
        else
            current.children.push(shadow);

        current = shadow;
    }

    for (let figure = figures.list.first; figure != null; figure = figure.next) {
        let shadow = structure.shadowsByNode.get(figure.node);
        let item = shadow.item;

        let titleNode = OutlineItem_getTitleNode(item,false);
        if ((titleNode == null) || DOM.getAttribute(titleNode,"class") == "Unnumbered") {
            item.computedNumber = null;
        }
        else {
            counters.figure++;
            item.computedNumber = ""+counters.figure;
        }

        structure.toplevelFigures.push(shadow);
    }

    for (let table = tables.list.first; table != null; table = table.next) {
        let shadow = structure.shadowsByNode.get(table.node);
        let item = shadow.item;

        let titleNode = OutlineItem_getTitleNode(item,false);
        if ((titleNode == null) || DOM.getAttribute(titleNode,"class") == "Unnumbered") {
            item.computedNumber = null;
        }
        else {
            counters.table++;
            item.computedNumber = ""+counters.table;
        }

        structure.toplevelTables.push(shadow);
    }

    ignoreModifications--;

    return structure;
}

function updateStructureReal(pageNumbers?: Collections.NodeMap<number>): void {
    let structure = discoverStructure();

    for (let section = sections.list.first; section != null; section = section.next) {
        let shadow = structure.shadowsByNode.get(section.node);
        updateRefsForItem(shadow.item);
    }

    for (let figure = figures.list.first; figure != null; figure = figure.next) {
        let shadow = structure.shadowsByNode.get(figure.node);
        updateRefsForItem(shadow.item);
    }

    for (let table = tables.list.first; table != null; table = table.next) {
        let shadow = structure.shadowsByNode.get(table.node);
        updateRefsForItem(shadow.item);
    }

    sections.tocs.forEach(function (node: Node, toc: TOC) {
        TOC_updateStructure(toc,structure,structure.toplevelSections,pageNumbers);
    });
    figures.tocs.forEach(function (node: Node, toc: TOC) {
        TOC_updateStructure(toc,structure,structure.toplevelFigures,pageNumbers);
    });
    tables.tocs.forEach(function (node: Node, toc: TOC) {
        TOC_updateStructure(toc,structure,structure.toplevelTables,pageNumbers);
    });

    Callbacks.outlineUpdated();
}

export interface EncodedOutline {
    sections: EncodedOutlineItem[];
    figures: EncodedOutlineItem[];
    tables: EncodedOutlineItem[];
}

export interface EncodedOutlineItem {
    id: string;
    number: string;
    children: EncodedOutlineItem[];
}

export function getOutline(): EncodedOutline {
    let structure = discoverStructure();
    let encSections = new Array<EncodedOutlineItem>();
    let encFigures = new Array<EncodedOutlineItem>();
    let encTables = new Array<EncodedOutlineItem>();

    for (let i = 0; i < structure.toplevelSections.length; i++)
        encodeShadow(structure.toplevelSections[i],encSections);
    for (let i = 0; i < structure.toplevelFigures.length; i++)
        encodeShadow(structure.toplevelFigures[i],encFigures);
    for (let i = 0; i < structure.toplevelTables.length; i++)
        encodeShadow(structure.toplevelTables[i],encTables);

    return { sections: encSections,
             figures: encFigures,
             tables: encTables };

    function encodeShadow(shadow: Shadow, result: EncodedOutlineItem[]): void {
        let encChildren = new Array<EncodedOutlineItem>();
        for (let i = 0; i < shadow.children.length; i++)
            encodeShadow(shadow.children[i],encChildren);

        let obj = { id: shadow.item.id,
                    number: shadow.item.computedNumber ? shadow.item.computedNumber : "",
                    children: encChildren };
        result.push(obj);
    }
}

function updateRefsForItem(item: OutlineItem): void {
    let id = item.node.getAttribute("id");
    let refs = refsById[id];
    if (refs == null)
        return;
    for (let i = 0; i < refs.length; i++) {
        DOM.deleteAllChildren(refs[i]);
        let text: string = null;

        let className = DOM.getAttribute(refs[i],"class");
        if (className == "uxwrite-ref-num") {
            text = item.computedNumber;
        }
        else if (className == "uxwrite-ref-text") {
            if (item.type == "section") {
                if (item.numberSpan != null)
                    text = getNodeTextAfter(item.numberSpan);
                else
                    text = Util.normalizeWhitespace(Traversal.getNodeText(item.node));
            }
            else if ((item.type == "figure") || (item.type == "table")) {
                let titleNode = OutlineItem_getTitleNode(item,false);
                if (titleNode != null) {
                    text = Traversal.getNodeText(titleNode);

                    if ((item.computedNumber != null) && (item.type == "figure"))
                        text = "Figure "+item.computedNumber+": "+text;
                    else if ((item.computedNumber != null) && (item.type == "table"))
                        text = "Table "+item.computedNumber+": "+text;
                }
            }
        }
        else if (className == "uxwrite-ref-caption-text") {
            if (item.type == "section") {
                if (item.numberSpan != null)
                    text = getNodeTextAfter(item.numberSpan);
                else
                    text = Util.normalizeWhitespace(Traversal.getNodeText(item.node));
            }
            else if ((item.type == "figure") || (item.type == "table")) {
                let titleNode = OutlineItem_getTitleNode(item,false);
                if (titleNode != null) {
                    if (item.numberSpan != null)
                        text = getNodeTextAfter(item.numberSpan);
                    else
                        text = Util.normalizeWhitespace(Traversal.getNodeText(titleNode));
                }
            }
        }
        else if (className == "uxwrite-ref-label-num") {
            if (item.computedNumber != null) {
                if (item.type == "section")
                    text = "Section "+item.computedNumber;
                else if (item.type == "figure")
                    text = "Figure "+item.computedNumber;
                else if (item.type == "table")
                    text = "Table "+item.computedNumber;
            }
        }
        else {
            if (item.computedNumber != null)
                text = item.computedNumber;
            else
                text = item.title;
        }

        if (text == null)
            text = "?";

        DOM.appendChild(refs[i],DOM.createTextNode(document,text));
    }
}

export function plainText(): string {
    let strings = new Array();
    let structure = discoverStructure();

    strings.push("Sections:\n");
    for (let section = sections.list.first; section != null; section = section.next) {
        let shadow = structure.shadowsByNode.get(section.node);
        if (shadow.level == 1)
            printSectionRecursive(shadow,"    ");
    }
    strings.push("Figures:\n");
    for (let figure = figures.list.first; figure != null; figure = figure.next) {
        let shadow = structure.shadowsByNode.get(figure.node);
        let titleNode = OutlineItem_getTitleNode(figure,false);
        let title = titleNode ? Traversal.getNodeText(titleNode) : "[no caption]";
        if (shadow.item.computedNumber != null) {
            if (title.length > 0)
                title = shadow.item.computedNumber+" "+title;
            else
                title = shadow.item.computedNumber;
        }
        strings.push("    "+title+" ("+figure.id+")\n");
    }
    strings.push("Tables:\n");
    for (let table = tables.list.first; table != null; table = table.next) {
        let shadow = structure.shadowsByNode.get(table.node);
        let titleNode = OutlineItem_getTitleNode(table,false);
        let title = titleNode ? Traversal.getNodeText(titleNode) : "[no caption]";
        if (shadow.item.computedNumber != null) {
            if (title.length > 0)
                title = shadow.item.computedNumber+" "+title;
            else
                title = shadow.item.computedNumber;
        }
        strings.push("    "+title+" ("+table.id+")\n");
    }
    return strings.join("");

    function printSectionRecursive(shadow: Shadow, indent: string): void {
        let titleNode = OutlineItem_getTitleNode(shadow.item,false);
        let content = Traversal.getNodeText(titleNode);
        if (shadow.item.computedNumber != null)
            content = shadow.item.computedNumber+" "+content;
        if (Util.isWhitespaceString(content))
            content = "[empty]";
        strings.push(indent+content+" ("+shadow.item.id+")\n");
        for (let i = 0; i < shadow.children.length; i++)
            printSectionRecursive(shadow.children[i],indent+"    ");
    }
}

// public
export function init(): void {
    Selection.preserveWhileExecuting(function() {

        function isTableNode(node: HTMLElement): boolean {
            return (node._type == ElementTypes.HTML_TABLE);
        }

        function isFigureNode(node: HTMLElement): boolean {
            return (node._type == ElementTypes.HTML_FIGURE);
        }

        function isNonTOCHeadingNode(node: HTMLElement): boolean {
            return (Types.HEADING_ELEMENTS[node._type] && !Types.isInTOC(node));
        }

        sections = new Category("section",isNonTOCHeadingNode,sectionNumberRegex);
        figures = new Category("figure",isFigureNode,figureNumberRegex);
        tables = new Category("table",isTableNode,tableNumberRegex);
        itemsByNode = new Collections.NodeMap<OutlineItem>();
        refsById = {};

        DOM.ensureUniqueIds(document.documentElement);
        document.addEventListener("DOMNodeInserted",docNodeInserted);
        document.addEventListener("DOMNodeRemoved",docNodeRemoved);

        docNodeInserted({target:document});
    });
    doneInit = true;
}

// public (for the undo tests, when they report results)
export function removeListeners(): void {
    document.removeEventListener("DOMNodeInserted",docNodeInserted);
    document.removeEventListener("DOMNodeRemoved",docNodeRemoved);

    removeCategoryListeners(sections);
    removeCategoryListeners(figures);
    removeCategoryListeners(tables);

    function removeCategoryListeners(category: Category): void {
        for (let item = category.list.first; item != null; item = item.next)
            item.node.removeEventListener("DOMSubtreeModified",item.modificationListener);
    }
}

// private
function getShadowNodes(structure: Structure, shadow: Shadow, result: Node[]): void {
    let endShadow = Shadow_outerNext(shadow,structure);
    let endNode = endShadow ? endShadow.item.node : null;
    for (let n: Node = shadow.item.node; (n != null) && (n != endNode); n = n.nextSibling)
        result.push(n);
}

// public
export function moveSection(sectionId: string, parentId: string, nextId: string): void {
    UndoManager.newGroup("Move section");
    Selection.clear();

    updateStructure(); // make sure pointers are valid
    // FIXME: I don't think we'll need the updateStructure() call now that we have
    // discoverStructure(). In fact this function is a perfect illustration of why
    // waiting till after the postponed action has been performed before relying on the
    // pointer validity was a problem.


    let structure = discoverStructure();

    let node = document.getElementById(sectionId);
    let section = itemsByNode.get(node);
    let shadow = structure.shadowsByNode.get(node);

    // FIXME: We should throw an exception if a parentId or nextId which does not exist
    // in the document is specified. However there are currently some tests (like
    // moveSection-nested*) which rely us interpreting such parameters as null.
    let parentNode = parentId ? document.getElementById(parentId) : null;
    let nextNode = nextId ? document.getElementById(nextId) : null;
    let parent = parentNode ? structure.shadowsByNode.get(parentNode) : null;
    let next = nextNode ? structure.shadowsByNode.get(nextNode) : null;

    let sectionNodes = new Array<Node>();
    getShadowNodes(structure,shadow,sectionNodes);

    if ((next == null) && (parent != null))
        next = Shadow_outerNext(parent,structure);

    if (next == null) {
        for (let i = 0; i < sectionNodes.length; i++)
            DOM.appendChild(document.body,sectionNodes[i]);
    }
    else {
        for (let i = 0; i < sectionNodes.length; i++)
            DOM.insertBefore(next.item.node.parentNode,sectionNodes[i],next.item.node);
    }

    let pos = new Position(node,0);
    pos = Position.closestMatchForwards(pos,Position.okForInsertion);
    Selection.set(pos.node,pos.offset,pos.node,pos.offset);

    scheduleUpdateStructure();
    PostponedActions.add(UndoManager.newGroup);
}

// public
export function deleteItem(itemId: string): void {
    UndoManager.newGroup("Delete outline item");
    let structure = discoverStructure();
    Selection.preserveWhileExecuting(function() {
        let node = document.getElementById(itemId);
        let item = itemsByNode.get(node);
        let shadow = structure.shadowsByNode.get(item.node);
        if (item.type == "section") {
            let sectionNodes = new Array();
            getShadowNodes(structure,shadow,sectionNodes);
            for (let i = 0; i < sectionNodes.length; i++)
                DOM.deleteNode(sectionNodes[i]);
        }
        else {
            DOM.deleteNode(item.node);
        }
    });

    // Ensure the cursor or selection start/end positions are valid positions that the
    // user is allowed to move to. This ensures we get an accurate rect for each position,
    // avoiding an ugly effect where the cursor occupies the entire height of the document
    // and is displayed on the far-left edge of the editing area.
    let selRange = Selection.get();
    if (selRange != null) {
        let start = Position.closestMatchForwards(selRange.start,Position.okForMovement);
        let end = Position.closestMatchForwards(selRange.end,Position.okForMovement);
        Selection.set(start.node,start.offset,end.node,end.offset);
    }

    scheduleUpdateStructure();
    PostponedActions.add(Cursor.ensureCursorVisible);
    PostponedActions.add(UndoManager.newGroup);
}

// public
export function goToItem(itemId: string): void {
    if (itemId == null) {
        window.scrollTo(0);
    }
    else {
        let node = document.getElementById(itemId);
        if (node == null) {
            // FIXME: this can happen if the user added some headings, pressed undo one or
            // more times (in which case the editor's view of the outline structure fails to
            // be updated), and then they click on an item. This is really an error but we
            // handle it gracefully for now rather than causing a null pointer exception to
            // be thrown.
            return;
        }
        let position = new Position(node,0);
        position = Position.closestMatchForwards(position,Position.okForMovement);
        Selection.set(position.node,position.offset,position.node,position.offset);

        let section = document.getElementById(itemId);
        let location = webkitConvertPointFromNodeToPage(section,new WebKitPoint(0,0));
        window.scrollTo(0,location.y);
    }
}

// public
export function getItemElement(itemId: string): HTMLElement {
    return document.getElementById(itemId);
}

// public
export function setNumbered(itemId: string, numbered: boolean): void {
    let node = document.getElementById(itemId);
    let item = itemsByNode.get(node);

    Selection.preserveWhileExecuting(function() {
        if (item.type == "section") {
            if (numbered)
                DOM.removeAttribute(node,"class");
            else
                DOM.setAttribute(node,"class","Unnumbered");
        }
        else if ((item.type == "figure") || (item.type == "table")) {
            if (numbered) {
                let caption = OutlineItem_getTitleNode(item,true);
                DOM.removeAttribute(caption,"class");
            }
            else {
                let caption = OutlineItem_getTitleNode(item,false);
                if (caption != null) {
                    if (Types.nodeHasContent(caption))
                        DOM.setAttribute(caption,"class","Unnumbered");
                    else
                        DOM.deleteNode(caption);
                }
            }
        }
    });

    scheduleUpdateStructure();
}

// public
export function setTitle(itemId: string, title: string): void {
    let node = document.getElementById(itemId);
    let item = itemsByNode.get(node);
    Selection.preserveWhileExecuting(function() {
        let titleNode = OutlineItem_getTitleNode(item,true);
        let oldEmpty = (item.title == "");
        let newEmpty = (title == "");
        if (oldEmpty != newEmpty) {
            // Add or remove the : at the end of table and figure numbers
            scheduleUpdateStructure();
        }
        if (item.numberSpan != null) {
            while (item.numberSpan.nextSibling != null)
                DOM.deleteNode(item.numberSpan.nextSibling);
        }
        else {
            DOM.deleteAllChildren(titleNode);
        }
        DOM.appendChild(titleNode,DOM.createTextNode(document,title));
        OutlineItem_updateItemTitle(item);
    });
}

// private
// FIXME: prevent a TOC from being inserted inside a heading, figure, or table
function insertTOC(key: string): void {
    let div = DOM.createElement(document,"NAV");
    DOM.setAttribute(div,"class",key);
    Cursor.makeContainerInsertionPoint();
    Clipboard.pasteNodes([div]);
}

// public
export function insertTableOfContents(): void {
    insertTOC(Types.Keys.SECTION_TOC);
}

// public
export function insertListOfFigures(): void {
    insertTOC(Types.Keys.FIGURE_TOC);
}

// public
export function insertListOfTables(): void {
    insertTOC(Types.Keys.TABLE_TOC);
}

// public
export function setPrintMode(newPrintMode: boolean): void {
    printMode = newPrintMode;
    scheduleUpdateStructure();
}

export interface PrintLayoutInfo {
    destsByPage: {
        [key: string]: {
            itemId: string;
            x: number;
            y: number }[]
        };
    linksByPage: {
        [key: string]: {
            pageNo: number;
            left: number;
            top: number;
            width: number;
            height: number;
            href: string }[]
         };
    leafRectsByPage: {
        [key: string]: {
            left: number;
            top: number;
            width: number;
            height: number; }[]
        };
}

// public
export function examinePrintLayout(pageHeight: number): PrintLayoutInfo {
    let structure = discoverStructure();
    let pageNumbers = new Collections.NodeMap<number>();
    let result: PrintLayoutInfo = {
        destsByPage: {},
        linksByPage: {},
        leafRectsByPage: {}
    }

    itemsByNode.forEach(function(node: HTMLElement, item: OutlineItem) {
        let rect = node.getBoundingClientRect();
        let pageNo = 1+Math.floor(rect.top/pageHeight);
        let pageTop = (pageNo-1)*pageHeight;
        let id = node.getAttribute("id");
        pageNumbers.put(node,pageNo);

        if (result.destsByPage[pageNo] == null)
            result.destsByPage[pageNo] = [];
        result.destsByPage[pageNo].push({ itemId: id,
                                          x: rect.left,
                                          y: rect.top - pageTop});
    });

    let links = document.getElementsByTagName("A");
    for (let i = 0; i < links.length; i++) {
        let a = links[i];

        if (!a.hasAttribute("href"))
            continue;

        let offset = Traversal.nodeOffset(a);
        let range = new Range(a.parentNode,offset,a.parentNode,offset+1);
        let rects = Range.getClientRects(range);
        for (let rectIndex = 0; rectIndex < rects.length; rectIndex++) {
            let rect = rects[rectIndex];
            let pageNo = 1+Math.floor(rect.top/pageHeight);
            let pageTop = (pageNo-1)*pageHeight;

            if (result.linksByPage[pageNo] == null)
                result.linksByPage[pageNo] = new Array();
            result.linksByPage[pageNo].push({ pageNo: pageNo,
                                              left: rect.left,
                                              top: rect.top - pageTop,
                                              width: rect.width,
                                              height: rect.height,
                                              href: a.getAttribute("href"), });
        }
    }

    recurse(document.body);

    updateStructureReal(pageNumbers);
    return result;


    function recurse(node: Node): void {
        if (node.firstChild == null) {
            let offset = Traversal.nodeOffset(node);
            let range = new Range(node.parentNode,offset,node.parentNode,offset+1);
            let rects = Range.getClientRects(range);
            for (let i = 0; i < rects.length; i++) {
                let rect = rects[i];

                let pageNo = 1+Math.floor(rect.top/pageHeight);
                let pageTop = (pageNo-1)*pageHeight;

                if (result.leafRectsByPage[pageNo] == null)
                    result.leafRectsByPage[pageNo] = new Array();
                result.leafRectsByPage[pageNo].push({ left: rect.left,
                                                      top: rect.top - pageTop,
                                                      width: rect.width,
                                                      height: rect.height });
            }
        }

        for (let child = node.firstChild; child != null; child = child.nextSibling)
            recurse(child);
    }
}

export function setReferenceTarget(node: HTMLElement, itemId: string): void {
    Selection.preserveWhileExecuting(function() {
        refRemoved(node);
        DOM.setAttribute(node,"href","#"+itemId);
        refInserted(node);
    });
}

export function detectSectionNumbering(): boolean {
    let sectionNumbering = detectNumbering(sections);
    if (sectionNumbering)
        makeNumberingExplicit(sections);
    makeNumberingExplicit(figures);
    makeNumberingExplicit(tables);
    return sectionNumbering;
}

function detectNumbering(category: Category): boolean {
    for (let item = category.list.first; item != null; item = item.next) {

        let firstText: Text = null;
        let titleNode = OutlineItem_getTitleNode(item);

        if (titleNode != null)
            firstText = findFirstTextDescendant(titleNode);
        if (firstText != null) {
            let regex = category.numberRegex;
            let str = firstText.nodeValue;
            if (str.match(category.numberRegex))
                return true;
        }
    }
}

function makeNumberingExplicit(category: Category): void {
    for (let item = category.list.first; item != null; item = item.next) {
        let firstText: Text = null;
        let titleNode = OutlineItem_getTitleNode(item);

        if (titleNode != null)
            firstText = findFirstTextDescendant(titleNode);
        if (firstText != null) {
            let regex = category.numberRegex;
            let str = firstText.nodeValue;
            if (str.match(category.numberRegex)) {
                let oldValue = str;
                let newValue = str.replace(category.numberRegex,"");
                DOM.setNodeValue(firstText,newValue);
            }
            else {
                let titleNode = OutlineItem_getTitleNode(item,true);
                if (titleNode != null)
                    DOM.setAttribute(titleNode,"class","Unnumbered");
            }
        }
    }
}

// Search through the document for any elements corresponding to built-in styles that are
// normally latent (i.e. only included in the stylesheet if used)
export function findUsedStyles(): { [key: string]: boolean } {
    let used: { [key: string]: boolean } = {};
    recurse(document.body);
    return used;

    function recurse(node: Node): void {
        if (node instanceof HTMLElement) {
        switch (node._type) {
            case ElementTypes.HTML_NAV: {
                let className = DOM.getAttribute(node,"class");
                if ((className == "tableofcontents") ||
                    (className == "listoffigures") ||
                    (className == "listoftables")) {
                    used["nav."+className] = true;
                }
                break;
            }
            case ElementTypes.HTML_FIGCAPTION:
            case ElementTypes.HTML_CAPTION:
            case ElementTypes.HTML_H1:
            case ElementTypes.HTML_H2:
            case ElementTypes.HTML_H3:
            case ElementTypes.HTML_H4:
            case ElementTypes.HTML_H5:
            case ElementTypes.HTML_H6: {
                let elementName = node.nodeName.toLowerCase();
                let className = DOM.getAttribute(node,"class");
                if ((className == null) || (className == ""))
                    used[elementName] = true;
                else if (className == "Unnumbered")
                    used[elementName+".Unnumbered"] = true;
                break;
            }
            }
        }

        for (let child = node.firstChild; child != null; child = child.nextSibling)
            recurse(child);
    }
}
