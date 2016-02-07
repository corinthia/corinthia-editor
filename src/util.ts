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

export function debug(str) {
    Editor.debug(str);
}

export function arrayContains(array,value) {
    for (let i = 0; i < array.length; i++) {
        if (array[i] == value)
            return true;
    }
    return false;
}

// Note: you can use slice() to copy a real javascript array, but this function can be used to copy
// DOM NodeLists (e.g. as returned by document.getElementsByTagName) as well, since they don't
// support the slice method
export function arrayCopy(array) {
    if (array == null)
        return null;
    let copy = new Array();
    for (let i = 0; i < array.length; i++)
        copy.push(array[i]);
    return copy;
}

export function quoteString(str) {
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

export function nodeString(node) {
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

export function rectString(rect) {
    if (rect == null)
        return null;
    else
        return "("+rect.left+","+rect.top+") - ("+rect.right+","+rect.bottom+")";
}

export function rectIsEmpty(rect) {
    return ((rect == null) ||
            ((rect.width == 0) && (rect.height == 0)));
}

export function rectContainsPoint(rect,x,y) {
    return ((x >= rect.left) && (x < rect.right) &&
            (y >= rect.top) && (y < rect.bottom));
}

export function clone(object) {
    let result = new Object();
    for (let name in object)
        result[name] = object[name];
    return result;
}

export function nodeHasContent(node) {
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

export function isWhitespaceString(str) {
    return (str.match(isWhitespaceStringRegexp) != null);
}

export function normalizeWhitespace(str) {
    str = str.replace(/^\s+/,"");
    str = str.replace(/\s+$/,"");
    str = str.replace(/\s+/g," ");
    return str;
}

export function DoublyLinkedList() {
    this.first = null;
    this.last = null;
}

DoublyLinkedList.prototype.insertAfter = function(item,after) {
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
};

DoublyLinkedList.prototype.remove = function(item) {
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
};

export function diff(src,dest) {
    let traces = new Array();

    traces[1] = new DiffEntry(0,0,0,0,null);

    for (let distance = 0; true; distance++) {
        for (let k = -distance; k <= distance; k += 2) {
            let srcEnd;
            let prev;

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

    function DiffEntry(srcStart,destStart,srcEnd,destEnd,prev) {
        this.srcStart = srcStart;
        this.destStart = destStart;
        this.srcEnd = srcEnd;
        this.destEnd = destEnd;
        this.prev = prev;
    }

    function entryToArray(src,dest,entry) {
        let results = new Array();
        results.push(entry);
        for (entry = entry.prev; entry != null; entry = entry.prev) {
            if ((entry.srcStart != entry.srcEnd) || (entry.destStart != entry.destEnd))
                results.push(entry);
        }
        return results.reverse();
    }
}

export function TimingEntry(name,time) {
    this.name = name;
    this.time = time;
}

export function TimingInfo() {
    this.entries = new Array();
    this.total = 0;
    this.lastTime = null;
}

TimingInfo.prototype.start = function() {
    this.entries.length = 0;
    this.lastTime = new Date();
}

TimingInfo.prototype.addEntry = function(name) {
    if (this.lastTime == null)
        this.start();

    let now = new Date();
    let interval = now.getTime() - this.lastTime.getTime();
    this.entries.push(new TimingEntry(name,interval));
    this.total += interval;
    this.lastTime = now;
}

TimingInfo.prototype.print = function(title) {
    debug(title);
    for (let i = 0; i < this.entries.length; i++) {
        let entry = this.entries[i];
        debug("    "+entry.name+": "+entry.time+"ms");
    }
}

export function readFileApp(filename) {
    let req = new XMLHttpRequest();
    req.open("POST","/read/"+encodeURI(filename),false);
    req.send();
    if (req.status == 404)
        return null; // file not found
    else if ((req.status != 200) && (req.status != 0))
        throw new Error(req.status+": "+req.responseText);
    let doc = req.responseXML;
    if (doc != null)
        DOM.assignNodeIds(doc);
    return doc;
}

export function readFileTest(filename) {
    let req = new XMLHttpRequest();
    req.open("GET",filename,false);
    req.send();
    let xml = req.responseXML;
    if (xml == null)
        return null;
    DOM.assignNodeIds(xml.documentElement);
    return xml;
}

export function fromTokenList(value) {
    let result = new Object();
    if (value != null) {
        let components = value.toLowerCase().split(/\s+/);
        for (let i = 0; i < components.length; i++) {
            if (components[i].length > 0)
                result[components[i]] = true;
        }
    }
    return result;
}

export function toTokenList(properties) {
    let tokens = new Array();

    if (properties != null) {
        // Sort the names to ensure deterministic results in test cases
        let names = Object.getOwnPropertyNames(properties).sort();
        for (let i = 0; i < names.length; i++) {
            let name = names[i];
            if (properties[name])
                tokens.push(name);
        }
    }

    if (tokens.length == null)
        return null;
    else
        return tokens.join(" ");
}

export function xywhAbsElementRect(element) {
    let rect = element.getBoundingClientRect();
    return { x: rect.left + window.scrollX,
             y: rect.top + window.scrollY,
             width: rect.width,
             height: rect.height };
}

export let debugIds = false;
