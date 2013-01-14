// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Styles_headingNumbering;
var Styles_getCSSText;
var Styles_setCSSText;
var Styles_getBuiltinCSSURL;
var Styles_init;

(function() {

    var rules = new Object();

    Styles_headingNumbering = trace(function headingNumbering()
    {
        return ((rules["h1::before"] != null) &&
                (rules["h1::before"]["content"] != null));
    });

    Styles_getCSSText = trace(function getCSSText()
    {
        var head = DOM_documentHead(document);
        var cssText = "";
        for (var child = head.firstChild; child != null; child = child.nextSibling) {
            if (child._type == HTML_STYLE)
                cssText += getNodeText(child)+"\n";
        }
        return cssText;
    });

    Styles_setCSSText = trace(function setCSSText(cssText,cssRules)
    {
        UndoManager_newGroup("Update styles");
        var head = DOM_documentHead(document);
        var next;
        for (var child = head.firstChild; child != null; child = next) {
            next = child.nextSibling;
            if (child._type == HTML_STYLE)
                DOM_deleteNode(child);
        }
        var style = DOM_createElement(document,"STYLE");
        DOM_appendChild(style,DOM_createTextNode(document,cssText));
        DOM_appendChild(head,style);
        rules = cssRules; // FIXME: undo support? (must coordinate with ObjC code)
        Outline_scheduleUpdateStructure();
        return {}; // Objective C caller expects JSON result
    });

    var addBuiltinStylesheet = trace(function addBuiltinStylesheet(cssURL)
    {
        var head = DOM_documentHead(document);
        for (var child = head.firstChild; child != null; child = child.nextSibling) {
            if ((child._type == HTML_LINK) &&
                (child.getAttribute("rel") == "stylesheet") &&
                (child.getAttribute("href") == cssURL)) {
                // Link element was already added by HTMLInjectionProtocol
                return;
            }
        }

        // HTMLInjectionProtocol was unable to find <head> element and insert the stylesheet link,
        // so add it ourselves
        var link = DOM_createElement(document,"LINK");
        DOM_setAttribute(link,"rel","stylesheet");
        DOM_setAttribute(link,"href",cssURL);
        DOM_insertBefore(head,link,head.firstChild);
    });

    var builtinCSSURL = null;

    Styles_getBuiltinCSSURL = trace(function getBuiltinCSSURL()
    {
        return builtinCSSURL;
    });

    // public
    Styles_init = trace(function init(cssURL)
    {
        if (cssURL != null)
            builtinCSSURL = cssURL;

        if (builtinCSSURL != null)
            addBuiltinStylesheet(builtinCSSURL);
    });

})();
