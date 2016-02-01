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

define("Main",function(require,exports) {
"use strict";

var AutoCorrect = require("AutoCorrect");
var Cursor = require("Cursor");
var DOM = require("DOM");
var Editor = require("Editor");
var ElementTypes = require("ElementTypes");
var Outline = require("Outline");
var PostponedActions = require("PostponedActions");
var Range = require("Range");
var Selection = require("Selection");
var Styles = require("Styles");
var Types = require("Types");
var UndoManager = require("UndoManager");
var Util = require("Util");
var Viewport = require("Viewport");

// public
function getLanguage() {
    var lang = document.documentElement.getAttribute("lang");
    if (lang != null)
        lang = lang.replace(/-/g,"_");
    return lang;
}

// public
function setLanguage(lang) {
    if ((lang == null) || (lang == "")) {
        DOM.removeAttribute(document.documentElement,"lang");
    }
    else {
        lang = lang.replace(/_/g,"-");
        DOM.setAttribute(document.documentElement,"lang",lang);
    }
}

// public
function removeUnsupportedInput() {
    recurse(document.documentElement);

    function recurse(node) {
        // Delete comments and processing instructions
        if ((node.nodeType != Node.TEXT_NODE) &&
            (node.nodeType != Node.ELEMENT_NODE)) {
            DOM.deleteNode(node);
        }
        else {
            var next;
            for (var child = node.firstChild; child != null; child = next) {
                next = child.nextSibling;
                recurse(child);
            }
        }
    }
}

// private
function addMetaCharset() {
    var head = DOM.documentHead(document);
    var next;
    for (var child = head.firstChild; child != null; child = next) {
        next = child.nextSibling;
        if ((child._type == ElementTypes.HTML_META) && (child.hasAttribute("charset"))) {
            DOM.deleteNode(child);
        }
        else if ((child._type == ElementTypes.HTML_META) && child.hasAttribute("http-equiv") &&
                 (child.getAttribute("http-equiv").toLowerCase() == "content-type")) {
            DOM.deleteNode(child);
        }
    }

    var meta = DOM.createElement(document,"META");
    DOM.setAttribute(meta,"charset","utf-8");
    DOM.insertBefore(head,meta,head.firstChild);
}

// public
function setGenerator(generator) {
    return UndoManager.disableWhileExecuting(function() {
        var head = DOM.documentHead(document);
        for (var child = head.firstChild; child != null; child = child.nextSibling) {
            if ((child._type == ElementTypes.HTML_META) &&
                child.hasAttribute("name") &&
                (child.getAttribute("name").toLowerCase() == "generator")) {
                var origGenerator = DOM.getAttribute(child,"content");
                DOM.setAttribute(child,"content",generator);

                if (origGenerator == null)
                    return "";
                else
                    return origGenerator;
            }
        }

        var meta = DOM.createElement(document,"META");
        DOM.setAttribute(meta,"name","generator");
        DOM.setAttribute(meta,"content",generator);
        DOM.insertBefore(head,meta,head.firstChild);

        return "";
    });
}

// public
function isEmptyDocument() {
    return !Util.nodeHasContent(document.body);
}

// public
function prepareForSave() {
    // Force any end-of-group actions to be performed
    UndoManager.newGroup();
    return true;
}

// public
function getHTML() {
    return document.documentElement.outerHTML;
}

// public
function getErrorReportingInfo() {
    if (document.documentElement == null)
        return "(document.documentElement is null)";
    try {
        var html = htmlWithSelection();
        cleanse(html);
        return html.outerHTML;
    }
    catch (e) {
        try {
            var html = DOM.cloneNode(document.documentElement,true);
            cleanse(html);
            return html.outerHTML+"\n[Error getting selection: "+e+"]";
        }
        catch (e2) {
            return "[Error getting HTML: "+e2+"]";
        }
    }

    function cleanse(node) {
        switch (node._type) {
        case ElementTypes.HTML_TEXT:
        case ElementTypes.HTML_COMMENT:
            DOM.setNodeValue(node,cleanseString(node.nodeValue));
            break;
        case ElementTypes.HTML_STYLE:
        case ElementTypes.HTML_SCRIPT:
            return;
        default:
            if (node.nodeType == Node.ELEMENT_NODE) {
                cleanseAttribute(node,"original");
                if (node.hasAttribute("href") && !node.getAttribute("href").match(/^#/))
                    cleanseAttribute(node,"href");
                for (var child = node.firstChild; child != null; child = child.nextSibling)
                    cleanse(child);
            }
            break;
        }
    }

    function cleanseAttribute(node,name) {
        if (node.hasAttribute(name)) {
            var value = node.getAttribute(name);
            value = cleanseString(value);
            DOM.setAttribute(node,name,value);
        }
    }

    function cleanseString(str) {
        return str.replace(/[^\s\.\@\^]/g,"X");
    }

    function htmlWithSelection() {
        var selectionRange = Selection.get();
        if (selectionRange != null) {
            selectionRange = Range.forwards(selectionRange);
            var startSave = new Object();
            var endSave = new Object();

            var html = null;

            Range.trackWhileExecuting(selectionRange,function() {
                // We use the strings @@^^ and ^^@@ to represent the selection
                // start and end, respectively. The reason for this is that after we have
                // cloned the tree, all text will be removed. We keeping the @ and ^
                // characters so we have some way to identifiy the selection markers;
                // leaving these in is not going to reveal any confidential information.

                addPositionMarker(selectionRange.end,"^^@@",endSave);
                addPositionMarker(selectionRange.start,"@@^^",startSave);

                html = DOM.cloneNode(document.documentElement,true);

                removePositionMarker(selectionRange.start,startSave);
                removePositionMarker(selectionRange.end,endSave);
            });

            return html;
        }
        else {
            return DOM.cloneNode(document.documentElement,true);
        }
    }

    function addPositionMarker(pos,name,save) {
        var node = pos.node;
        var offset = pos.offset;
        if (node.nodeType == Node.ELEMENT_NODE) {
            save.tempNode = DOM.createTextNode(document,name);
            DOM.insertBefore(node,save.tempNode,node.childNodes[offset]);
        }
        else if (node.nodeType == Node.TEXT_NODE) {
            save.originalNodeValue = node.nodeValue;
            node.nodeValue = node.nodeValue.slice(0,offset) + name + node.nodeValue.slice(offset);
        }
    }

    function removePositionMarker(pos,save) {
        var node = pos.node;
        var offset = pos.offset;
        if (pos.node.nodeType == Node.ELEMENT_NODE) {
            DOM.deleteNode(save.tempNode);
        }
        else if (pos.node.nodeType == Node.TEXT_NODE) {
            node.nodeValue = save.originalNodeValue;
        }
    }
}

// public
function removeSpecial(node) {
    // We process the children first, so that if there are any nested removable elements (e.g.
    // a selection span inside of an autocorrect span), all levels of nesting are taken care of
    var next;
    for (var child = node.firstChild; child != null; child = next) {
        next = child.nextSibling;
        removeSpecial(child);
    }

    var cssClass = null;
    if ((node.nodeType == Node.ELEMENT_NODE) && node.hasAttribute("class"))
        cssClass = node.getAttribute("class");

    if ((cssClass == Types.Keys.HEADING_NUMBER) ||
        (cssClass == Types.Keys.FIGURE_NUMBER) ||
        (cssClass == Types.Keys.TABLE_NUMBER) ||
        (cssClass == Types.Keys.AUTOCORRECT_CLASS) ||
        (cssClass == Types.Keys.SELECTION_CLASS) ||
        (cssClass == Types.Keys.SELECTION_HIGHLIGHT)) {
        DOM.removeNodeButKeepChildren(node);
    }
    else if ((node._type == ElementTypes.HTML_META) &&
             node.hasAttribute("name") &&
             (node.getAttribute("name").toLowerCase() == "viewport")) {
        DOM.deleteNode(node);
    }
    else if (node._type == ElementTypes.HTML_LINK) {
        if ((node.getAttribute("rel") == "stylesheet") &&
            (node.getAttribute("href") == Styles.getBuiltinCSSURL())) {
            DOM.deleteNode(node);
        }
    }
}

function simplifyStackString(e) {
    if (e.stack == null)
        return "";
    var lines = e.stack.toString().split(/\n/);
    for (var i = 0; i < lines.length; i++) {
        var nameMatch = lines[i].match(/^(.*)@/);
        var name = (nameMatch != null) ? nameMatch[1] : "(anonymous function)";
        var locMatch = lines[i].match(/:([0-9]+:[0-9]+)$/);
        var loc = (locMatch != null) ? locMatch[1] : "?";
        lines[i] = "stack["+(lines.length-i-1)+"] = "+name+"@"+loc;
    }
    return lines.join("\n");
}

// public
function execute(fun) {
    try {
        var res = fun();
        PostponedActions.perform();
        return res;
    }
    catch (e) {
        var message = (e.message != null) ? e.message : e.toString();
        var stack = simplifyStackString(e);
        Editor.error(message+"\n"+stack);
    }
}

function fixEmptyBody() {
    for (var child = document.body.firstChild; child != null; child = child.nextSibling) {
        if (Util.nodeHasContent(child))
            return;
    }

    for (var child = document.body.firstChild; child != null; child = child.nextSibling) {
        if (child._type == ElementTypes.HTML_P) {
            Cursor.updateBRAtEndOfParagraph(child);
            return;
        }
    }

    var p = DOM.createElement(document,"P");
    var br = DOM.createElement(document,"BR");
    DOM.appendChild(p,br);
    DOM.appendChild(document.body,p);
}

// public
function init(width,textScale,cssURL,clientRectsBug) {
    try {
        exports.clientRectsBug = clientRectsBug;
        if (document.documentElement == null)
            throw new Error("document.documentElement is null");
        if (document.body == null)
            throw new Error("document.body is null");
        var timing = new Util.TimingInfo();
        timing.start();
        DOM.assignNodeIds(document);
        timing.addEntry("DOM.assignNodeIds");
        removeUnsupportedInput();
        timing.addEntry("Main.removeUnsupportedInput");
        addMetaCharset();
        timing.addEntry("addMetaCharset");
        fixEmptyBody();
        timing.addEntry("fixEmptyBody");
        Outline.init();
        timing.addEntry("Outline.init");
        Styles.init(cssURL);
        timing.addEntry("Styles.init");
        Viewport.init(width,textScale);
        timing.addEntry("Viewport.init");
        AutoCorrect.init();
        timing.addEntry("AutoCorrect.init");

        PostponedActions.perform();
        timing.addEntry("PostponedActions.perform");
        Cursor.moveToStartOfDocument();
        timing.addEntry("Cursor.moveToStartOfDocument");

        UndoManager.clear();
        timing.addEntry("UndoManager.clear");
//        timing.print();

        return true;
    }
    catch (e) {
        return e.toString();
    }
}

exports.getLanguage = getLanguage;
exports.setLanguage = setLanguage;
exports.removeUnsupportedInput = removeUnsupportedInput;
exports.setGenerator = setGenerator;
exports.isEmptyDocument = isEmptyDocument;
exports.prepareForSave = prepareForSave;
exports.getHTML = getHTML;
exports.getErrorReportingInfo = getErrorReportingInfo;
exports.removeSpecial = removeSpecial;
exports.execute = execute;
exports.init = init;

});
