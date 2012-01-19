// Copyright (c) 2011-2012 UX Productivity. All rights reserved.

function ElementProxy(element,elementId)
{
    this.element = element;
    this.elementId = elementId;
    this.removed = false;
}

ElementProxy.prototype.beforeRemove = function()
{
    this.element = null;
    this.elementId = null;
    this.removed = true;
}
