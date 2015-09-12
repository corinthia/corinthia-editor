// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

function NodeSet()
{
    this.members = new Object();
}

NodeSet.prototype.add = function(node)
{
    if (node._nodeId == null)
        throw new Error("NodeSet.add: node "+DOM.upperName(node)+" has no _nodeId property");
    this.members[node._nodeId] = node;
}

NodeSet.prototype.remove = function(node)
{
    if (node._nodeId == null)
        throw new Error("NodeSet.remove: node "+DOM.upperName(node)+" has no _nodeId property");
    delete this.members[node._nodeId];
}

NodeSet.prototype.contains = function(node)
{
    if (node._nodeId == null)
        throw new Error("NodeSet.contains: node "+DOM.upperName(node)+" has no _nodeId property");
    return (this.members[node._nodeId] != null);
}

NodeSet.prototype.toArray = function()
{
    var result = new Array();
    for (var id in this.members)
        result.push(members[id]);
    return id;
}

NodeSet.prototype.forEach = function(fun)
{
    var ids = Object.getOwnPropertyNames(this.members);
    var set = this;
    ids.forEach(function(id) { fun(set.members[id]); });
}

NodeSet.prototype.ancestor = function()
{
    var result = new NodeSet();
    this.forEach(function (node) {
        for (var p = node.parentNode; p != null; p = p.parentNode)
            result.add(p);
    });
    return result;
}

NodeSet.prototype.ancestorOrSelf = function()
{
    var result = new NodeSet();
    this.forEach(function (node) {
        for (var p = node; p != null; p = p.parentNode)
            result.add(p);
    });
    return result;
}

NodeSet.prototype.descendant = function()
{
    var result = new NodeSet();
    this.forEach(function (node) {
        recurse(node);
    });
    return result;

    function recurse(node)
    {
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            result.add(child);
            recurse(child);
        }
    }
}

NodeSet.prototype.descendantOrSelf = function()
{
    var result = new NodeSet();
    this.forEach(function (node) {
        recurse(node);
    });
    return result;

    function recurse(node)
    {
        result.add(node);
        for (var child = node.firstChild; child != null; child = child.nextSibling)
            recurse(child);
    }
}

NodeSet.prototype.union = function(other)
{
    var result = new NodeSet();
    this.forEach(function (node) { result.add(node); });
    other.forEach(function (node) { result.add(node); });
    return result;
}

NodeSet.prototype.intersection = function(other)
{
    var result = new NodeSet();
    this.forEach(function (node) { if (other.contains(node)) { result.add(node); } });
    return result;
}

NodeSet.fromArray = function(array)
{
    var set = new NodeSet();
    array.forEach(function(node) { set.add(node); });
    return set;
}


function NodeMap()
{
    this.keys = new Object();
    this.values = new Object();
}

NodeMap.prototype.clear = function()
{
    this.keys = new Object();
    this.values = new Object();
}

NodeMap.prototype.get = function(key)
{
    if (key._nodeId == null)
        throw new Error("NodeMap.get: key "+key.keyName+" has no _nodeId property");
    return this.values[key._nodeId];
}

NodeMap.prototype.put = function(key,value)
{
    if (key._nodeId == null)
        throw new Error("NodeMap.add: key "+key.keyName+" has no _nodeId property");
    this.keys[key._nodeId] = key;
    this.values[key._nodeId] = value;
}

NodeMap.prototype.remove = function(key)
{
    if (key._nodeId == null)
        throw new Error("NodeMap.remove: key "+key.keyName+" has no _nodeId property");
    delete this.keys[key._nodeId];
    delete this.values[key._nodeId];
}

NodeMap.prototype.containsKey = function(key)
{
    if (key._nodeId == null)
        throw new Error("NodeMap.contains: key "+key.keyName+" has no _nodeId property");
    return (this.values[key._nodeId] != null);
}

NodeMap.prototype.getKeys = function()
{
    var ids = Object.getOwnPropertyNames(this.values);
    var result = new Array(ids.length);
    for (var i = 0; i < ids.length; i++)
        result[i] = this.keys[ids[i]];
    return result;
}

NodeMap.prototype.forEach = function(fun)
{
    var ids = Object.getOwnPropertyNames(this.values);
    var map = this;
    ids.forEach(function(id) { fun(map.keys[id],map.values[id]); });
}

NodeMap.fromArray = function(array,fun)
{
    var map = new NodeMap();
    if (fun != null)
        array.forEach(function(node) { map.put(node,fun(node)); });
    else
        array.forEach(function(node) { map.put(node,null); });
    return map;
};
