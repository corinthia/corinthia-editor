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

// FIXME: The TOC/ItemList stuff won't work with Undo, because we're making DOM mutations in
// response to other DOM mutations, so at undo time the changes will be made twice

(function(api) {

    var Outline = api.Outline; // export

    var Clipboard = api.Clipboard; // import
    var Collections = api.Collections; // import
    var Cursor = api.Cursor; // import
    var DOM = api.DOM; // import
    var Editor = api.Editor; // import
    var Hierarchy = api.Hierarchy; // import
    var Position = api.Position; // import
    var PostponedActions = api.PostponedActions; // import
    var Range = api.Range; // import
    var Selection = api.Selection; // import
    var Styles = api.Styles; // import
    var Traversal = api.Traversal; // import
    var Types = api.Types; // import
    var UndoManager = api.UndoManager; // import
    var Util = api.Util; // import

    var itemsByNode = null;
    var refsById = null;
    var nextItemId = 1;
    var outlineDirty = false;
    var ignoreModifications = 0;
    var sectionNumberRegex = /^\s*(Chapter\s+)?\d+(\.\d+)*\.?\s+/i;
    var figureNumberRegex = /^\s*Figure\s+\d+(\.\d+)*:?\s*/i;
    var tableNumberRegex = /^\s*Table\s+\d+(\.\d+)*:?\s*/i;
    var sections = null;
    var figures = null;
    var tables = null;
    var doneInit = false;
    var printMode = false;

    function Category(type,nodeFilter,numberRegex) {
        this.type = type;
        this.nodeFilter = nodeFilter;
        this.numberRegex = numberRegex;
        this.list = new Util.DoublyLinkedList();
        this.tocs = new Collections.NodeMap();
    }

    function addItemInternal(category,item,prevItem,title) {
        UndoManager.addAction(removeItemInternal,category,item);
        category.list.insertAfter(item,prevItem);
        item.title = title;
        category.tocs.forEach(function(node,toc) { TOC_addOutlineItem(toc,item.id); });
        Editor.addOutlineItem(item.id,category.type,title);
    }

    function removeItemInternal(category,item) {
        UndoManager.addAction(addItemInternal,category,item,item.prev,item.title);
        category.list.remove(item);
        category.tocs.forEach(function(node,toc) { TOC_removeOutlineItem(toc,item.id); });
        item.title = null;
        Editor.removeOutlineItem(item.id);
    }

    function Category_add(category,node) {
        var item = itemsByNode.get(node);
        if (item == null)
            item = new OutlineItem(category,node);

        var prevItem = findPrevItemOfType(node,category.nodeFilter);
        addItemInternal(category,item,prevItem,null);

        // Register for notifications to changes to this item's node content. We may need to
        // update the title when such a modification occurs.
        node.addEventListener("DOMSubtreeModified",item.modificationListener);

        OutlineItem_updateItemTitle(item);
        scheduleUpdateStructure();
        return item;

        function findPrevItemOfType(node,typeFun) {
            do node = Traversal.prevNode(node);
            while ((node != null) && !typeFun(node));
            return (node == null) ? null : itemsByNode.get(node);
        }
    }

    function findFirstTextDescendant(node) {
        if (Traversal.isWhitespaceTextNode(node))
            return;
        if (node.nodeType == Node.TEXT_NODE)
            return node;
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            var result = findFirstTextDescendant(child);
            if (result != null)
                return result;
        }
        return null;
    }

    function Category_remove(category,node) {
        var item = itemsByNode.get(node);
        if (item == null) {
            throw new Error("Attempt to remove non-existant "+node.nodeName+
                            " item "+node.getAttribute("id"));
        }
        removeItemInternal(category,item);
        item.node.removeEventListener("DOMSubtreeModified",item.modificationListener);
        var titleNode = OutlineItem_getTitleNode(item,false);
        if ((titleNode != null) &&
            ((item.type == "figure") || (item.type == "table")) &&
            (titleNode.firstChild == null) &&
            (titleNode.lastChild == null)) {
            DOM.deleteNode(titleNode);
        }
        scheduleUpdateStructure();
    }

    function addTOCInternal(category,node,toc) {
        UndoManager.addAction(removeTOCInternal,category,node);
        category.tocs.put(node,toc);
    }

    function removeTOCInternal(category,node) {
        var toc = category.tocs.get(node);
        if (toc == null)
            throw new Error("Attempt to remove ItemList that doesn't exist");

        UndoManager.addAction(addTOCInternal,category,node,toc);

        category.tocs.remove(node);
    }

    function Category_addTOC(category,node) {
        var toc = new TOC(node);
        addTOCInternal(category,node,toc);

        for (var item = category.list.first; item != null; item = item.next) {
            TOC_addOutlineItem(toc,item.id);
            TOC_updateOutlineItem(toc,item.id,item.title);
        }

        scheduleUpdateStructure();
    }

    function Category_removeTOC(category,node) {
        removeTOCInternal(category,node);
    }

    function TOC(node) {
        this.node = node;
        this.textNodes = new Object();
    }

    function TOC_addOutlineItem(toc,id) {
        toc.textNodes[id] = DOM.createTextNode(document,"");
    }

    function TOC_removeOutlineItem(toc,id) {
        delete toc.textNodes[id];
    }

    function TOC_updateOutlineItem(toc,id,title) {
        DOM.setNodeValue(toc.textNodes[id],title);
    }

    function TOC_updateStructure(toc,structure,toplevelShadows,pageNumbers) {
        Hierarchy.ensureValidHierarchy(toc.node);
        DOM.deleteAllChildren(toc.node);

        var cls = toc.node.getAttribute("class");

        if (toplevelShadows.length == 0) {
            createEmptyTOC(toc.node);
        }
        else {
            recurse(toplevelShadows,toc.node,1);
        }

        if (printMode) {
            var brk = DOM.createElement(document,"DIV");
            DOM.setStyleProperties(brk,{ "clear": "both" });
            DOM.appendChild(toc.node,brk);
        }

        function createEmptyTOC(parent) {
            if (!printMode) {
                var str = "";

                if (cls == Types.Keys.SECTION_TOC)
                    str = "[No sections defined]";
                else if (cls == Types.Keys.FIGURE_TOC)
                    str = "[No figures defined]";
                else if (cls == Types.Keys.TABLE_TOC)
                    str = "[No tables defined]";

                var text = DOM.createTextNode(document,str);

                var div = DOM.createElement(document,"P");
                DOM.setAttribute(div,"class","toc1");
                DOM.appendChild(div,text);
                DOM.appendChild(parent,div);
            }
        }

        function recurse(shadows,parent,level) {
            if (level > 3)
                return;

            for (var i = 0; i < shadows.length; i++) {
                var shadow = shadows[i];
                var item = shadow.item;

                if (printMode) {
                    var div = DOM.createElement(document,"P");
                    DOM.setAttribute(div,"class","toc"+level+"-print");
                    DOM.appendChild(parent,div);

                    var leftSpan = DOM.createElement(document,"SPAN");
                    DOM.setAttribute(leftSpan,"class","toctitle");

                    var rightSpan = DOM.createElement(document,"SPAN");
                    DOM.setAttribute(rightSpan,"class","tocpageno");

                    DOM.appendChild(div,leftSpan);
                    DOM.appendChild(div,rightSpan);

                    if (item.computedNumber != null) {
                        var text = DOM.createTextNode(document,item.computedNumber+" ");
                        DOM.appendChild(leftSpan,text);
                    }

                    DOM.appendChild(leftSpan,toc.textNodes[item.id]);
                    var pageNo = pageNumbers ? pageNumbers.get(item.node) : null;
                    if (pageNo == null)
                        DOM.appendChild(rightSpan,DOM.createTextNode(document,"XXXX"));
                    else
                        DOM.appendChild(rightSpan,DOM.createTextNode(document,pageNo));
                }
                else {
                    var div = DOM.createElement(document,"P");
                    DOM.setAttribute(div,"class","toc"+level);
                    DOM.appendChild(parent,div);

                    var a = DOM.createElement(document,"A");
                    DOM.setAttribute(a,"href","#"+item.id);
                    DOM.appendChild(div,a);

                    if (item.computedNumber != null)
                        DOM.appendChild(a,DOM.createTextNode(document,item.computedNumber+" "));
                    DOM.appendChild(a,toc.textNodes[item.id]);
                }

                recurse(shadow.children,parent,level+1);
            }
        }
    }

    function OutlineItem(category,node) {
        var type = category.type;
        var item = this;
        if ((node != null) && (node.hasAttribute("id"))) {
            this.id = node.getAttribute("id");
        }
        else {
            this.id = generateItemId();
            if (node != null)
                DOM.setAttribute(node,"id",this.id);
        }
        this.category = category;
        this.type = type;
        this.node = node;
        this.title = null;
        this.computedNumber = null;

        this.spareSpan = DOM.createElement(document,"SPAN");
        DOM.appendChild(this.spareSpan,DOM.createTextNode(document,""));
        var spanClass = null;
        if (this.type == "section")
            spanClass = Types.Keys.HEADING_NUMBER;
        else if (this.type == "figure")
            spanClass = Types.Keys.FIGURE_NUMBER;
        else if (this.type == "table")
            spanClass = Types.Keys.TABLE_NUMBER;
        DOM.setAttribute(this.spareSpan,"class",spanClass);

        // titleNode
        if (this.type == "figure") {
            this.spareTitle = DOM.createElement(document,"FIGCAPTION");
        }
        else if (this.type == "table") {
            this.spareTitle = DOM.createElement(document,"CAPTION");
        }

        this.prev = null;
        this.next = null;
        this.modificationListener = function(event) { itemModified(item); }

        itemsByNode.put(this.node,this);

        Object.seal(this);
        return;

        function generateItemId() {
            var id;
            do {
                id = "item"+(nextItemId++);
            } while (document.getElementById(id) != null);
            return id;
        }
    }

    function OutlineItem_getTitleNode(item,create) {
        if (item.type == "section") {
            return item.node;
        }
        else if (item.type == "figure") {
            var titleNode = findChild(item.node,HTML_FIGCAPTION);
            if ((titleNode == null) && create) {
                titleNode = item.spareTitle;
                DOM.appendChild(item.node,titleNode);
            }
            return titleNode;
        }
        else if (item.type == "table") {
            var titleNode = findChild(item.node,HTML_CAPTION);
            if ((titleNode == null) && create) {
                titleNode = item.spareTitle;
                DOM.insertBefore(item.node,titleNode,item.node.firstChild);
            }
            return titleNode;
        }

        function findChild(node,type) {
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                if (child._type == type)
                    return child;
            }
            return null;
        }
    }

    function OutlineItem_updateItemTitle(item) {
        var titleNode = OutlineItem_getTitleNode(item,false);
        if (titleNode != null)
            newTitle = Util.normalizeWhitespace(Traversal.getNodeText(titleNode));
        else
            newTitle = "";

        if (item.title != newTitle) {
            UndoManager.addAction(Editor.updateOutlineItem,item.id,item.title);
            Editor.updateOutlineItem(item.id,newTitle);
            item.title = newTitle;
            item.category.tocs.forEach(function(node,toc) {
                TOC_updateOutlineItem(toc,item.id,item.title);
            });
        }
    }

    function getNodeTextAfter(node) {
        var text = "";
        for (var child = node.nextSibling; child != null; child = child.nextSibling)
            text += Traversal.getNodeText(child);
        return text;
    }

    // private
    function itemModified(item) {
        if (UndoManager.isActive())
            return;
        if (ignoreModifications > 0)
            return;
        OutlineItem_updateItemTitle(item);
        updateRefsForItem(item);
    }

    function addRefForId(id,node) {
        UndoManager.addAction(removeRefForId,id,node);
        if (refsById[id] == null)
            refsById[id] = new Array();
        refsById[id].push(node);
    }

    function removeRefForId(id,node) {
        UndoManager.addAction(addRefForId,id,node);
        if (refsById[id] == null)
            throw new Error("refRemoved: refsById["+id+"] is null");
        var index = refsById[id].indexOf(node);
        if (index < 0)
            throw new Error("refRemoved: refsById["+id+"] does not contain node");
        refsById[id].splice(index,1);
        if (refsById[id] == null)
            delete refsById[id];
    }

    // private
    function refInserted(node) {
        var href = node.getAttribute("href");
        if (href.charAt(0) != "#")
            throw new Error("refInserted: not a # reference");
        var id = href.substring(1);
        addRefForId(id,node);
        scheduleUpdateStructure();
    }

    // private
    function refRemoved(node) {
        var href = node.getAttribute("href");
        if (href.charAt(0) != "#")
            throw new Error("refInserted: not a # reference");
        var id = href.substring(1);
        removeRefForId(id,node);
    }

    // private
    function acceptNode(node) {
        for (var p = node; p != null; p = p.parentNode) {
            if ((p._type == HTML_SPAN) && (p.getAttribute("class") == Types.Keys.HEADING_NUMBER))
                return false;
        }
        return true;
    }

    // private
    function docNodeInserted(event) {
        if (UndoManager.isActive())
            return;
        if (DOM.getIgnoreMutations())
            return;
        try {
            if (!acceptNode(event.target))
                return;
            recurse(event.target);
        }
        catch (e) {
            Editor.error(e);
        }

        function recurse(node) {
            switch (node._type) {
            case HTML_H1:
            case HTML_H2:
            case HTML_H3:
            case HTML_H4:
            case HTML_H5:
            case HTML_H6: {
                if (!Types.isInTOC(node))
                    Category_add(sections,node);
                break;
            }
            case HTML_FIGURE:
                Category_add(figures,node);
                break;
            case HTML_TABLE:
                Category_add(tables,node);
                break;
            case HTML_A: {
                if (Types.isRefNode(node) && !Types.isInTOC(node)) {
                    refInserted(node);
                }
                break;
            }
            case HTML_NAV: {
                var cls = node.getAttribute("class");
                if (cls == Types.Keys.SECTION_TOC)
                    Category_addTOC(sections,node);
                else if (cls == Types.Keys.FIGURE_TOC)
                    Category_addTOC(figures,node);
                else if (cls == Types.Keys.TABLE_TOC)
                    Category_addTOC(tables,node);
                break;
            }
            }

            var next;
            for (var child = node.firstChild; child != null; child = next) {
                next = child.nextSibling;
                recurse(child);
            }
        }
    }

    // private
    function docNodeRemoved(event) {
        if (UndoManager.isActive())
            return;
        if (DOM.getIgnoreMutations())
            return;
        try {
            if (!acceptNode(event.target))
                return;
            recurse(event.target);
        }
        catch (e) {
            Editor.error(e);
        }

        function recurse(node) {
            switch (node._type) {
            case HTML_H1:
            case HTML_H2:
            case HTML_H3:
            case HTML_H4:
            case HTML_H5:
            case HTML_H6:
                if (!Types.isInTOC(node))
                    Category_remove(sections,node);
                break;
            case HTML_FIGURE:
                Category_remove(figures,node);
                break;
            case HTML_TABLE:
                Category_remove(tables,node);
                break;
            case HTML_A:
                if (Types.isRefNode(node) && !Types.isInTOC(node))
                    refRemoved(node);
                break;
            case HTML_NAV:
                var cls = node.getAttribute("class");
                if (cls == Types.Keys.SECTION_TOC)
                    Category_removeTOC(sections,node);
                else if (cls == Types.Keys.FIGURE_TOC)
                    Category_removeTOC(figures,node);
                else if (cls == Types.Keys.TABLE_TOC)
                    Category_removeTOC(tables,node);
                break;
            }

            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }

    // private
    function scheduleUpdateStructure() {
        if (UndoManager.isActive())
            return;
        if (!outlineDirty) {
            outlineDirty = true;
            PostponedActions.add(updateStructure);
        }
    }

    Outline.scheduleUpdateStructure = scheduleUpdateStructure;

    // private
    function updateStructure() {
        if (!outlineDirty)
            return;
        outlineDirty = false;
        if (UndoManager.isActive())
            throw new Error("Structure update event while undo or redo active");
        Selection.preserveWhileExecuting(function() {
            updateStructureReal();
        });
    }

    function Shadow(node) {
        this.node = node;
        this.item = itemsByNode.get(node);
        this.children = [];
        this.parent = null;

        switch (node._type) {
        case HTML_H1:
            this.level = 1;
            break;
        case HTML_H2:
            this.level = 2;
            break;
        case HTML_H3:
            this.level = 3;
            break;
        case HTML_H4:
            this.level = 4;
            break;
        case HTML_H5:
            this.level = 5;
            break;
        case HTML_H6:
            this.level = 6;
            break;
        default:
            this.level = 0;
            break;
        }
    }

    function Shadow_last(shadow) {
        if (shadow.children.length == 0)
            return shadow;
        else
            return Shadow_last(shadow.children[shadow.children.length-1]);
    }

    function Shadow_outerNext(shadow,structure) {
        var last = Shadow_last(shadow);
        if (last == null)
            return null;
        else if (last.item.next == null)
            return null;
        else
            return structure.shadowsByNode.get(last.item.next.node);
    }

    function firstTextDescendant(node) {
        if (node.nodeType == Node.TEXT_NODE)
            return node;
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            var result = firstTextDescendant(child);
            if (result != null)
                return result;
        }
        return null;
    }

    function Structure() {
        this.toplevelSections = new Array();
        this.toplevelFigures = new Array();
        this.toplevelTables = new Array();
        this.shadowsByNode = new Collections.NodeMap();
    }

    function discoverStructure() {
        var structure = new Structure();
        var nextToplevelSectionNumber = 1;
        var nextFigureNumber = 1;
        var nextTableNumber = 1;
        var headingNumbering = Styles.headingNumbering();

        var counters = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, table: 0, figure: 0 };

        var current = null;

        for (var section = sections.list.first; section != null; section = section.next) {
            structure.shadowsByNode.put(section.node,new Shadow(section.node));
        }
        for (var figure = figures.list.first; figure != null; figure = figure.next) {
            structure.shadowsByNode.put(figure.node,new Shadow(figure.node));
        }
        for (var table = tables.list.first; table != null; table = table.next) {
            structure.shadowsByNode.put(table.node,new Shadow(table.node));
        }

        for (var section = sections.list.first; section != null; section = section.next) {
            var shadow = structure.shadowsByNode.get(section.node);
            shadow.parent = null;
            shadow.children = [];
            shadow.nextChildSectionNumber = 1;
        }

        ignoreModifications++;

        for (var section = sections.list.first; section != null; section = section.next) {
            var shadow = structure.shadowsByNode.get(section.node);
            var node = section.node;
            var item = shadow.item;

            if (!headingNumbering || (DOM.getAttribute(item.node,"class") == "Unnumbered")) {
                item.computedNumber = null;
            }
            else {
                var level = parseInt(node.nodeName.charAt(1));
                counters[node.nodeName.toLowerCase()]++;
                for (var inner = level+1; inner <= 6; inner++)
                    counters["h"+inner] = 0;
                item.computedNumber = "";
                for (var i = 1; i <= level; i++) {
                    if (i == 1)
                        item.computedNumber += counters["h"+i];
                    else
                        item.computedNumber += "." + counters["h"+i];
                }
            }

            while ((current != null) && (shadow.level < current.level+1))
                current = current.parent;

            shadow.parent = current;
            if (current == null)
                structure.toplevelSections.push(shadow);
            else
                current.children.push(shadow);

            current = shadow;
        }

        for (var figure = figures.list.first; figure != null; figure = figure.next) {
            var shadow = structure.shadowsByNode.get(figure.node);
            var item = shadow.item;

            var titleNode = OutlineItem_getTitleNode(item,false);
            if ((titleNode == null) || DOM.getAttribute(titleNode,"class") == "Unnumbered") {
                item.computedNumber = null;
            }
            else {
                counters.figure++;
                item.computedNumber = ""+counters.figure;
            }

            structure.toplevelFigures.push(shadow);
        }

        for (var table = tables.list.first; table != null; table = table.next) {
            var shadow = structure.shadowsByNode.get(table.node);
            var item = shadow.item;

            var titleNode = OutlineItem_getTitleNode(item,false);
            if ((titleNode == null) || DOM.getAttribute(titleNode,"class") == "Unnumbered") {
                item.computedNumber = null;
            }
            else {
                counters.table++;
                item.computedNumber = ""+counters.table;
            }

            structure.toplevelTables.push(shadow);
        }

        ignoreModifications--;

        return structure;
    }

    function updateStructureReal(pageNumbers) {
        var structure = discoverStructure();

        for (var section = sections.list.first; section != null; section = section.next) {
            var shadow = structure.shadowsByNode.get(section.node);
            updateRefsForItem(shadow.item);
        }

        for (var figure = figures.list.first; figure != null; figure = figure.next) {
            var shadow = structure.shadowsByNode.get(figure.node);
            updateRefsForItem(shadow.item);
        }

        for (var table = tables.list.first; table != null; table = table.next) {
            var shadow = structure.shadowsByNode.get(table.node);
            updateRefsForItem(shadow.item);
        }

        sections.tocs.forEach(function (node,toc) {
            TOC_updateStructure(toc,structure,structure.toplevelSections,pageNumbers);
        });
        figures.tocs.forEach(function (node,toc) {
            TOC_updateStructure(toc,structure,structure.toplevelFigures,pageNumbers);
        });
        tables.tocs.forEach(function (node,toc) {
            TOC_updateStructure(toc,structure,structure.toplevelTables,pageNumbers);
        });

        Editor.outlineUpdated();
    }

    Outline.getOutline = function() {
        var structure = discoverStructure();
        var encSections = new Array();
        var encFigures = new Array();
        var encTables = new Array();

        for (var i = 0; i < structure.toplevelSections.length; i++)
            encodeShadow(structure.toplevelSections[i],encSections);
        for (var i = 0; i < structure.toplevelFigures.length; i++)
            encodeShadow(structure.toplevelFigures[i],encFigures);
        for (var i = 0; i < structure.toplevelTables.length; i++)
            encodeShadow(structure.toplevelTables[i],encTables);

        return { sections: encSections,
                 figures: encFigures,
                 tables: encTables };

        function encodeShadow(shadow,result) {
            var encChildren = new Array();
            for (var i = 0; i < shadow.children.length; i++)
                encodeShadow(shadow.children[i],encChildren);

            var obj = { id: shadow.item.id,
                        number: shadow.item.computedNumber ? shadow.item.computedNumber : "",
                        children: encChildren };
            result.push(obj);
        }
    }

    function updateRefsForItem(item) {
        var id = item.node.getAttribute("id");
        var refs = refsById[id];
        if (refs == null)
            return;
        for (var i = 0; i < refs.length; i++) {
            DOM.deleteAllChildren(refs[i]);
            var text = null;

            var className = DOM.getAttribute(refs[i],"class");
            if (className == "uxwrite-ref-num") {
                text = item.computedNumber;
            }
            else if (className == "uxwrite-ref-text") {
                if (item.type == "section") {
                    if (item.numberSpan != null)
                        text = getNodeTextAfter(item.numberSpan);
                    else
                        text = Util.normalizeWhitespace(Traversal.getNodeText(item.node));
                }
                else if ((item.type == "figure") || (item.type == "table")) {
                    var titleNode = OutlineItem_getTitleNode(item,false);
                    if (titleNode != null) {
                        text = Traversal.getNodeText(titleNode);

                        if ((item.computedNumber != null) && (item.type == "figure"))
                            text = "Figure "+item.computedNumber+": "+text;
                        else if ((item.computedNumber != null) && (item.type == "table"))
                            text = "Table "+item.computedNumber+": "+text;
                    }
                }
            }
            else if (className == "uxwrite-ref-caption-text") {
                if (item.type == "section") {
                    if (item.numberSpan != null)
                        text = getNodeTextAfter(item.numberSpan);
                    else
                        text = Util.normalizeWhitespace(Traversal.getNodeText(item.node));
                }
                else if ((item.type == "figure") || (item.type == "table")) {
                    var titleNode = OutlineItem_getTitleNode(item,false);
                    if (titleNode != null) {
                        if (item.numberSpan != null)
                            text = getNodeTextAfter(item.numberSpan);
                        else
                            text = Util.normalizeWhitespace(Traversal.getNodeText(titleNode));
                    }
                }
            }
            else if (className == "uxwrite-ref-label-num") {
                if (item.computedNumber != null) {
                    if (item.type == "section")
                        text = "Section "+item.computedNumber;
                    else if (item.type == "figure")
                        text = "Figure "+item.computedNumber;
                    else if (item.type == "table")
                        text = "Table "+item.computedNumber;
                }
            }
            else {
                if (item.computedNumber != null)
                    text = item.computedNumber;
                else
                    text = item.title;
            }

            if (text == null)
                text = "?";

            DOM.appendChild(refs[i],DOM.createTextNode(document,text));
        }
    }

    Outline.plainText = function() {
        var strings = new Array();
        var structure = discoverStructure();

        strings.push("Sections:\n");
        for (var section = sections.list.first; section != null; section = section.next) {
            var shadow = structure.shadowsByNode.get(section.node);
            if (shadow.level == 1)
                printSectionRecursive(shadow,"    ");
        }
        strings.push("Figures:\n");
        for (var figure = figures.list.first; figure != null; figure = figure.next) {
            var shadow = structure.shadowsByNode.get(figure.node);
            var titleNode = OutlineItem_getTitleNode(figure,false);
            var title = titleNode ? Traversal.getNodeText(titleNode) : "[no caption]";
            if (shadow.item.computedNumber != null) {
                if (title.length > 0)
                    title = shadow.item.computedNumber+" "+title;
                else
                    title = shadow.item.computedNumber;
            }
            strings.push("    "+title+" ("+figure.id+")\n");
        }
        strings.push("Tables:\n");
        for (var table = tables.list.first; table != null; table = table.next) {
            var shadow = structure.shadowsByNode.get(table.node);
            var titleNode = OutlineItem_getTitleNode(table,false);
            var title = titleNode ? Traversal.getNodeText(titleNode) : "[no caption]";
            if (shadow.item.computedNumber != null) {
                if (title.length > 0)
                    title = shadow.item.computedNumber+" "+title;
                else
                    title = shadow.item.computedNumber;
            }
            strings.push("    "+title+" ("+table.id+")\n");
        }
        return strings.join("");

        function printSectionRecursive(shadow,indent) {
            var titleNode = OutlineItem_getTitleNode(shadow.item,false);
            var content = Traversal.getNodeText(titleNode);
            if (shadow.item.computedNumber != null)
                content = shadow.item.computedNumber+" "+content;
            if (Util.isWhitespaceString(content))
                content = "[empty]";
            strings.push(indent+content+" ("+shadow.item.id+")\n");
            for (var i = 0; i < shadow.children.length; i++)
                printSectionRecursive(shadow.children[i],indent+"    ");
        }
    }

    // public
    Outline.init = function() {
        Selection.preserveWhileExecuting(function() {

            function isTableNode(node) {
                return (node._type == HTML_TABLE);
            }

            function isFigureNode(node) {
                return (node._type == HTML_FIGURE);
            }

            function isNonTOCHeadingNode(node) {
                return (Types.HEADING_ELEMENTS[node._type] && !Types.isInTOC(node));
            }

            sections = new Category("section",isNonTOCHeadingNode,sectionNumberRegex);
            figures = new Category("figure",isFigureNode,figureNumberRegex);
            tables = new Category("table",isTableNode,tableNumberRegex);
            itemsByNode = new Collections.NodeMap();
            refsById = new Object();

            DOM.ensureUniqueIds(document.documentElement);
            document.addEventListener("DOMNodeInserted",docNodeInserted);
            document.addEventListener("DOMNodeRemoved",docNodeRemoved);

            docNodeInserted({target:document});
        });
        doneInit = true;
    }

    // public (for the undo tests, when they report results)
    Outline.removeListeners = function() {
        document.removeEventListener("DOMNodeInserted",docNodeInserted);
        document.removeEventListener("DOMNodeRemoved",docNodeRemoved);

        removeCategoryListeners(sections);
        removeCategoryListeners(figures);
        removeCategoryListeners(tables);

        function removeCategoryListeners(category) {
            for (var item = category.list.first; item != null; item = item.next)
                item.node.removeEventListener("DOMSubtreeModified",item.modificationListener);
        }
    }

    // private
    function getShadowNodes(structure,shadow,result) {
        var endShadow = Shadow_outerNext(shadow,structure);
        var endNode = endShadow ? endShadow.item.node : null;
        for (var n = shadow.item.node; (n != null) && (n != endNode); n = n.nextSibling)
            result.push(n);
    }

    // public
    Outline.moveSection = function(sectionId,parentId,nextId) {
        UndoManager.newGroup("Move section");
        Selection.clear();

        updateStructure(); // make sure pointers are valid
        // FIXME: I don't think we'll need the updateStructure() call now that we have
        // discoverStructure(). In fact this function is a perfect illustration of why
        // waiting till after the postponed action has been performed before relying on the
        // pointer validity was a problem.


        var structure = discoverStructure();

        var node = document.getElementById(sectionId);
        var section = itemsByNode.get(node);
        var shadow = structure.shadowsByNode.get(node);

        // FIXME: We should throw an exception if a parentId or nextId which does not exist
        // in the document is specified. However there are currently some tests (like
        // moveSection-nested*) which rely us interpreting such parameters as null.
        var parentNode = parentId ? document.getElementById(parentId) : null;
        var nextNode = nextId ? document.getElementById(nextId) : null;
        var parent = parentNode ? structure.shadowsByNode.get(parentNode) : null;
        var next = nextNode ? structure.shadowsByNode.get(nextNode) : null;

        var sectionNodes = new Array();
        getShadowNodes(structure,shadow,sectionNodes);

        if ((next == null) && (parent != null))
            next = Shadow_outerNext(parent,structure);

        if (next == null) {
            for (var i = 0; i < sectionNodes.length; i++)
                DOM.appendChild(document.body,sectionNodes[i]);
        }
        else {
            for (var i = 0; i < sectionNodes.length; i++)
                DOM.insertBefore(next.item.node.parentNode,sectionNodes[i],next.item.node);
        }

        var pos = new Position.Position(node,0,node,0);
        pos = Position.closestMatchForwards(pos,Position.okForInsertion);
        Selection.set(pos.node,pos.offset,pos.node,pos.offset);

        scheduleUpdateStructure();
        PostponedActions.add(UndoManager.newGroup);
    }

    // public
    Outline.deleteItem = function(itemId) {
        UndoManager.newGroup("Delete outline item");
        var structure = discoverStructure();
        Selection.preserveWhileExecuting(function() {
            var node = document.getElementById(itemId);
            var item = itemsByNode.get(node);
            var shadow = structure.shadowsByNode.get(item.node);
            if (item.type == "section") {
                var sectionNodes = new Array();
                getShadowNodes(structure,shadow,sectionNodes);
                for (var i = 0; i < sectionNodes.length; i++)
                    DOM.deleteNode(sectionNodes[i]);
            }
            else {
                DOM.deleteNode(item.node);
            }
        });

        // Ensure the cursor or selection start/end positions are valid positions that the
        // user is allowed to move to. This ensures we get an accurate rect for each position,
        // avoiding an ugly effect where the cursor occupies the entire height of the document
        // and is displayed on the far-left edge of the editing area.
        var selRange = Selection.get();
        if (selRange != null) {
            var start = Position.closestMatchForwards(selRange.start,Position.okForMovement);
            var end = Position.closestMatchForwards(selRange.end,Position.okForMovement);
            Selection.set(start.node,start.offset,end.node,end.offset);
        }

        scheduleUpdateStructure();
        PostponedActions.add(Cursor.ensureCursorVisible);
        PostponedActions.add(UndoManager.newGroup);
    }

    // public
    Outline.goToItem = function(itemId) {
        if (itemId == null) {
            window.scrollTo(0);
        }
        else {
            var node = document.getElementById(itemId);
            if (node == null) {
                // FIXME: this can happen if the user added some headings, pressed undo one or
                // more times (in which case the editor's view of the outline structure fails to
                // be updated), and then they click on an item. This is really an error but we
                // handle it gracefully for now rather than causing a null pointer exception to
                // be thrown.
                return;
            }
            var position = new Position.Position(node,0);
            position = Position.closestMatchForwards(position,Position.okForMovement);
            Selection.set(position.node,position.offset,position.node,position.offset);

            var section = document.getElementById(itemId);
            var location = webkitConvertPointFromNodeToPage(section,new WebKitPoint(0,0));
            window.scrollTo(0,location.y);
        }
    }

    // public
    Outline.getItemElement = function(itemId) {
        return document.getElementById(itemId);
    }

    // public
    Outline.setNumbered = function(itemId,numbered) {
        var node = document.getElementById(itemId);
        var item = itemsByNode.get(node);

        Selection.preserveWhileExecuting(function() {
            if (item.type == "section") {
                if (numbered)
                    DOM.removeAttribute(node,"class");
                else
                    DOM.setAttribute(node,"class","Unnumbered");
            }
            else if ((item.type == "figure") || (item.type == "table")) {
                if (numbered) {
                    var caption = OutlineItem_getTitleNode(item,true);
                    DOM.removeAttribute(caption,"class");
                }
                else {
                    var caption = OutlineItem_getTitleNode(item,false);
                    if (caption != null) {
                        if (Util.nodeHasContent(caption))
                            DOM.setAttribute(caption,"class","Unnumbered");
                        else
                            DOM.deleteNode(caption);
                    }
                }
            }
        });

        scheduleUpdateStructure();
    }

    // public
    Outline.setTitle = function(itemId,title) {
        var node = document.getElementById(itemId);
        var item = itemsByNode.get(node);
        Selection.preserveWhileExecuting(function() {
            var titleNode = OutlineItem_getTitleNode(item,true);
            var oldEmpty = (item.title == "");
            var newEmpty = (title == "");
            if (oldEmpty != newEmpty) {
                // Add or remove the : at the end of table and figure numbers
                scheduleUpdateStructure();
            }
            if (item.numberSpan != null) {
                while (item.numberSpan.nextSibling != null)
                    DOM.deleteNode(item.numberSpan.nextSibling);
            }
            else {
                DOM.deleteAllChildren(titleNode);
            }
            DOM.appendChild(titleNode,DOM.createTextNode(document,title));
            OutlineItem_updateItemTitle(item);
        });
    }

    // private
    // FIXME: prevent a TOC from being inserted inside a heading, figure, or table
    function insertTOC(key,initialText) {
        var div = DOM.createElement(document,"NAV");
        DOM.setAttribute(div,"class",key);
        Cursor.makeContainerInsertionPoint();
        Clipboard.pasteNodes([div]);
    }

    // public
    Outline.insertTableOfContents = function() {
        insertTOC(Types.Keys.SECTION_TOC);
    }

    // public
    Outline.insertListOfFigures = function() {
        insertTOC(Types.Keys.FIGURE_TOC);
    }

    // public
    Outline.insertListOfTables = function() {
        insertTOC(Types.Keys.TABLE_TOC);
    }

    // public
    Outline.setPrintMode = function(newPrintMode) {
        printMode = newPrintMode;
        scheduleUpdateStructure();
    }

    // public
    Outline.examinePrintLayout = function(pageHeight) {
        var result = new Object();
        var structure = discoverStructure();
        var pageNumbers = new Collections.NodeMap();

        result.destsByPage = new Object();
        result.linksByPage = new Object();
        result.leafRectsByPage = new Object();

        itemsByNode.forEach(function(node,item) {
            var rect = node.getBoundingClientRect();
            var pageNo = 1+Math.floor(rect.top/pageHeight);
            var pageTop = (pageNo-1)*pageHeight;
            var id = node.getAttribute("id");
            pageNumbers.put(node,pageNo);

            if (result.destsByPage[pageNo] == null)
                result.destsByPage[pageNo] = new Array();
            result.destsByPage[pageNo].push({ itemId: id,
                                              x: rect.left,
                                              y: rect.top - pageTop});
        });

        var links = document.getElementsByTagName("A");
        for (var i = 0; i < links.length; i++) {
            var a = links[i];

            if (!a.hasAttribute("href"))
                continue;

            var offset = DOM.nodeOffset(a);
            var range = new Range.Range(a.parentNode,offset,a.parentNode,offset+1);
            var rects = Range.getClientRects(range);
            for (var rectIndex = 0; rectIndex < rects.length; rectIndex++) {
                var rect = rects[rectIndex];
                var pageNo = 1+Math.floor(rect.top/pageHeight);
                var pageTop = (pageNo-1)*pageHeight;

                if (result.linksByPage[pageNo] == null)
                    result.linksByPage[pageNo] = new Array();
                result.linksByPage[pageNo].push({ pageNo: pageNo,
                                                  left: rect.left,
                                                  top: rect.top - pageTop,
                                                  width: rect.width,
                                                  height: rect.height,
                                                  href: a.getAttribute("href"), });
            }
        }

        recurse(document.body);

        updateStructureReal(pageNumbers);
        return result;


        function recurse(node) {
            if (node.firstChild == null) {
                var offset = DOM.nodeOffset(node);
                var range = new Range.Range(node.parentNode,offset,node.parentNode,offset+1);
                var rects = Range.getClientRects(range);
                for (var i = 0; i < rects.length; i++) {
                    var rect = rects[i];

                    var pageNo = 1+Math.floor(rect.top/pageHeight);
                    var pageTop = (pageNo-1)*pageHeight;

                    if (result.leafRectsByPage[pageNo] == null)
                        result.leafRectsByPage[pageNo] = new Array();
                    result.leafRectsByPage[pageNo].push({ left: rect.left,
                                                          top: rect.top - pageTop,
                                                          width: rect.width,
                                                          height: rect.height });
                }
            }

            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }

    Outline.setReferenceTarget = function(node,itemId) {
        Selection.preserveWhileExecuting(function() {
            refRemoved(node);
            DOM.setAttribute(node,"href","#"+itemId);
            refInserted(node);
        });
    }

    Outline.detectSectionNumbering = function() {
        var sectionNumbering = detectNumbering(sections);
        if (sectionNumbering)
            makeNumberingExplicit(sections);
        makeNumberingExplicit(figures);
        makeNumberingExplicit(tables);
        return sectionNumbering;
    }

    function detectNumbering(category) {
        for (var item = category.list.first; item != null; item = item.next) {

            var firstText = null;
            var titleNode = OutlineItem_getTitleNode(item);

            if (titleNode != null)
                firstText = findFirstTextDescendant(titleNode);
            if (firstText != null) {
                var regex = category.numberRegex;
                var str = firstText.nodeValue;
                if (str.match(category.numberRegex))
                    return true;
            }
        }
    }

    function makeNumberingExplicit(category) {
        for (var item = category.list.first; item != null; item = item.next) {
            var firstText = null;
            var titleNode = OutlineItem_getTitleNode(item);

            if (titleNode != null)
                firstText = findFirstTextDescendant(titleNode);
            if (firstText != null) {
                var regex = category.numberRegex;
                var str = firstText.nodeValue;
                if (str.match(category.numberRegex)) {
                    var oldValue = str;
                    var newValue = str.replace(category.numberRegex,"");
                    DOM.setNodeValue(firstText,newValue);
                }
                else {
                    var titleNode = OutlineItem_getTitleNode(item,true);
                    if (titleNode != null)
                        DOM.setAttribute(titleNode,"class","Unnumbered");
                }
            }
        }
    }

    // Search through the document for any elements corresponding to built-in styles that are
    // normally latent (i.e. only included in the stylesheet if used)
    Outline.findUsedStyles = function() {
        var used = new Object();
        recurse(document.body);
        return used;

        function recurse(node) {
            switch (node._type) {
            case HTML_NAV: {
                var className = DOM.getAttribute(node,"class");
                if ((className == "tableofcontents") ||
                    (className == "listoffigures") ||
                    (className == "listoftables")) {
                    used["nav."+className] = true;
                }
                break;
            }
            case HTML_FIGCAPTION:
            case HTML_CAPTION:
            case HTML_H1:
            case HTML_H2:
            case HTML_H3:
            case HTML_H4:
            case HTML_H5:
            case HTML_H6: {
                var elementName = node.nodeName.toLowerCase();
                var className = DOM.getAttribute(node,"class");
                if ((className == null) || (className == ""))
                    used[elementName] = true;
                else if (className == "Unnumbered")
                    used[elementName+".Unnumbered"] = true;
                break;
            }
            }

            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }

})(globalAPI);
