// This file is part of the Corinthia project (http://corinthia.io).
//
// See the COPYRIGHT.txt file distributed with this work for
// information regarding copyright ownership.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

define("Styles",function(require,exports) {

    var DOM = require("DOM");
    var ElementTypes = require("ElementTypes");
    var Outline = require("Outline");
    var Types = require("Types");
    var UndoManager = require("UndoManager");

    var rules = new Object();
    var paragraphClass = null;

    function getRule(selector) {
        return rules[selector];
    }

    function nextSelectorAfter(element) {
        var selector = element.nodeName.toLowerCase();
        var className = DOM.getAttribute(element,"class");
        if (className != null)
            selector = selector+"."+className;

        var nextElementName = null;
        var nextClassName = null;

        var rule = getRule(selector);
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
            (ElementTypes.fromString[nextElementName] == null) ||
            (!Types.PARAGRAPH_ELEMENTS[ElementTypes.fromString[nextElementName]])) {
            nextElementName = null;
            nextClassName = null;
        }

        if (Types.isHeadingNode(element)) {
            nextElementName = "p";
            nextClassName = getParagraphClass();
        }

        if (nextElementName == null)
            return null;
        else if (nextClassName == null)
            return nextElementName;
        else
            return nextElementName+"."+nextClassName;
    }

    function getParagraphClass() {
        return paragraphClass;
    }

    function setParagraphClass(cls) {
        paragraphClass = cls;
    }

    function headingNumbering() {
        return ((rules["h1::before"] != null) &&
                (rules["h1::before"]["content"] != null));
    }

    function getCSSText() {
        var head = DOM.documentHead(document);
        var cssText = "";
        for (var child = head.firstChild; child != null; child = child.nextSibling) {
            if (child._type == ElementTypes.HTML_STYLE) {
                for (var t = child.firstChild; t != null; t = t.nextSibling) {
                    if (t._type == ElementTypes.HTML_TEXT)
                        cssText += t.nodeValue;
                }
            }
        }
        return cssText;
    }

    function setCSSText(cssText,cssRules) {
        UndoManager.newGroup("Update styles");
        var head = DOM.documentHead(document);
        var next;
        for (var child = head.firstChild; child != null; child = next) {
            next = child.nextSibling;
            if (child._type == ElementTypes.HTML_STYLE)
                DOM.deleteNode(child);
        }
        var style = DOM.createElement(document,"STYLE");
        DOM.appendChild(style,DOM.createTextNode(document,cssText));
        DOM.appendChild(head,style);
        rules = cssRules; // FIXME: undo support? (must coordinate with ObjC code)
        Outline.scheduleUpdateStructure();
        return {}; // Objective C caller expects JSON result
    }

    function addBuiltinStylesheet(cssURL) {
        var head = DOM.documentHead(document);
        for (var child = head.firstChild; child != null; child = child.nextSibling) {
            if ((child._type == ElementTypes.HTML_LINK) &&
                (child.getAttribute("rel") == "stylesheet") &&
                (child.getAttribute("href") == cssURL)) {
                // Link element was already added by HTMLInjectionProtocol
                return;
            }
        }

        // HTMLInjectionProtocol was unable to find <head> element and insert the stylesheet link,
        // so add it ourselves
        var link = DOM.createElement(document,"LINK");
        DOM.setAttribute(link,"rel","stylesheet");
        DOM.setAttribute(link,"href",cssURL);
        DOM.insertBefore(head,link,head.firstChild);
    }

    var builtinCSSURL = null;

    function getBuiltinCSSURL() {
        return builtinCSSURL;
    }

    // public
    function init(cssURL) {
        if (cssURL != null)
            builtinCSSURL = cssURL;

        if (builtinCSSURL != null)
            addBuiltinStylesheet(builtinCSSURL);
    }

    exports.getRule = getRule;
    exports.nextSelectorAfter = nextSelectorAfter;
    exports.getParagraphClass = getParagraphClass;
    exports.setParagraphClass = setParagraphClass;
    exports.headingNumbering = headingNumbering;
    exports.getCSSText = getCSSText;
    exports.setCSSText = setCSSText;
    exports.getBuiltinCSSURL = getBuiltinCSSURL;
    exports.init = init;

});
