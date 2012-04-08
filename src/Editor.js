//  Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function(){

    var backMessages = new Array();

    function addBackMessage()
    {
        backMessages.push(arrayCopy(arguments));
        return null;
    }

    window.Editor = {

        getBackMessages: function()
        {
            var result = JSON.stringify(backMessages);
            backMessages = new Array();
            return result;
        },

        debug: function(str)
        {
            addBackMessage("debug",str);
        },

        addOutlineItem: function(itemId,type)
        {
            addBackMessage("addOutlineItem",itemId,type);
        },

        updateOutlineItem: function(itemId,title)
        {
            addBackMessage("updateOutlineItem",itemId,title);
        },

        removeOutlineItem: function(itemId)
        {
            addBackMessage("removeOutlineItem",itemId);
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

    window.debug = function(str)
    {
        Editor.debug(str);
    }
})();
