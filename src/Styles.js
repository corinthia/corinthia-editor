// Copyright (c) 2011-2013 UX Productivity Pty Ltd. All rights reserved.

var Styles_getRule;
var Styles_nextSelectorAfter;
var Styles_getParagraphClass;
var Styles_setParagraphClass;
var Styles_headingNumbering;
var Styles_getCSSText;
var Styles_setCSSText;
var Styles_getBuiltinCSSURL;
var Styles_init;

(function() {

    var rules = new Object();
    var paragraphClass = null;

    Styles_getRule = trace(function _getRule(selector) {
        return rules[selector];
    });

    Styles_nextSelectorAfter = trace(function _nextSelectorAfter(element) {
        var selector = element.nodeName.toLowerCase();
        var className = DOM_getAttribute(element,"class");
        if (className != null)
            selector = selector+"."+className;

        var nextElementName = null;
        var nextClassName = null;

        var rule = Styles_getRule(selector);
        if (rule != null) {
            var nextSelector = rule["-uxwrite-next"];
            if (nextSelector != null) {
                try {
                    nextSelector = JSON.parse(nextSelector);
                    if (typeof(nextSelector) != "string")
                        nextSelector = null;
                }
                catch (e) {
                    nextSelector = null;
                }
            }
            if (nextSelector != null) {
                var dotIndex = nextSelector.indexOf(".");
                if (dotIndex >= 0) {
                    nextElementName = nextSelector.substring(0,dotIndex);
                    nextClassName = nextSelector.substring(dotIndex+1);
                }
                else {
                    nextElementName = nextSelector;
                }
            }
        }

        if ((nextElementName == null) ||
            (ElementTypes[nextElementName] == null) ||
            (!PARAGRAPH_ELEMENTS[ElementTypes[nextElementName]])) {
            nextElementName = null;
            nextClassName = null;
        }

        if (isHeadingNode(element)) {
            nextElementName = "p";
            nextClassName = Styles_getParagraphClass();
        }

        if (nextElementName == null)
            return null;
        else if (nextClassName == null)
            return nextElementName;
        else
            return nextElementName+"."+nextClassName;
    });

    Styles_getParagraphClass = trace(function _getParagraphClass() {
        return paragraphClass;
    });

    Styles_setParagraphClass = trace(function _setParagraphClass(cls) {
        paragraphClass = cls;
    });

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
