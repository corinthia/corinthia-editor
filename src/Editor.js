//  Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Editor_getBackMessages;
var Editor_debug;
var Editor_addOutlineItem;
var Editor_updateOutlineItem;
var Editor_removeOutlineItem;
var Editor_setOutline;
var Editor_setCursor;
var Editor_setSelectionHandles;
var Editor_clearSelectionHandlesAndCursor;
var Editor_setSelectionBounds;
var Editor_reportJSError;
var debug;

(function(){

    var backMessages = new Array();

    function addBackMessage()
    {
        backMessages.push(arrayCopy(arguments));
        return null;
    }

    Editor_getBackMessages = function()
    {
        var result = JSON.stringify(backMessages);
        backMessages = new Array();
        return result;
    };

    Editor_debug = function(str)
    {
        addBackMessage("debug",str);
    };

    Editor_reportJSError = function(error)
    {
        addBackMessage("reportJSError",error.toString());
    };    

    Editor_addOutlineItem = function(itemId,type)
    {
        addBackMessage("addOutlineItem",itemId,type);
    };

    Editor_updateOutlineItem = function(itemId,title)
    {
        addBackMessage("updateOutlineItem",itemId,title);
    };

    Editor_removeOutlineItem = function(itemId)
    {
        addBackMessage("removeOutlineItem",itemId);
    };

    Editor_setOutline = function(outline)
    {
        addBackMessage("setOutline",outline);
    };
    
    Editor_setCursor = function(x,y,width,height)
    {
        addBackMessage("setCursor",x,y,width,height);
    };
    
    Editor_setSelectionHandles = function(x1,y1,height1,x2,y2,height2)
    {
        addBackMessage("setSelectionHandles",x1,y1,height1,x2,y2,height2);
    };

    Editor_setTableSelection = function(x,y,width,height)
    {
        addBackMessage("setTableSelection",x,y,width,height);
    };
    
    Editor_setSelectionBounds = function(left,top,right,bottom)
    {
        addBackMessage("setSelectionBounds",left,top,right,bottom);
    };

    Editor_clearSelectionHandlesAndCursor = function()
    {
        addBackMessage("clearSelectionHandlesAndCursor");
    };

    debug = Editor_debug;

})();
