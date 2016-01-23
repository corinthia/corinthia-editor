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

var Traversal_prevNode;
var Traversal_nextNodeAfter;
var Traversal_nextNode;
var Traversal_prevTextNode;
var Traversal_nextTextNode;
var Traversal_firstChildElement;
var Traversal_lastChildElement;
var Traversal_firstDescendant;
var Traversal_lastDescendant;
var Traversal_firstDescendantOfType;
var Traversal_firstChildOfType;
var Traversal_getNodeDepth;
var Traversal_getNodeText;
var Traversal_isWhitespaceTextNode;
var Traversal_isNonWhitespaceTextNode;
var Traversal_printTree;

(function(){

    Traversal_prevNode = function(node) {
        if (node.previousSibling != null) {
            node = node.previousSibling;
            while (node.lastChild != null)
                node = node.lastChild;
            return node;
        }
        else {
            return node.parentNode;
        }
    }

    Traversal_nextNodeAfter = function(node,entering,exiting) {
        while (node != null) {
            if (node.nextSibling != null) {
                if (exiting != null)
                    exiting(node);
                node = node.nextSibling;
                if (entering != null)
                    entering(node);
                break;
            }

            if (exiting != null)
                exiting(node);
            node = node.parentNode;
        }
        return node;
    }

    Traversal_nextNode = function(node,entering,exiting) {
        if (node.firstChild) {
            node = node.firstChild;
            if (entering != null)
                entering(node);
            return node;
        }
        else {
            return Traversal_nextNodeAfter(node,entering,exiting);
        }
    }

    Traversal_prevTextNode = function(node) {
        do {
            node = Traversal_prevNode(node);
        } while ((node != null) && (node.nodeType != Node.TEXT_NODE));
        return node;
    }

    Traversal_nextTextNode = function(node) {
        do {
            node = Traversal_nextNode(node);
        } while ((node != null) && (node.nodeType != Node.TEXT_NODE));
        return node;
    }

    Traversal_firstChildElement = function(node) {
        var first = node.firstChild;
        while ((first != null) && (first.nodeType != Node.ELEMENT_NODE))
            first = first.nextSibling;
        return first;
    }

    Traversal_lastChildElement = function(node) {
        var last = node.lastChild;
        while ((last != null) && (last.nodeType != Node.ELEMENT_NODE))
            last = last.previousSibling;
        return last;
    }

    Traversal_firstDescendant = function(node) {
        while (node.firstChild != null)
            node = node.firstChild;
        return node;
    }

    Traversal_lastDescendant = function(node) {
        while (node.lastChild != null)
            node = node.lastChild;
        return node;
    }

    Traversal_firstDescendantOfType = function(node,type) {
        if (node._type == type)
            return node;

        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            var result = Traversal_firstDescendantOfType(child,type);
            if (result != null)
                return result;
        }
        return null;
    }

    Traversal_firstChildOfType = function(node,type) {
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            if (child._type == type)
                return child;
        }
        return null;
    }

    Traversal_getNodeDepth = function(node) {
        var depth = 0;
        for (; node != null; node = node.parentNode)
            depth++;
        return depth;
    }

    Traversal_getNodeText = function(node) {
        var strings = new Array();
        recurse(node);
        return strings.join("").replace(/\s+/g," ");

        function recurse(node) {
            if (node.nodeType == Node.TEXT_NODE)
                strings.push(node.nodeValue);

            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }

    Traversal_isWhitespaceTextNode = function(node) {
        if (node.nodeType != Node.TEXT_NODE)
            return false;
        return Util_isWhitespaceString(node.nodeValue);
    }

    Traversal_isNonWhitespaceTextNode = function(node) {
        if (node.nodeType != Node.TEXT_NODE)
            return false;
        return !Util_isWhitespaceString(node.nodeValue);
    }

    Traversal_printTree = function(node,indent,offset) {
        if (indent == null)
            indent = "";
        if (offset == null)
            offset = "";
        if ((node.nodeType == Node.ELEMENT_NODE) && node.hasAttribute("class"))
            debug(indent+offset+Util_nodeString(node)+"."+node.getAttribute("class"));
        else
            debug(indent+offset+Util_nodeString(node));
        var childOffset = 0;
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            Traversal_printTree(child,indent+"    ",childOffset+" ");
            childOffset++;
        }
    }

})();
