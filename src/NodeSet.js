// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

function NodeSet()
{
    this.members = new Object();
}

NodeSet.prototype.add = function(node)
{
    if (node._nodeId == null)
        throw new Error("NodeSet.add: node "+node.nodeName+" has no _nodeId property");
    this.members[node._nodeId] = node;
}

NodeSet.prototype.remove = function(node)
{
    if (node._nodeId == null)
        throw new Error("NodeSet.remove: node "+node.nodeName+" has no _nodeId property");
    delete this.members[node._nodeId];
}

NodeSet.prototype.contains = function(node)
{
    if (node._nodeId == null)
        throw new Error("NodeSet.contains: node "+node.nodeName+" has no _nodeId property");
    return (this.members[node._nodeId] != null);
}

NodeSet.prototype.toArray = function()
{
    var result = new Array();
    for (var id in this.members)
        result.push(members[id]);
    return id;
}



function NodeMap()
{
    this.members = new Object();
}

NodeMap.prototype.clear = function()
{
    this.members = new Object();
}

NodeMap.prototype.get = function(key)
{
    if (key._nodeId == null)
        throw new Error("NodeMap.get: key "+key.keyName+" has no _nodeId property");
    return this.members[key._nodeId];
}

NodeMap.prototype.put = function(key,value)
{
    if (key._nodeId == null)
        throw new Error("NodeMap.add: key "+key.keyName+" has no _nodeId property");
    this.members[key._nodeId] = value;
}

NodeMap.prototype.remove = function(key)
{
    if (key._nodeId == null)
        throw new Error("NodeMap.remove: key "+key.keyName+" has no _nodeId property");
    delete this.members[key._nodeId];
}

NodeMap.prototype.containsKey = function(key)
{
    if (key._nodeId == null)
        throw new Error("NodeMap.contains: key "+key.keyName+" has no _nodeId property");
    return (this.members[key._nodeId] != null);
}

NodeMap.prototype.getKeys = function()
{
    return Object.getOwnPropertyNames(this.members);
}
