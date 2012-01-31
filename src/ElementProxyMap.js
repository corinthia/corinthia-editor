// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

function ElementProxyMap()
{
    this.map = new Object();
    this.nextElementId = 0;
}

ElementProxyMap.prototype.get = function(element)
{
    if (element.hasAttribute("elementId")) {
        var elementId = element.getAttribute("elementId");
        var proxy = this.map[elementId];
        if (proxy == null)
            throw new Error("elementId set but no proxy object");
        return proxy;
    }
    else {
        var elementId = this.nextElementId++;
        element.setAttribute("elementId",elementId);
        var proxy = new ElementProxy(element,elementId);
        this.map[elementId] = proxy;
        return proxy;
    }
}

ElementProxyMap.prototype.remove = function(element)
{
    if (element.hasAttribute("elementId")) {
        var elementId = element.getAttribute("elementId");
        var proxy = this.map[elementId];
        if (proxy == null)
            throw new Error("elementId set but no proxy object");
        proxy.beforeRemove();
        delete this.map[elementId];
        element.removeAttribute("elementId");
    }
    else {
        throw new Error("Attempt to remove element with no elementId from map");
    }
}

ElementProxyMap.instance = new ElementProxyMap();

ElementProxyMap.get = function(element)
{
    return ElementProxyMap.instance.get(element);
}

ElementProxyMap.remove = function(element)
{
    return ElementProxyMap.instance.remove(element);
}

function $(element)
{
    return ElementProxyMap.instance.get(element);
}
