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

(function(api) {

    var Util = api.Util; // export

    var DOM = api.DOM; // import
    var Types = api.Types; // import

    Util.arrayContains = function(array,value) {
        for (var i = 0; i < array.length; i++) {
            if (array[i] == value)
                return true;
        }
        return false;
    }

    // Note: you can use slice() to copy a real javascript array, but this function can be used to copy
    // DOM NodeLists (e.g. as returned by document.getElementsByTagName) as well, since they don't
    // support the slice method
    Util.arrayCopy = function(array) {
        if (array == null)
            return null;
        var copy = new Array();
        for (var i = 0; i < array.length; i++)
            copy.push(array[i]);
        return copy;
    }

    Util.quoteString = function(str) {
        if (str == null)
            return null;

        if (str.indexOf('"') < 0)
            return str;

        var quoted = "";
        for (var i = 0; i < str.length; i++) {
            if (str.charAt(i) == '"')
                quoted += "\\\"";
            else
                quoted += str.charAt(i);
        }
        return quoted;
    }

    Util.nodeString = function(node) {
        if (node == null)
            return "null";
        var id = "";
        if (window.debugIds)
            id = node._nodeId+":";
        if (node.nodeType == Node.TEXT_NODE) {
            return id+JSON.stringify(node.nodeValue);
        }
        else if (node.nodeType == Node.ELEMENT_NODE) {
            var name = (node.namespaceURI == null) ? node.nodeName.toUpperCase() : node.nodeName;
            if (node.hasAttribute("id"))
                return id+name+"#"+node.getAttribute("id");
            else
                return id+name;
        }
        else {
            return id+node.toString();
        }
    }

    Util.rectString = function(rect) {
        if (rect == null)
            return null;
        else
            return "("+rect.left+","+rect.top+") - ("+rect.right+","+rect.bottom+")";
    }

    Util.rectIsEmpty = function(rect) {
        return ((rect == null) ||
                ((rect.width == 0) && (rect.height == 0)));
    }

    Util.rectContainsPoint = function(rect,x,y) {
        return ((x >= rect.left) && (x < rect.right) &&
                (y >= rect.top) && (y < rect.bottom));
    }

    Util.clone = function(object) {
        var result = new Object();
        for (var name in object)
            result[name] = object[name];
        return result;
    }

    Util.nodeHasContent = function(node) {
        switch (node._type) {
        case HTML_TEXT:
            return !Util.isWhitespaceString(node.nodeValue);
        case HTML_IMG:
        case HTML_TABLE:
            return true;
        default:
            if (Types.isOpaqueNode(node))
                return true;

            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                if (Util.nodeHasContent(child))
                    return true;
            }
            return false;
        }
    }

    Util.isWhitespaceString = function(str) {
        return (str.match(Util.isWhitespaceString.regexp) != null);
    }

    Util.isWhitespaceString.regexp = /^\s*$/;

    Util.normalizeWhitespace = function(str) {
        str = str.replace(/^\s+/,"");
        str = str.replace(/\s+$/,"");
        str = str.replace(/\s+/g," ");
        return str;
    }

    Util.DoublyLinkedList = function() {
        this.first = null;
        this.last = null;
    }

    Util.DoublyLinkedList.prototype.insertAfter = function(item,after) {
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

    Util.DoublyLinkedList.prototype.remove = function(item) {
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

    Util.diff = function(src,dest) {
        var traces = new Array();

        traces[1] = new DiffEntry(0,0,0,0,null);

        for (var distance = 0; true; distance++) {
            for (var k = -distance; k <= distance; k += 2) {
                var srcEnd;
                var prev;

                var del = traces[k-1];
                var ins = traces[k+1];

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

                destEnd = srcEnd - k;
                var srcStart = srcEnd;
                var destStart = destEnd;
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
            var results = new Array();
            results.push(entry);
            for (entry = entry.prev; entry != null; entry = entry.prev) {
                if ((entry.srcStart != entry.srcEnd) || (entry.destStart != entry.destEnd))
                    results.push(entry);
            }
            return results.reverse();
        }
    }

    Util.TimingEntry = function(name,time) {
        this.name = name;
        this.time = time;
    }

    Util.TimingInfo = function() {
        this.entries = new Array();
        this.total = 0;
        this.lastTime = null;
    }

    Util.TimingInfo.prototype.start = function() {
        this.entries.length = 0;
        this.lastTime = new Date();
    }

    Util.TimingInfo.prototype.addEntry = function(name) {
        if (this.lastTime == null)
            this.start();

        var now = new Date();
        var interval = now - this.lastTime;
        this.entries.push(new Util.TimingEntry(name,interval));
        this.total += interval;
        this.lastTime = now;
    }

    Util.TimingInfo.prototype.print = function(title) {
        debug(title);
        for (var i = 0; i < this.entries.length; i++) {
            var entry = this.entries[i];
            debug("    "+entry.name+": "+entry.time+"ms");
        }
    }

    Util.readFileApp = function(filename) {
        var req = new XMLHttpRequest("file:///read/"+filename);
        req.open("POST","/read/"+encodeURI(filename),false);
        req.send();
        if (req.status == 404)
            return null; // file not found
        else if ((req.status != 200) && (req.status != 0))
            throw new Error(req.status+": "+req.responseText);
        var doc = req.responseXML;
        if (doc != null)
            DOM.assignNodeIds(doc);
        return doc;
    }

    Util.readFileTest = function(filename) {
        var req = new XMLHttpRequest();
        req.open("GET",filename,false);
        req.send();
        var xml = req.responseXML;
        if (xml == null)
            return null;
        DOM.assignNodeIds(xml.documentElement);
        return xml;
    }

    Util.fromTokenList = function(value) {
        var result = new Object();
        if (value != null) {
            var components = value.toLowerCase().split(/\s+/);
            for (var i = 0; i < components.length; i++) {
                if (components[i].length > 0)
                    result[components[i]] = true;
            }
        }
        return result;
    }

    Util.toTokenList = function(properties) {
        var tokens = new Array();

        if (properties != null) {
            // Sort the names to ensure deterministic results in test cases
            var names = Object.getOwnPropertyNames(properties).sort();
            for (var i = 0; i < names.length; i++) {
                var name = names[i];
                if (properties[name])
                    tokens.push(name);
            }
        }

        if (tokens.length == null)
            return null;
        else
            return tokens.join(" ");
    }

    Util.xywhAbsElementRect = function(element) {
        var rect = element.getBoundingClientRect();
        return { x: rect.left + window.scrollX,
                 y: rect.top + window.scrollY,
                 width: rect.width,
                 height: rect.height };
    }

})(globalAPI);
