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
import Editor = require("./editor");
import ElementTypes = require("./elementTypes");
import Types = require("./types");

export function debug(str: any): void {
    Editor.debug(""+str);
}

export function arrayContains<T>(array: T[], value: T): boolean {
    for (let i = 0; i < array.length; i++) {
        if (array[i] == value)
            return true;
    }
    return false;
}

export function arrayCopy<T>(array: T[]): T[] {
    if (array == null)
        return null;
    let copy = new Array<T>();
    for (let i = 0; i < array.length; i++)
        copy.push(array[i]);
    return copy;
}

export function quoteString(str: string): string {
    if (str == null)
        return null;

    if (str.indexOf('"') < 0)
        return str;

    let quoted = "";
    for (let i = 0; i < str.length; i++) {
        if (str.charAt(i) == '"')
            quoted += "\\\"";
        else
            quoted += str.charAt(i);
    }
    return quoted;
}

export function nodeString(node: Node): string {
    if (node == null)
        return "null";
    let id = "";
    if (debugIds)
        id = node._nodeId+":";
    if (node instanceof Text) {
        return id+JSON.stringify(node.nodeValue);
    }
    else if (node instanceof Element) {
        let name = (node.namespaceURI == null) ? node.nodeName.toUpperCase() : node.nodeName;
        if (node.hasAttribute("id"))
            return id+name+"#"+node.getAttribute("id");
        else
            return id+name;
    }
    else {
        return id+node.toString();
    }
}

export function rectString(rect: ClientRect): string {
    if (rect == null)
        return null;
    else
        return "("+rect.left+","+rect.top+") - ("+rect.right+","+rect.bottom+")";
}

export function rectIsEmpty(rect: ClientRect): boolean {
    return ((rect == null) ||
            ((rect.width == 0) && (rect.height == 0)));
}

export function rectContainsPoint(rect: ClientRect, x: number, y: number): boolean {
    return ((x >= rect.left) && (x < rect.right) &&
            (y >= rect.top) && (y < rect.bottom));
}

export function cloneStringDict<T>(object: { [key: string]: T }): { [key: string]: T } {
    let result: { [key: string]: T } = {};
    for (let name in object)
        result[name] = object[name];
    return result;
}

export function cloneNumberDict<T>(object: { [key: number]: T }): { [key: number]: T } {
    let result: { [key: number]: T } = {};
    for (let name in object)
        result[name] = object[name];
    return result;
}

export function nodeHasContent(node: Node): boolean {
    switch (node._type) {
    case ElementTypes.HTML_TEXT:
        return !isWhitespaceString(node.nodeValue);
    case ElementTypes.HTML_IMG:
    case ElementTypes.HTML_TABLE:
        return true;
    default:
        if (Types.isOpaqueNode(node))
            return true;

        for (let child = node.firstChild; child != null; child = child.nextSibling) {
            if (nodeHasContent(child))
                return true;
        }
        return false;
    }
}

let isWhitespaceStringRegexp = /^\s*$/;

export function isWhitespaceString(str: string): boolean {
    return (str.match(isWhitespaceStringRegexp) != null);
}

export function normalizeWhitespace(str: string): string {
    str = str.replace(/^\s+/,"");
    str = str.replace(/\s+$/,"");
    str = str.replace(/\s+/g," ");
    return str;
}

export interface DoublyLinkedListItem<T> {
    prev: T;
    next: T;
}

export class DoublyLinkedList<T extends DoublyLinkedListItem<any>> {

    public first: T;
    public last: T;

    constructor() {
        this.first = null;
        this.last = null;
    }

    public insertAfter(item: T, after: T): void {
        item.prev = null;
        item.next = null;

        if (this.first == null) { // empty list
            this.first = item;
            this.last = item;
        }
        else if (after == null) { // insert at start
            item.next = this.first;
            this.first = item;
        }
        else {
            item.next = after.next;
            item.prev = after;
            if (this.last == after)
                this.last = item;
        }

        if (item.next != null)
            item.next.prev = item;
        if (item.prev != null)
            item.prev.next = item;
    }

    public remove(item: T): void {
        if (this.first == item)
            this.first = this.first.next;
        if (this.last == item)
            this.last = this.last.prev;
        if (item.prev != null)
            item.prev.next = item.next;
        if (item.next != null)
            item.next.prev = item.prev;
        item.prev = null;
        item.next = null;
    }

}

export class DiffEntry<T> {

    constructor(
        public srcStart: number,
        public destStart: number,
        public srcEnd: number,
        public destEnd: number,
        public prev: DiffEntry<T>)
    { }

}

export function diff<T>(src: T[], dest: T[]): DiffEntry<T>[] {
    let traces = new Array();

    traces[1] = new DiffEntry(0,0,0,0,null);

    for (let distance = 0; true; distance++) {
        for (let k = -distance; k <= distance; k += 2) {
            let srcEnd: number;
            let prev: DiffEntry<T>;

            let del = traces[k-1];
            let ins = traces[k+1];

            if (((k == -distance) && ins) ||
                ((k != distance) && ins && del && (del.srcEnd < ins.srcEnd))) {
                // Down - insertion
                prev = ins;
                srcEnd = prev.srcEnd;
            }
            else if (del) {
                // Right - deletion
                prev = del;
                srcEnd = prev.srcEnd+1;
            }
            else {
                traces[k] = null;
                continue;
            }

            let destEnd = srcEnd - k;
            let srcStart = srcEnd;
            let destStart = destEnd;
            while ((srcEnd < src.length) && (destEnd < dest.length) &&
                   (src[srcEnd] == dest[destEnd])) {
                srcEnd++;
                destEnd++;
            }
            if ((srcEnd > src.length) || (destEnd > dest.length))
                traces[k] = null;
            else
                traces[k] = new DiffEntry(srcStart,destStart,srcEnd,destEnd,prev);
            if ((srcEnd >= src.length) && (destEnd >= dest.length)) {
                return entryToArray(src,dest,traces[k]);
            }
        }
    }

    function entryToArray(src: T[], dest: T[], entry: DiffEntry<T>): DiffEntry<T>[] {
        let results: DiffEntry<T>[] = [];
        results.push(entry);
        for (entry = entry.prev; entry != null; entry = entry.prev) {
            if ((entry.srcStart != entry.srcEnd) || (entry.destStart != entry.destEnd))
                results.push(entry);
        }
        return results.reverse();
    }
}

export class TimingEntry {

    public name: string;
    public time: number;

    constructor(name: string, time: number) {
        this.name = name;
        this.time = time;
    }

}

export class TimingInfo {

    public entries: TimingEntry[];
    public total: number;
    public lastTime: Date;

    constructor() {
        this.entries = [];
        this.total = 0;
        this.lastTime = null;
    }

    public start(): void {
        this.entries.length = 0;
        this.lastTime = new Date();
    }

    public addEntry(name: string): void {
        if (this.lastTime == null)
            this.start();

        let now = new Date();
        let interval = now.getTime() - this.lastTime.getTime();
        this.entries.push(new TimingEntry(name,interval));
        this.total += interval;
        this.lastTime = now;
    }

    public print(title: string): void {
        debug(title);
        for (let i = 0; i < this.entries.length; i++) {
            let entry = this.entries[i];
            debug("    "+entry.name+": "+entry.time+"ms");
        }
    }

}

export function absElementRect(element: HTMLElement): ClientRect {
    let rect = element.getBoundingClientRect();
    return { left: rect.left + window.scrollX,
             top: rect.top + window.scrollY,
             right: rect.right + window.scrollX,
             bottom: rect.bottom + window.scrollY,
             width: rect.width,
             height: rect.height };
}

export let debugIds = false;
