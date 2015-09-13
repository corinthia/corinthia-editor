// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

function arrayContains(array,value)
{
    for (var i = 0; i < array.length; i++) {
        if (array[i] == value)
            return true;
    }
    return false;
}

// Note: you can use slice() to copy a real javascript array, but this function can be used to copy
// DOM NodeLists (e.g. as returned by document.getElementsByTagName) as well, since they don't
// support the slice method
function arrayCopy(array)
{
    if (array == null)
        return null;
    var copy = new Array();
    for (var i = 0; i < array.length; i++)
        copy.push(array[i]);
    return copy;
}

function quoteString(str)
{
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

function nodeString(node)
{
    if (node == null)
        return "null";
    var id = "";
    if (window.debugIds)
        id = node._nodeId.replace(/^.*:/,"")+":";
    if (node.nodeType == Node.TEXT_NODE)
        return id+JSON.stringify(node.nodeValue);
    else if ((node.nodeType == Node.ELEMENT_NODE) && (node.hasAttribute("id")))
        return id+DOM_upperName(node)+"#"+node.getAttribute("id");
    else if (node.nodeType == Node.ELEMENT_NODE)
        return id+DOM_upperName(node);
    else
        return id+node.toString();
}

function rectString(rect)
{
    if (rect == null)
        return null;
    else
        return "("+rect.left+","+rect.top+") - ("+rect.right+","+rect.bottom+")";
}

function rectIsEmpty(rect)
{
    return ((rect == null) ||
            ((rect.width == 0) && (rect.height == 0)));
}

function rectContainsPoint(rect,x,y)
{
    return ((x >= rect.left) && (x < rect.right) &&
            (y >= rect.top) && (y < rect.bottom));
}

function clone(object)
{
    var result = new Object();
    for (var name in object)
        result[name] = object[name];
    return result;
}

function nodeHasContent(node)
{
    if (node.nodeType == Node.TEXT_NODE) {
        return !isWhitespaceString(node.nodeValue);
    }
    else if ((DOM_upperName(node) == "IMG") || (DOM_upperName(node) == "TABLE")) {
        return true;
    }
    else if (isOpaqueNode(node)) {
        return true;
    }
    else {
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            if (nodeHasContent(child))
                return true;
        }
        return false;
    }
}

function isWhitespaceString(str)
{
    return (str.match(isWhitespaceString.regexp) != null);
}

isWhitespaceString.regexp = /^\s*$/;

function normalizeWhitespace(str)
{
    str = str.replace(/^\s+/,"");
    str = str.replace(/\s+$/,"");
    str = str.replace(/\s+/g," ");
    return str;
}

function DoublyLinkedList()
{
    this.first = null;
    this.last = null;
}

DoublyLinkedList.prototype.insertAfter = function(item,after)
{
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

DoublyLinkedList.prototype.remove = function(item)
{
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

function diff(src,dest)
{
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

    function DiffEntry(srcStart,destStart,srcEnd,destEnd,prev)
    {
        this.srcStart = srcStart;
        this.destStart = destStart;
        this.srcEnd = srcEnd;
        this.destEnd = destEnd;
        this.prev = prev;
    }

    function entryToArray(src,dest,entry)
    {
        var results = new Array();
        results.push(entry);
        for (entry = entry.prev; entry != null; entry = entry.prev) {
            if ((entry.srcStart != entry.srcEnd) || (entry.destStart != entry.destEnd))
                results.push(entry);
        }
        return results.reverse();
    }
}

function TimingEntry(name,time)
{
    this.name = name;
    this.time = time;
}

function TimingInfo()
{
    this.entries = new Array();
    this.total = 0;
    this.lastTime = null;
}

TimingInfo.prototype.start = function()
{
    this.entries.length = 0;
    this.lastTime = new Date();
};

TimingInfo.prototype.addEntry = function(name)
{
    if (this.lastTime == null)
        this.start();

    var now = new Date();
    var interval = now - this.lastTime;
    this.entries.push(new TimingEntry(name,interval));
    this.total += interval;
    this.lastTime = now;
};

TimingInfo.prototype.print = function(title)
{
    debug(title);
    for (var i = 0; i < this.entries.length; i++) {
        var entry = this.entries[i];
        debug("    "+entry.name+": "+entry.time+"ms");
    }
};

function readFileApp(filename)
{
    var req = new XMLHttpRequest("file:///read/"+filename);
    req.open("POST","/read/"+encodeURI(filename),false);
    req.send();
    if (req.status == 404)
        return null; // file not found
    else if ((req.status != 200) && (req.status != 0))
        throw new Error(req.status+": "+req.responseText);
    var doc = req.responseXML;
    if (doc != null)
        DOM_assignNodeIds(doc);
    return doc;
}

function readFileTest(filename)
{
    var req = new XMLHttpRequest();
    req.open("GET",filename,false);
    req.send();         
    var xml = req.responseXML;
    if (xml == null)
        return null;
    DOM_assignNodeIds(xml.documentElement);
    return xml;
}
