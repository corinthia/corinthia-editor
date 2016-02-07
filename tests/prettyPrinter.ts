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

import DOM = require("../src/dom");
import ElementTypes = require("../src/elementTypes");
import Formatting = require("../src/formatting");
import Types = require("../src/types");
import UndoManager = require("../src/undo");

// Applicable options:
// keepSelectionHighlights (boolean)
// preserveCase (boolean)
// showNamespaceDetails (boolean)
// separateLines (boolean)

export function getHTML(root,options?) {
    let copy;
    UndoManager.disableWhileExecuting(function() {
        if (options == null)
            options = new Object();
        copy = DOM.cloneNode(root,true);
        if (!options.keepSelectionHighlights)
            removeSelectionSpans(copy);
        for (let body = copy.firstChild; body != null; body = body.nextSibling) {
            if (body.nodeName == "BODY") {
                DOM.removeAttribute(body,"style");
                DOM.removeAttribute(body,"contentEditable");
            }
        }
    });

    let output = new Array();
    prettyPrint(output,options,copy,"");
    return output.join("");
}

function removeSelectionSpans(root) {
    let checkMerge = new Array();
    recurse(root);

    for (let i = 0; i < checkMerge.length; i++) {
        if (checkMerge[i].parentNode != null) { // if not already merged
            Formatting.mergeWithNeighbours(checkMerge[i],{});
        }
    }

    function recurse(node) {
        if (Types.isSelectionHighlight(node)) {
            checkMerge.push(node.firstChild);
            checkMerge.push(node.lastChild);
            DOM.removeNodeButKeepChildren(node);
        }
        else {
            let next;
            for (let child = node.firstChild; child != null; child = next) {
                next = child.nextSibling;
                recurse(child);
            }
        }
    }
}

function entityFix(str) {
    return str.replace(/\u00a0/g,"&nbsp;");
}

function singleDescendents(node) {
    let count = 0;
    for (let child = node.firstChild; child != null; child = child.nextSibling) {
        if ((child.nodeType == Node.TEXT_NODE) && (textNodeDisplayValue(child).length == 0))
            continue;
        count++;
        if (count > 1)
            return false;
        if (!singleDescendents(child))
            return false;
    }
    return true;
}

function sortCSSProperties(value) {
    // Make sure the CSS properties on the "style" attribute appear in a consistent order
    let items = value.trim().split(/\s*;\s*/);
    if ((items.length > 0) && (items[items.length-1] == ""))
        items.length--;
    items.sort();
    return items.join("; ");
}

function attributeString(options,node) {
    // Make sure the attributes appear in a consistent order
    let names = new Array();
    for (let i = 0; i < node.attributes.length; i++) {
        names.push(node.attributes[i].nodeName);
    }
    names.sort();
    let str = "";
    for (let i = 0; i < names.length; i++) {
        let name = names[i];

        let value = node.getAttribute(name);
        if (name == "style")
            value = sortCSSProperties(value);
        let attr = node.getAttributeNode(name);
        if (options.showNamespaceDetails) {
            if ((attr.namespaceURI != null) || (attr.prefix != null))
                name = "{"+attr.namespaceURI+","+attr.prefix+","+attr.localName+"}"+name;
        }
        str += " "+name+"=\""+value+"\"";
    }
    return str;
}

function textNodeDisplayValue(node) {
    let value = entityFix(node.nodeValue);
    if ((node.parentNode != null) &&
        (node.parentNode.getAttribute("xml:space") != "preserve"))
        value = value.trim();
    return value;
}

function prettyPrintOneLine(output,options,node) {
    if ((node.nodeType == Node.ELEMENT_NODE) && (node.nodeName != "SCRIPT")) {
        let name = options.preserveCase ? node.nodeName : node.nodeName.toLowerCase();
        if (node.firstChild == null) {
            output.push("<" + name + attributeString(options,node) + "/>");
        }
        else {
            output.push("<" + name + attributeString(options,node) + ">");
            for (let child = node.firstChild; child != null; child = child.nextSibling)
                prettyPrintOneLine(output,options,child);
            output.push("</" + name + ">");
        }
    }
    else if (node.nodeType == Node.TEXT_NODE) {
        let value = textNodeDisplayValue(node);
        if (value.length > 0)
            output.push(value);
    }
    else if (node.nodeType == Node.COMMENT_NODE) {
        output.push("<!--" + entityFix(node.nodeValue) + "-->\n");
    }
}

function isContainer(node) {
    switch (node._type) {
    case ElementTypes.HTML_BODY:
    case ElementTypes.HTML_SECTION:
    case ElementTypes.HTML_FIGURE:
    case ElementTypes.HTML_TABLE:
    case ElementTypes.HTML_TBODY:
    case ElementTypes.HTML_THEAD:
    case ElementTypes.HTML_TFOOT:
    case ElementTypes.HTML_TR:
    case ElementTypes.HTML_DIV:
    case ElementTypes.HTML_UL:
    case ElementTypes.HTML_OL:
    case ElementTypes.HTML_NAV:
    case ElementTypes.HTML_COLGROUP:
        return true;
    default:
        return false;
    }
}

function prettyPrint(output,options,node,indent) {
    if ((node.nodeType == Node.ELEMENT_NODE) && (node.nodeName != "SCRIPT")) {
        let name = options.preserveCase ? node.nodeName : node.nodeName.toLowerCase();
        if (node.firstChild == null) {
            output.push(indent + "<" + name + attributeString(options,node) + "/>\n");
        }
        else {
            if (node._type == ElementTypes.HTML_STYLE) {
                output.push(indent + "<" + name + attributeString(options,node) + ">\n");
                for (let child = node.firstChild; child != null; child = child.nextSibling)
                    prettyPrint(output,options,child,"");
                output.push(indent + "</" + name + ">\n");
            }
            else if (!options.separateLines && singleDescendents(node) && !isContainer(node)) {
                output.push(indent);
                prettyPrintOneLine(output,options,node);
                output.push("\n");
            }
            else {
                output.push(indent + "<" + name + attributeString(options,node) + ">\n");
                for (let child = node.firstChild; child != null; child = child.nextSibling)
                    prettyPrint(output,options,child,indent+"  ");
                output.push(indent + "</" + name + ">\n");
            }
        }
    }
    else if (node.nodeType == Node.TEXT_NODE) {
        let value = textNodeDisplayValue(node);
//            let value = JSON.stringify(node.nodeValue);
        if (value.length > 0)
            output.push(indent + value + "\n");
    }
    else if (node.nodeType == Node.COMMENT_NODE) {
        output.push(indent + "<!--" + entityFix(node.nodeValue) + "-->\n");
    }
}
