// Copyright (c) 2011-2012 UX Productivity. All rights reserved.

var CONTAINER_ELEMENTS = new Object();

CONTAINER_ELEMENTS["#document"] = true;
CONTAINER_ELEMENTS["HTML"] = true;
CONTAINER_ELEMENTS["BODY"] = true;
CONTAINER_ELEMENTS["UL"] = true;
CONTAINER_ELEMENTS["OL"] = true;
CONTAINER_ELEMENTS["LI"] = true;
CONTAINER_ELEMENTS["TABLE"] = true;
CONTAINER_ELEMENTS["THEAD"] = true;
CONTAINER_ELEMENTS["TFOOT"] = true;
CONTAINER_ELEMENTS["TBODY"] = true;
CONTAINER_ELEMENTS["TR"] = true;
CONTAINER_ELEMENTS["TH"] = true;
CONTAINER_ELEMENTS["TD"] = true;
CONTAINER_ELEMENTS["COL"] = true;

var PARAGRAPH_ELEMENTS = new Object();

PARAGRAPH_ELEMENTS["P"] = true;
PARAGRAPH_ELEMENTS["H1"] = true;
PARAGRAPH_ELEMENTS["H2"] = true;
PARAGRAPH_ELEMENTS["H3"] = true;
PARAGRAPH_ELEMENTS["H4"] = true;
PARAGRAPH_ELEMENTS["H5"] = true;
PARAGRAPH_ELEMENTS["H6"] = true;

var HEADING_ELEMENTS = new Object();

HEADING_ELEMENTS["H1"] = true;
HEADING_ELEMENTS["H2"] = true;
HEADING_ELEMENTS["H3"] = true;
HEADING_ELEMENTS["H4"] = true;
HEADING_ELEMENTS["H5"] = true;
HEADING_ELEMENTS["H6"] = true;

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                          General                                               //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

function getStyles()
{
    var list = new Array();
    for (var i = 0; i < document.styleSheets.length; i++) {
        var sheet = document.styleSheets[i];
        var str = "";
        for (name in sheet)
            str += name+"\n";
        for (var j = 0; j < sheet.cssRules.length; j++) {
            var rule = sheet.cssRules[j];
            if (rule.type == CSSRule.STYLE_RULE) {
                var properties = new Object();
                for (k = 0; k < rule.style.length; k++)
                    properties[rule.style[k]] = rule.style.getPropertyValue(rule.style[k]);
                
                list.push({"selector": rule.selectorText,
                           "properties": properties });
            }
        }
    }
    editor.setStyles(list);
}

function jumpToSection(sectionId)
{
    var section = document.getElementById(sectionId);
    var location = webkitConvertPointFromNodeToPage(section,
                                                    new WebKitPoint(0,0));
    window.scrollTo(0,location.y);
}

function getHTML()
{
    try {
        var serializer = new XMLSerializer();
        var xml = serializer.serializeToString(document);
        editor.getHTMLResponse(xml);
    }
    catch (e) {
        editor.getHTMLError(e.toString());
    }
}

function keydown(e)
{
    if (e.keyCode == '\r'.charCodeAt(0)) {
        e.preventDefault();
        enterPressed();
    }
}

// Remove the temporary <script> element that was added to the document to execute this file
// so it's not saved with the document
var initscript = document.getElementById("initscript");
if (initscript != null) {
    initscript.parentNode.removeChild(initscript);
}

var jsInitOk = false;
try {
    document.onclick = reportSelectionFormatting;
//    document.body.contentEditable = true;
//    document.body.style.padding = "15%";
//    document.body.style.padding = "5%";
    document.body.style.textAlign = "justify";
    window.onkeydown = keydown;

    setupMutation();
    getOutline();
    getStyles();
    jsInitOk = true;
}
catch (e) {
    editor.jsInterfaceInitError(e.stack);
}

if (jsInitOk)
    editor.jsInterfaceInitFinished();
