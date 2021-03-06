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

import Collections = require("./collections");
import ElementTypes = require("./elementTypes");
import Formatting = require("./formatting");
import Position = require("./position");
import Range = require("./range");
import Traversal = require("./traversal");
import Types = require("./types");
import UndoManager = require("./undo");
import Util = require("./util");

export class StyleProperties {
    [key: string]: string;
}

let nextNodeId = 0;
let ignoreMutations = 0;

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
//                                    DOM Helper Functions                                    //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////

function addUndoAction(...args: any[]): void {
    if (UndoManager.undoSupported)
        UndoManager.addAction.apply(null,Util.arrayCopy(args));
}

function assignNodeId<T extends Node>(node: T): T {
    if (node._nodeId != null)
        throw new Error(node+" already has id");
    node._nodeId = nextNodeId++;
    node._type = ElementTypes.fromString[node.nodeName];
    return node;
}

function checkNodeId(node: Node): void {
    if (node._nodeId == null)
        throw new Error(node.nodeName+" lacks _nodeId");
}

// public
export function assignNodeIds(root: Node): void {
    if (root._nodeId != null)
        throw new Error(root+" already has id");
    recurse(root);
    return;

    function recurse(node: Node): void {
        node._nodeId = nextNodeId++;
        node._type = ElementTypes.fromString[node.nodeName];
        for (let child = node.firstChild; child != null; child = child.nextSibling)
            recurse(child);
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
//                                  Primitive DOM Operations                                  //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////

/*

  The following functions are considered "primitive", in that they are the core functions
  through which all manipulation of the DOM ultimately occurs. All other DOM functions call
  these, either directly or indirectly, instead of making direct method calls on node objects.
  These functions are divided into two categories: node creation and mode mutation.

  The creation functions are as follows:

  * createElement(document,elementName)
  * createElementNS(document,namespaceURI,qualifiedName)
  * createTextNode(document,data)
  * createComment(document,data)
  * cloneNode(original,deep,noIdAttr)

  The purpose of these is to ensure that a unique _nodeId value is assigned to each node object,
  which is needed for using the NodeSet and NodeMap classes. All nodes in a document must have
  this set; we use our own functions for this because DOM provides no other way of uniquely
  identifying nodes in a way that allows them to be stored in a hash table.

  The mutation functions are as follows:

  * insertBeforeInternal(parent,newChild,refChild)
  * deleteNodeInternal(node,deleteDescendantData)
  * setAttribute(element,name,value)
  * setAttributeNS(element,namespaceURI,qualifiedName,value)
  * setStyleProperties(element,properties)
  * insertCharacters(textNode,offset,characters)
  * deleteCharacters(textNode,startOffset,endOffset)
  * moveCharacters(srcTextNode,srcStartOffset,srcEndOffset,destTextNode,destOffset)
  * setNodeValue(textNode,value)

  These functions exist to allow us to record undo information. We can't use DOM mutation events
  for this purpose they're not fully supported in WebKit.

  Every time a mutation operation is performed on a node, we add an action to the undo stack
  corresponding to the inverse of that operaton, i.e. an action that undoes the operaton. It
  is absolutely critical that all changes to a DOM node go through these functions, regardless
  of whether or not the node currently resides in the tree. This ensures that the undo history
  is able to correctly revert the tree to the same state that it was in at the relevant point
  in time.

  By routing all DOM modifications through these few functions, virtually all of the other
  javascript code can be ignorant of the undo manager, provided the only state they change is
  in the DOM. Parts of the code which maintain their own state about the document, such as the
  style manager, must implement their own undo-compliant state manipulation logic.

  *** IMPORTANT ***

  Just in case it isn't already clear, you must *never* make direct calls to methods like
  appendChild() and createElement() on the node objects themselves. Doing so will result in
  subtle and probably hard-to-find bugs. As far as all javascript code for UX Write is
  concerned, consider the public functions defined in this file to be the DOM API. You can use
  check-dom-methods.sh to search for any cases where this rule has been violated.

  */

// public
export function createElement(document: HTMLDocument, elementName: string): HTMLElement {
    return assignNodeId(document.createElement(elementName)); // check-ok
}

// public
export function createElementNS(document: HTMLDocument, namespaceURI: string, qualifiedName: string): Element {
    return assignNodeId(document.createElementNS(namespaceURI,qualifiedName)); // check-ok
}

// public
export function createTextNode(document: HTMLDocument, data: string): Text {
    return assignNodeId(document.createTextNode(data)); // check-ok
}

// public
export function createComment(document: HTMLDocument, data: string): Comment {
    return assignNodeId(document.createComment(data)); // check-ok
}

// public
export function cloneNode<T extends Node>(original: T, deep: boolean, noIdAttr?: boolean): T {
    let clone = original.cloneNode(deep); // check-ok
    assignNodeIds(clone);
    if (noIdAttr && (clone instanceof Element))
        clone.removeAttribute("id"); // check-ok
    return <T>clone;
}

function insertBeforeInternal(parent: Node, newChild: Node, refChild: Node): void {
    if (newChild.parentNode == null) {
        addUndoAction(deleteNodeInternal,newChild)
    }
    else {
        let oldParent = newChild.parentNode;
        let oldNext = newChild.nextSibling;
        addUndoAction(insertBeforeInternal,oldParent,newChild,oldNext);
    }

    parent.insertBefore(newChild,refChild); // check-ok
}

function deleteNodeInternal(node: Node, deleteDescendantData: boolean): void {
    checkNodeId(node);

    addUndoAction(insertBeforeInternal,node.parentNode,node,node.nextSibling);

    if (node.parentNode == null)
        throw new Error("Undo delete "+Util.nodeString(node)+": parent is null");
    node.parentNode.removeChild(node); // check-ok

    // Delete all data associated with the node. This is not preserved across undo/redo;
    // currently the only thing we are using this data for is tracked positions, and we
    // are going to be recording undo information for the selection separately, so this is
    // not a problem.
    if (deleteDescendantData)
        deleteNodeDataRecursive(node);
    else
        deleteNodeData(node);

    return;

    function deleteNodeData(current: Node): void {
        current._trackedPositions = null;
    }

    function deleteNodeDataRecursive(current: Node): void {
        deleteNodeData(current);
        for (let child = current.firstChild; child != null; child = child.nextSibling)
            deleteNodeDataRecursive(child);
    }
}

// public
export function setAttribute(element: Element, name: string, value: string): void {
    if (element.hasAttribute(name))
        addUndoAction(setAttribute,element,name,element.getAttribute(name));
    else
        addUndoAction(setAttribute,element,name,null);

    if (value == null)
        element.removeAttribute(name); // check-ok
    else
        element.setAttribute(name,value); // check-ok
}

// public
export function setAttributeNS(element: Element, namespaceURI: string, qualifiedName: string, value: string): void {
    let localName = qualifiedName.replace(/^.*:/,"");
    if (element.hasAttributeNS(namespaceURI,localName)) {
        let oldValue = element.getAttributeNS(namespaceURI,localName);
        let oldQName = element.getAttributeNodeNS(namespaceURI,localName).nodeName; // check-ok
        addUndoAction(setAttributeNS,element,namespaceURI,oldQName,oldValue)
    }
    else {
        addUndoAction(setAttributeNS,element,namespaceURI,localName,null);
    }

    if (value == null)
        element.removeAttributeNS(namespaceURI,localName); // check-ok
    else
        element.setAttributeNS(namespaceURI,qualifiedName,value); // check-ok
}

// public
export function setStyleProperties(element: HTMLElement, properties: any): void {
    if (Object.getOwnPropertyNames(properties).length == 0)
        return;

    if (element.hasAttribute("style"))
        addUndoAction(setAttribute,element,"style",element.getAttribute("style"));
    else
        addUndoAction(setAttribute,element,"style",null);

    for (let name in properties)
        element.style.setProperty(name,properties[name]); // check-ok

    if (element.getAttribute("style") == "")
        element.removeAttribute("style"); // check-ok
}

// public
export function insertCharacters(textNode: Text, offset: number, characters: string): void {
    if (!(textNode instanceof Text))
        throw new Error("insertCharacters called on non-text node");
    if ((offset < 0) || (offset > textNode.nodeValue.length))
        throw new Error("insertCharacters called with invalid offset");
    trackedPositionsForNode(textNode).forEach(function (position: Position) {
        if (position.offset > offset)
            position.offset += characters.length;
    });
    textNode.nodeValue = textNode.nodeValue.slice(0,offset) +
                         characters +
                         textNode.nodeValue.slice(offset);
    let startOffset = offset;
    let endOffset = offset + characters.length;
    addUndoAction(deleteCharacters,textNode,startOffset,endOffset);
}

// public
export function deleteCharacters(textNode: Text, startOffset: number, endOffset?: number): void {
    if (!(textNode instanceof Text))
        throw new Error("deleteCharacters called on non-text node "+Util.nodeString(textNode));
    if (endOffset == null)
        endOffset = textNode.nodeValue.length;
    if (endOffset < startOffset)
        throw new Error("deleteCharacters called with invalid start/end offset");
    trackedPositionsForNode(textNode).forEach(function (position: Position) {
        let deleteCount = endOffset - startOffset;
        if ((position.offset > startOffset) && (position.offset < endOffset))
            position.offset = startOffset;
        else if (position.offset >= endOffset)
            position.offset -= deleteCount;
    });

    let removed = textNode.nodeValue.slice(startOffset,endOffset);
    addUndoAction(insertCharacters,textNode,startOffset,removed);

    textNode.nodeValue = textNode.nodeValue.slice(0,startOffset) +
                         textNode.nodeValue.slice(endOffset);
}

// public
export function moveCharacters(srcTextNode: Text, srcStartOffset: number, srcEndOffset: number,
                               destTextNode: Text, destOffset: number,
                               excludeStartPos?: boolean, excludeEndPos?: boolean): void {
    if (srcTextNode == destTextNode)
        throw new Error("src and dest text nodes cannot be the same");
    if (srcStartOffset > srcEndOffset)
        throw new Error("Invalid src range "+srcStartOffset+" - "+srcEndOffset);
    if (srcStartOffset < 0)
        throw new Error("srcStartOffset < 0");
    if (srcEndOffset > srcTextNode.nodeValue.length)
        throw new Error("srcEndOffset beyond end of src length");
    if (destOffset < 0)
        throw new Error("destOffset < 0");
    if (destOffset > destTextNode.nodeValue.length)
        throw new Error("destOffset beyond end of dest length");

    let length = srcEndOffset - srcStartOffset;

    addUndoAction(moveCharacters,destTextNode,destOffset,destOffset+length,
                  srcTextNode,srcStartOffset,excludeStartPos,excludeEndPos);

    trackedPositionsForNode(destTextNode).forEach(function (pos: Position) {
        let startMatch = excludeStartPos ? (pos.offset > destOffset)
                                         : (pos.offset >= destOffset);
        if (startMatch)
            pos.offset += length;
    });
    trackedPositionsForNode(srcTextNode).forEach(function (pos: Position) {

        let startMatch = excludeStartPos ? (pos.offset > srcStartOffset)
                                         : (pos.offset >= srcStartOffset);
        let endMatch = excludeEndPos ? (pos.offset < srcEndOffset)
                                     : (pos.offset <= srcEndOffset);

        if (startMatch && endMatch) {
            pos.node = destTextNode;
            pos.offset = destOffset + (pos.offset - srcStartOffset);
        }
        else if (pos.offset >= srcEndOffset) {
            pos.offset -= length;
        }
    });
    let extract = srcTextNode.nodeValue.substring(srcStartOffset,srcEndOffset);
    srcTextNode.nodeValue = srcTextNode.nodeValue.slice(0,srcStartOffset) +
                            srcTextNode.nodeValue.slice(srcEndOffset);
    destTextNode.nodeValue = destTextNode.nodeValue.slice(0,destOffset) +
                             extract +
                             destTextNode.nodeValue.slice(destOffset);
}

// public
export function setNodeValue(textNode: CharacterData, value: string): void {
    if (!(textNode instanceof Text))
        throw new Error("setNodeValue called on non-text node");
    trackedPositionsForNode(textNode).forEach(function (position: Position) {
        position.offset = 0;
    });
    let oldValue = textNode.nodeValue;
    addUndoAction(setNodeValue,textNode,oldValue);
    textNode.nodeValue = value;
}

////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                            //
//                                  High-level DOM Operations                                 //
//                                                                                            //
////////////////////////////////////////////////////////////////////////////////////////////////

function appendChildInternal(parent: Node, newChild: Node): void {
    insertBeforeInternal(parent,newChild,null);
}

// public
export function appendChild(node: Node, child: Node): void {
    return insertBefore(node,child,null);
}

// public
export function insertBefore(parent: Node, child: Node, nextSibling: Node): void {
    let newOffset: number;
    if (nextSibling != null)
        newOffset = Traversal.nodeOffset(nextSibling);
    else
        newOffset = parent.childNodes.length;

    let oldParent = child.parentNode;
    if (oldParent != null) { // already in tree
        let oldOffset = Traversal.nodeOffset(child);

        if ((oldParent == parent) && (newOffset > oldOffset))
            newOffset--;

        trackedPositionsForNode(oldParent).forEach(function (position: Position) {
            if (position.offset > oldOffset) {
                position.offset--;
            }
            else if (position.offset == oldOffset) {
                position.node = parent;
                position.offset = newOffset;
            }
        });
    }

    let result = insertBeforeInternal(parent,child,nextSibling);
    trackedPositionsForNode(parent).forEach(function (position: Position) {
        if (position.offset > newOffset)
            position.offset++;
    });
    return result;
}

// public
export function deleteNode(node: Node): void {
    if (node.parentNode == null) // already deleted
        return;
    adjustPositionsRecursive(node);
    deleteNodeInternal(node,true);

    function adjustPositionsRecursive(current: Node): void {
        for (let child = current.firstChild; child != null; child = child.nextSibling)
            adjustPositionsRecursive(child);

        trackedPositionsForNode(current.parentNode).forEach(function (position: Position) {
            let offset = Traversal.nodeOffset(current);
            if (offset < position.offset) {
                position.offset--;
            }
        });
        trackedPositionsForNode(current).forEach(function (position: Position) {
            let offset = Traversal.nodeOffset(current);
            position.node = current.parentNode;
            position.offset = offset;
        });
    }
}

// public
export function removeAttribute(element: Element, name: string): void {
    setAttribute(element,name,null);
}

// public
export function removeAttributeNS(element: Element, namespaceURI: string, localName: string): void {
    setAttributeNS(element,namespaceURI,localName,null)
}

// public
export function getAttribute(element: Element, name: string): string {
    if (element.hasAttribute(name))
        return element.getAttribute(name);
    else
        return null;
}

// public
export function getAttributeNS(element: Element, namespaceURI: string, localName: string): string {
    if (element.hasAttributeNS(namespaceURI,localName))
        return element.getAttributeNS(namespaceURI,localName);
    else
        return null;
}

// public
export function getStringAttribute(element: Element, name: string): string {
    let value = element.getAttribute(name);
    return (value == null) ? "" : value;
}

// public
export function getStringAttributeNS(element: Element, namespaceURI: string, localName: string): string {
    let value = element.getAttributeNS(namespaceURI,localName);
    return (value == null) ? "" : value;
}

// public
export function getStyleProperties(node: Node): StyleProperties {
    let properties = new StyleProperties();
    if (node instanceof HTMLElement) {
        for (let i = 0; i < node.style.length; i++) {
            let name = node.style[i];
            let value = node.style.getPropertyValue(name);
            properties[name] = value;
        }
    }
    return properties;
}

// public
export function deleteAllChildren(parent: Node): void {
    while (parent.firstChild != null)
        deleteNode(parent.firstChild);
}

// public
export function shallowCopyElement<T extends Node>(element: T): T {
    return cloneNode(element,false,true);
}

// public
export function removeNodeButKeepChildren(node: Node): void {
    if (node.parentNode == null)
        throw new Error("Node "+Util.nodeString(node)+" has no parent");
    let offset = Traversal.nodeOffset(node);
    let childCount = node.childNodes.length;

    trackedPositionsForNode(node.parentNode).forEach(function (position: Position) {
        if (position.offset > offset)
            position.offset += childCount-1;
    });

    trackedPositionsForNode(node).forEach(function (position: Position) {
        position.node = node.parentNode;
        position.offset += offset;
    });

    let parent = node.parentNode;
    let nextSibling = node.nextSibling;
    deleteNodeInternal(node,false);

    while (node.firstChild != null) {
        let child = node.firstChild;
        insertBeforeInternal(parent,child,nextSibling);
    }
}

// public
export function replaceElement(oldElement: Element, newName: string): HTMLElement {
    let newElement = createElement(document,newName);
    for (let i = 0; i < oldElement.attributes.length; i++) {
        let name = oldElement.attributes[i].nodeName; // check-ok
        let value = oldElement.getAttribute(name);
        setAttribute(newElement,name,value);
    }

    let positions = Util.arrayCopy(trackedPositionsForNode(oldElement));
    if (positions != null) {
        for (let i = 0; i < positions.length; i++) {
            if (positions[i].node != oldElement)
                throw new Error("replaceElement: position with wrong node");
            positions[i].node = newElement;
        }
    }

    let parent = oldElement.parentNode;
    let nextSibling = oldElement.nextSibling;
    while (oldElement.firstChild != null)
        appendChildInternal(newElement,oldElement.firstChild);
    // Deletion must be done first so if it's a heading, the outline code picks up the change
    // correctly. Otherwise, there could be two elements in the document with the same id at
    // the same time.
    deleteNodeInternal(oldElement,false);
    insertBeforeInternal(parent,newElement,nextSibling);

    return newElement;
}

// public
export function wrapNode(node: Node, elementName: string): HTMLElement {
    return wrapSiblings(node,node,elementName);
}

export function wrapSiblings(first: Node, last: Node, elementName: string): HTMLElement {
    let parent = first.parentNode;
    let wrapper = createElement(document,elementName);

    if (first.parentNode != last.parentNode)
        throw new Error("first and last are not siblings");

    if (parent != null) {
        let firstOffset = Traversal.nodeOffset(first);
        let lastOffset = Traversal.nodeOffset(last);
        let nodeCount = lastOffset - firstOffset + 1;
        trackedPositionsForNode(parent).forEach(function (position: Position) {
            if ((position.offset >= firstOffset) && (position.offset <= lastOffset+1)) {
                position.node = wrapper;
                position.offset -= firstOffset;
            }
            else if (position.offset > lastOffset+1) {
                position.offset -= (nodeCount-1);
            }
        });

        insertBeforeInternal(parent,wrapper,first);
    }

    let end = last.nextSibling;
    let current = first;
    while (current != end) {
        let next = current.nextSibling;
        appendChildInternal(wrapper,current);
        current = next;
    }
    return wrapper;
}

// public
export function mergeWithNextSibling(current: Node, whiteList: any): void {
    let parent = current.parentNode;
    let next = current.nextSibling;

    if ((next == null) || !nodesMergeable(current,next,whiteList))
        return;

    let currentLength = Traversal.maxChildOffset(current);
    let nextOffset = Traversal.nodeOffset(next);

    let lastChild: Node = null;

    if (current instanceof Text) {
        insertCharacters(current,current.nodeValue.length,next.nodeValue);

        trackedPositionsForNode(next).forEach(function (position: Position) {
            position.node = current;
            position.offset = position.offset+currentLength;
        });

        trackedPositionsForNode(current.parentNode).forEach(function (position: Position) {
            if (position.offset == nextOffset) {
                position.node = current;
                position.offset = currentLength;
            }
        });

        deleteNode(next);
    }
    else {
        lastChild = current.lastChild;
        insertBefore(current,next,null);
        removeNodeButKeepChildren(next);
    }

    if (lastChild != null)
        mergeWithNextSibling(lastChild,whiteList);
}

// public
export function nodesMergeable(a: Node, b: Node, whiteList: any): boolean {
    if ((a instanceof Text) && (b instanceof Text))
        return true;
    else if ((a instanceof Element) && (b instanceof Element))
        return elementsMergableTypes(a,b);
    else
        return false;

    function elementsMergableTypes(a: Element, b: Element) {
        if (whiteList["force"] && Types.isParagraphNode(a) && Types.isParagraphNode(b))
            return true;
        if ((a._type == b._type) &&
            whiteList[a._type] &&
            (a.attributes.length == b.attributes.length)) {
            for (let i = 0; i < a.attributes.length; i++) {
                let attrName = a.attributes[i].nodeName; // check-ok
                if (a.getAttribute(attrName) != b.getAttribute(attrName))
                    return false;
            }
            return true;
        }

        return false;
    }
}

function trackedPositionsForNode(node: Node): Position[] {
    let trackedPositions = node._trackedPositions;
    if (trackedPositions != null) {
        // Sanity check
        for (let i = 0; i < trackedPositions.length; i++) {
            if (trackedPositions[i].node != node)
                throw new Error("Position "+trackedPositions[i]+" has wrong node");
        }
        return Util.arrayCopy(trackedPositions);
    }
    else {
        return [];
    }
}

// public
export function replaceCharacters(textNode: Text, startOffset: number, endOffset: number, replacement: string): void {
    // Note that we do the insertion *before* the deletion so that the position is properly
    // maintained, and ends up at the end of the replacement (unless it was previously at
    // startOffset, in which case it will stay the same)
    insertCharacters(textNode,startOffset,replacement);
    deleteCharacters(textNode,startOffset+replacement.length,endOffset+replacement.length);
}

// public
export function removeAdjacentWhitespace(node: Node): void {
    while ((node.previousSibling != null) && (Traversal.isWhitespaceTextNode(node.previousSibling)))
        deleteNode(node.previousSibling);
    while ((node.nextSibling != null) && (Traversal.isWhitespaceTextNode(node.nextSibling)))
        deleteNode(node.nextSibling);
}

// public
export function documentHead(document: HTMLDocument): HTMLHeadElement {
    let html = document.documentElement;
    for (let child = html.firstChild; child != null; child = child.nextSibling) {
        if (child instanceof HTMLHeadElement)
            return child;
    }
    throw new Error("Document contains no HEAD element");
}

// public
export function ensureUniqueIds(root: Node): void {
    let ids = new Object();
    let duplicates = new Array();

    discoverDuplicates(root);
    renameDuplicates();

    return;

    function discoverDuplicates(node: Node): void {
        if (node instanceof Element) {
            let id = node.getAttribute("id");
            if ((id != null) && (id != "")) {
                if (ids[id])
                    duplicates.push(node);
                else
                    ids[id] = true;
            }
            for (let child = node.firstChild; child != null; child = child.nextSibling)
                discoverDuplicates(child);
        }
    }

    function renameDuplicates(): void {
        let nextNumberForPrefix = new Object();
        for (let i = 0; i < duplicates.length; i++) {
            let id = duplicates[i].getAttribute("id");
            let prefix = id.replace(/[0-9]+$/,"");
            let num = nextNumberForPrefix[prefix] ? nextNumberForPrefix[prefix] : 1;

            let candidate: string;
            do {
                candidate = prefix + num;
                num++;
            } while (ids[candidate]);

            setAttribute(duplicates[i],"id",candidate);
            ids[candidate] = true;
            nextNumberForPrefix[prefix] = num;
        }
    }
}

function incIgnoreMutations(): void {
    UndoManager.addAction(decIgnoreMutations);
    ignoreMutations++;
}

function decIgnoreMutations(): void {
    UndoManager.addAction(incIgnoreMutations);
    ignoreMutations--;
    if (ignoreMutations < 0)
        throw new Error("ignoreMutations is now negative");
}

// public
export function ignoreMutationsWhileExecuting<T>(fun: () => T): T {
    incIgnoreMutations();
    try {
        return fun();
    }
    finally {
        decIgnoreMutations();
    }
}

// public
export function getIgnoreMutations(): number {
    return ignoreMutations;
}

export function cloneRangeContents(range: Range): Node[] {
    let nodeSet = new Collections.NodeSet();
    let ancestorSet = new Collections.NodeSet();
    let det = range.detail();
    let outermost = range.getOutermostNodes();

    let haveContent = false;
    for (let i = 0; i < outermost.length; i++) {
        if (!Traversal.isWhitespaceTextNode(outermost[i]))
            haveContent = true;
        nodeSet.add(outermost[i]);
        for (let node = outermost[i]; node != null; node = node.parentNode)
            ancestorSet.add(node);
    }

    if (!haveContent)
        return new Array();

    let clone = recurse(det.commonAncestor);

    let ancestor = det.commonAncestor;
    while (Types.isInlineNode(ancestor)) {
        let ancestorClone = cloneNode(ancestor.parentNode,false);
        appendChild(ancestorClone,clone);
        ancestor = ancestor.parentNode;
        clone = ancestorClone;
    }

    let childArray = new Array<Node>();
    switch (clone._type) {
    case ElementTypes.HTML_UL:
    case ElementTypes.HTML_OL:
        childArray.push(clone);
        break;
    default:
        for (let child = clone.firstChild; child != null; child = child.nextSibling)
            childArray.push(child);
        Formatting.pushDownInlineProperties(childArray);
        break;
    }

    return childArray;

    function recurse(parent: Node): Node {
        let clone = cloneNode(parent,false);
        for (let child = parent.firstChild; child != null; child = child.nextSibling) {
            if (nodeSet.contains(child)) {
                if ((child instanceof Text) &&
                    (child == range.start.node) &&
                    (child == range.end.node)) {
                    let substring = child.nodeValue.substring(range.start.offset,
                                                              range.end.offset);
                    appendChild(clone,createTextNode(document,substring));
                }
                else if ((child instanceof Text) &&
                         (child == range.start.node)) {
                    let substring = child.nodeValue.substring(range.start.offset);
                    appendChild(clone,createTextNode(document,substring));
                }
                else if ((child instanceof Text) &&
                         (child == range.end.node)) {
                    let substring = child.nodeValue.substring(0,range.end.offset);
                    appendChild(clone,createTextNode(document,substring));
                }
                else {
                    appendChild(clone,cloneNode(child,true));
                }
            }
            else if (ancestorSet.contains(child)) {
                appendChild(clone,recurse(child));
            }
        }
        return clone;
    }
}
