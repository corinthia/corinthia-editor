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
        // debug(sheet);
//        alert("here");
//        alert("sheet = "+sheet);
        var str = "";
        for (name in sheet)
            str += name+"\n";
//        alert("Sheet properties:\n"+str);
//        alert("sheet.rules = "+sheet.rules);
        for (var j = 0; j < sheet.cssRules.length; j++) {
            var rule = sheet.cssRules[j];
            // debug("  (applies to "+rule.selectorText+")");
            if (rule.type == CSSRule.STYLE_RULE) {
                // debug("  "+rule.cssText);
                // for (k = 0; k < rule.style.length; k++)
                //     debug("    "+rule.style[k]+" "+rule.style.getPropertyValue(rule.style[k]));

                var obj = new Object();
                obj.selector = rule.selectorText;
                for (k = 0; k < rule.style.length; k++)
                    obj[rule.style[k]] = rule.style.getPropertyValue(rule.style[k]);
                list.push(obj);
            }
        }
    }
    editor.setStyles(encodeJSON(list));
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
    document.body.style.padding = "5%";
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
