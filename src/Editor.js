//  Copyright (c) 2011-2013 UX Productivity Pty Ltd. All rights reserved.

var Editor_getBackMessages;
var Editor_debug;
var Editor_addOutlineItem;
var Editor_updateOutlineItem;
var Editor_removeOutlineItem;
var Editor_outlineUpdated;
var Editor_setCursor;
var Editor_setSelectionHandles;
var Editor_clearSelectionHandlesAndCursor;
var Editor_setSelectionBounds;
var Editor_updateAutoCorrect;
var Editor_error;
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

    Editor_error = function(error,type)
    {
        if (type == null)
            type = "";
        addBackMessage("error",error.toString(),type);
    };

    Editor_addOutlineItem = function(itemId,type,title)
    {
        addBackMessage("addOutlineItem",itemId,type,title);
    };

    Editor_updateOutlineItem = function(itemId,title)
    {
        addBackMessage("updateOutlineItem",itemId,title);
    };

    Editor_removeOutlineItem = function(itemId)
    {
        addBackMessage("removeOutlineItem",itemId);
    };

    Editor_outlineUpdated = function()
    {
        addBackMessage("outlineUpdated");
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

    Editor_updateAutoCorrect = function()
    {
        addBackMessage("updateAutoCorrect");
    };

    debug = Editor_debug;

})();
