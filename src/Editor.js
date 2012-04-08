//  Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var backMessages = new Array();

function getBackMessages()
{
    var result = JSON.stringify(backMessages);
    backMessages = new Array();
    return result;
}

function addBackMessage()
{
    backMessages.push(arrayCopy(arguments));
    return null;
}

var editor = {
    debug: function(str)
    {
        addBackMessage("debug",str);
    },

    setOutline: function(outline)
    {
        addBackMessage("setOutline",outline);
    },
    
    setStyles: function(styles)
    {
        addBackMessage("setStyles",styles);
    },
    
    setCursor: function(x,y,width,height)
    {
        addBackMessage("setCursor",x,y,width,height);
    },
    
    setSelectionHandles: function(x1,y1,height1,x2,y2,height2)
    {
        addBackMessage("setSelectionHandles",x1,y1,height1,x2,y2,height2);
    },
    
    clearSelectionHandlesAndCursor: function()
    {
        addBackMessage("clearSelectionHandlesAndCursor");
    },

    setSelectionBounds: function(left,top,right,bottom)
    {
        addBackMessage("setSelectionBounds",left,top,right,bottom);
    },
    
    reportJSError: function(error)
    {
        addBackMessage("reportJSError",error.toString());
    },    
}

function debug(str)
{
    editor.debug(str);
}

function warning(str)
{
    debug("WARNING: "+str);
}

//function showProperties(object,objname)
//{
//    var functions = new Array();
//    var properties = new Array();
//    for (var name in object) {
//        if (typeof(object[name]) == "function")
//            functions.push(name);
//        else
//            properties.push(name);
//    }
//    functions.sort();
//    properties.sort();
//    for (var i = 0; i < functions.length; i++)
//        debug(objname+"."+functions[i]+"()");
//    for (var i = 0; i < properties.length; i++)
//        debug(objname+"."+properties[i]);
//}
