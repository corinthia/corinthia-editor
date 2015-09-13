// Copyright (c) 2012-2013 UX Productivity Pty Ltd. All rights reserved.

// FIXME: The TOC/ItemList stuff won't work with Undo, because we're making DOM mutations in
// response to other DOM mutations, so at undo time the changes will be made twice

var Outline_init;
var Outline_removeListeners;
var Outline_moveSection;
var Outline_deleteItem;
var Outline_goToItem;
var Outline_setTitle;
var Outline_resetSectionNumbering;
var Outline_setNumbered;
var Outline_getItemElement;
var Outline_getOutline;
var Outline_plainText;
var Outline_insertTableOfContents;
var Outline_insertListOfFigures;
var Outline_insertListOfTables;
var Outline_setPrintMode;
var Outline_examinePrintLayout;
var Outline_setReferenceTarget;
var Outline_detectSectionNumbering;
var Outline_findUsedStyles;
var Outline_scheduleUpdateStructure;

(function() {

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

    function Category(type,nodeFilter,numberRegex)
    {
        this.type = type;
        this.nodeFilter = nodeFilter;
        this.numberRegex = numberRegex;
        this.list = new DoublyLinkedList();
        this.tocs = new NodeMap();
    }

    function addItemInternal(category,item,prevItem,title)
    {
        UndoManager_addAction(removeItemInternal,category,item);
        category.list.insertAfter(item,prevItem);
        item.title = title;
        category.tocs.forEach(function(node,toc) { TOC_addOutlineItem(toc,item.id); });
        Editor_addOutlineItem(item.id,category.type,title);
    }

    function removeItemInternal(category,item)
    {
        UndoManager_addAction(addItemInternal,category,item,item.prev,item.title);
        category.list.remove(item);
        category.tocs.forEach(function(node,toc) { TOC_removeOutlineItem(toc,item.id); });
        item.title = null;
        Editor_removeOutlineItem(item.id);
    }

    var Category_add = trace(function add(category,node)
    {
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

        function findPrevItemOfType(node,typeFun)
        {
            do node = prevNode(node);
            while ((node != null) && !typeFun(node));
            return (node == null) ? null : itemsByNode.get(node);
        }
    });

    var findFirstTextDescendant = trace(function _findFirstTextDescendant(node)
    {
        if (isWhitespaceTextNode(node))
            return;
        if (node.nodeType == Node.TEXT_NODE)
            return node;
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            var result = findFirstTextDescendant(child);
            if (result != null)
                return result;
        }
        return null;
    });

    var Category_remove = trace(function remove(category,node)
    {
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
            DOM_deleteNode(titleNode);
        }
        scheduleUpdateStructure();
    });

    var addTOCInternal = trace(function addTOCInternal(category,node,toc)
    {
        UndoManager_addAction(removeTOCInternal,category,node);
        category.tocs.put(node,toc);
    });

    var removeTOCInternal = trace(function removeTOCInternal(category,node)
    {
        var toc = category.tocs.get(node);
        if (toc == null)
            throw new Error("Attempt to remove ItemList that doesn't exist");

        UndoManager_addAction(addTOCInternal,category,node,toc);

        category.tocs.remove(node);
    });

    var Category_addTOC = trace(function addTOC(category,node)
    {
        var toc = new TOC(node);
        addTOCInternal(category,node,toc);

        for (var item = category.list.first; item != null; item = item.next) {
            TOC_addOutlineItem(toc,item.id);
            TOC_updateOutlineItem(toc,item.id,item.title);
        }

        scheduleUpdateStructure();
    });

    var Category_removeTOC = trace(function removeTOC(category,node)
    {
        removeTOCInternal(category,node);
    });

    function TOC(node)
    {
        this.node = node;
        this.textNodes = new Object();
    }

    var TOC_addOutlineItem = trace(function addOutlineItem(toc,id)
    {
        toc.textNodes[id] = DOM_createTextNode(document,"");
    });

    var TOC_removeOutlineItem = trace(function removeOutlineItem(toc,id)
    {
        delete toc.textNodes[id];
    });

    var TOC_updateOutlineItem = trace(function updateOutlineItem(toc,id,title)
    {
        DOM_setNodeValue(toc.textNodes[id],title);
    });

    var TOC_updateStructure = trace(function _TOC_updateStructure(toc,structure,toplevelShadows,
                                                                  pageNumbers)
    {
        Hierarchy_ensureValidHierarchy(toc.node);
        DOM_deleteAllChildren(toc.node);

        var cls = toc.node.getAttribute("class");

        if (toplevelShadows.length == 0) {
            createEmptyTOC(toc.node);
        }
        else {
            recurse(toplevelShadows,toc.node,1);
        }

        if (printMode) {
            var brk = DOM_createElement(document,"DIV");
            DOM_setStyleProperties(brk,{ "clear": "both" });
            DOM_appendChild(toc.node,brk);
        }

        function createEmptyTOC(parent)
        {
            if (!printMode) {
                var str = "";

                if (cls == Keys.SECTION_TOC)
                    str = "[No sections defined]";
                else if (cls == Keys.FIGURE_TOC)
                    str = "[No figures defined]";
                else if (cls == Keys.TABLE_TOC)
                    str = "[No tables defined]";

                var text = DOM_createTextNode(document,str);

                var div = DOM_createElement(document,"P");
                DOM_setAttribute(div,"class","toc1");
                DOM_appendChild(div,text);
                DOM_appendChild(parent,div);
            }
        }

        function recurse(shadows,parent,level)
        {
            if (level > 3)
                return;

            for (var i = 0; i < shadows.length; i++) {
                var shadow = shadows[i];
                var item = shadow.item;

                if (printMode) {
                    var div = DOM_createElement(document,"P");
                    DOM_setAttribute(div,"class","toc"+level+"-print");
                    DOM_appendChild(parent,div);

                    var leftSpan = DOM_createElement(document,"SPAN");
                    DOM_setAttribute(leftSpan,"class","toctitle");

                    var rightSpan = DOM_createElement(document,"SPAN");
                    DOM_setAttribute(rightSpan,"class","tocpageno");

                    DOM_appendChild(div,leftSpan);
                    DOM_appendChild(div,rightSpan);

                    if (item.computedNumber != null) {
                        var text = DOM_createTextNode(document,item.computedNumber+" ");
                        DOM_appendChild(leftSpan,text);
                    }

                    DOM_appendChild(leftSpan,toc.textNodes[item.id]);
                    var pageNo = pageNumbers ? pageNumbers.get(item.node) : null;
                    if (pageNo == null)
                        DOM_appendChild(rightSpan,DOM_createTextNode(document,"XXXX"));
                    else
                        DOM_appendChild(rightSpan,DOM_createTextNode(document,pageNo));
                }
                else {
                    var div = DOM_createElement(document,"P");
                    DOM_setAttribute(div,"class","toc"+level);
                    DOM_appendChild(parent,div);

                    var a = DOM_createElement(document,"A");
                    DOM_setAttribute(a,"href","#"+item.id);
                    DOM_appendChild(div,a);

                    if (item.computedNumber != null)
                        DOM_appendChild(a,DOM_createTextNode(document,item.computedNumber+" "));
                    DOM_appendChild(a,toc.textNodes[item.id]);
                }

                recurse(shadow.children,parent,level+1);
            }
        }
    });

    function OutlineItem(category,node)
    {
        var type = category.type;
        var item = this;
        if ((node != null) && (node.hasAttribute("id"))) {
            this.id = node.getAttribute("id");
        }
        else {
            this.id = generateItemId();
            if (node != null)
                DOM_setAttribute(node,"id",this.id);
        }
        this.category = category;
        this.type = type;
        this.node = node;
        this.title = null;
        this.computedNumber = null;

        this.spareSpan = DOM_createElement(document,"SPAN");
        DOM_appendChild(this.spareSpan,DOM_createTextNode(document,""));
        var spanClass = null;
        if (this.type == "section")
            spanClass = Keys.HEADING_NUMBER;
        else if (this.type == "figure")
            spanClass = Keys.FIGURE_NUMBER;
        else if (this.type == "table")
            spanClass = Keys.TABLE_NUMBER;
        DOM_setAttribute(this.spareSpan,"class",spanClass);

        // titleNode
        if (this.type == "figure") {
            this.spareTitle = DOM_createElement(document,"FIGCAPTION");
        }
        else if (this.type == "table") {
            this.spareTitle = DOM_createElement(document,"CAPTION");
        }

        this.prev = null;
        this.next = null;
        this.modificationListener = function(event) { itemModified(item); }

        itemsByNode.put(this.node,this);

        Object.seal(this);
        return;

        function generateItemId()
        {
            var id;
            do {
                id = "item"+(nextItemId++);
            } while (document.getElementById(id) != null);
            return id;
        }
    }

    var OutlineItem_getTitleNode = trace(function getTitleNode(item,create)
    {
        if (item.type == "section") {
            return item.node;
        }
        else if (item.type == "figure") {
            var titleNode = findChild(item.node,HTML_FIGCAPTION);
            if ((titleNode == null) && create) {
                titleNode = item.spareTitle;
                DOM_appendChild(item.node,titleNode);
            }
            return titleNode;
        }
        else if (item.type == "table") {
            var titleNode = findChild(item.node,HTML_CAPTION);
            if ((titleNode == null) && create) {
                titleNode = item.spareTitle;
                DOM_insertBefore(item.node,titleNode,item.node.firstChild);
            }
            return titleNode;
        }

        function findChild(node,type)
        {
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                if (child._type == type)
                    return child;
            }
            return null;
        }
    });

    var OutlineItem_updateItemTitle = trace(function updateItemTitle(item)
    {
        var titleNode = OutlineItem_getTitleNode(item,false);
        if (titleNode != null)
            newTitle = normalizeWhitespace(getNodeText(titleNode));
        else
            newTitle = "";

        if (item.title != newTitle) {
            UndoManager_addAction(Editor_updateOutlineItem,item.id,item.title);
            Editor_updateOutlineItem(item.id,newTitle);
            item.title = newTitle;
            item.category.tocs.forEach(function(node,toc) {
                TOC_updateOutlineItem(toc,item.id,item.title);
            });
        }
    });

    function getNodeTextAfter(node)
    {
        var text = "";
        for (var child = node.nextSibling; child != null; child = child.nextSibling)
            text += getNodeText(child);
        return text;
    }

    // private
    var itemModified = trace(function itemModified(item)
    {
        if (UndoManager_isActive())
            return;
        if (ignoreModifications > 0)
            return;
        OutlineItem_updateItemTitle(item);
        updateRefsForItem(item);
    });

    var addRefForId = trace(function addRefForId(id,node)
    {
        UndoManager_addAction(removeRefForId,id,node);
        if (refsById[id] == null)
            refsById[id] = new Array();
        refsById[id].push(node);
    });

    var removeRefForId = trace(function removeRefForId(id,node)
    {
        UndoManager_addAction(addRefForId,id,node);
        if (refsById[id] == null)
            throw new Error("refRemoved: refsById["+id+"] is null");
        var index = refsById[id].indexOf(node);
        if (index < 0)
            throw new Error("refRemoved: refsById["+id+"] does not contain node");
        refsById[id].splice(index,1);
        if (refsById[id] == null)
            delete refsById[id];
    });

    // private
    var refInserted = trace(function refInserted(node)
    {
        var href = node.getAttribute("href");
        if (href.charAt(0) != "#")
            throw new Error("refInserted: not a # reference");
        var id = href.substring(1);
        addRefForId(id,node);
        scheduleUpdateStructure();
    });

    // private
    var refRemoved = trace(function refRemoved(node)
    {
        var href = node.getAttribute("href");
        if (href.charAt(0) != "#")
            throw new Error("refInserted: not a # reference");
        var id = href.substring(1);
        removeRefForId(id,node);
    });

    // private
    var acceptNode = trace(function acceptNode(node)
    {
        for (var p = node; p != null; p = p.parentNode) {
            if ((p._type == HTML_SPAN) && (p.getAttribute("class") == Keys.HEADING_NUMBER))
                return false;
        }
        return true;
    });

    // private
    var docNodeInserted = trace(function docNodeInserted(event)
    {
        if (UndoManager_isActive())
            return;
        if (DOM_getIgnoreMutations())
            return;
        try {
            if (!acceptNode(event.target))
                return;
            recurse(event.target);
        }
        catch (e) {
            Editor_error(e);
        }

        function recurse(node)
        {
            switch (node._type) {
            case HTML_H1:
            case HTML_H2:
            case HTML_H3:
            case HTML_H4:
            case HTML_H5:
            case HTML_H6: {
                if (!isInTOC(node))
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
                if (isRefNode(node) && !isInTOC(node)) {
                    refInserted(node);
                }
                break;
            }
            case HTML_NAV: {
                var cls = node.getAttribute("class");
                if (cls == Keys.SECTION_TOC)
                    Category_addTOC(sections,node);
                else if (cls == Keys.FIGURE_TOC)
                    Category_addTOC(figures,node);
                else if (cls == Keys.TABLE_TOC)
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
    });

    // private
    var docNodeRemoved = trace(function docNodeRemoved(event)
    {
        if (UndoManager_isActive())
            return;
        if (DOM_getIgnoreMutations())
            return;
        try {
            if (!acceptNode(event.target))
                return;
            recurse(event.target);
        }
        catch (e) {
            Editor_error(e);
        }

        function recurse(node)
        {
            switch (node._type) {
            case HTML_H1:
            case HTML_H2:
            case HTML_H3:
            case HTML_H4:
            case HTML_H5:
            case HTML_H6:
                if (!isInTOC(node))
                    Category_remove(sections,node);
                break;
            case HTML_FIGURE:
                Category_remove(figures,node);
                break;
            case HTML_TABLE:
                Category_remove(tables,node);
                break;
            case HTML_A:
                if (isRefNode(node) && !isInTOC(node))
                    refRemoved(node);
                break;
            case HTML_NAV:
                var cls = node.getAttribute("class");
                if (cls == Keys.SECTION_TOC)
                    Category_removeTOC(sections,node);
                else if (cls == Keys.FIGURE_TOC)
                    Category_removeTOC(figures,node);
                else if (cls == Keys.TABLE_TOC)
                    Category_removeTOC(tables,node);
                break;
            }

            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    });

    // private
    var scheduleUpdateStructure = trace(function scheduleUpdateStructure()
    {
        if (UndoManager_isActive())
            return;
        if (!outlineDirty) {
            outlineDirty = true;
            PostponedActions_add(updateStructure);
        }
    });

    Outline_scheduleUpdateStructure = scheduleUpdateStructure;

    // private
    var updateStructure = trace(function updateStructure()
    {
        if (!outlineDirty)
            return;
        outlineDirty = false;
        if (UndoManager_isActive())
            throw new Error("Structure update event while undo or redo active");
        Selection_preserveWhileExecuting(function() {
            updateStructureReal();
        });
    });

    function Shadow(node)
    {
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

    var Shadow_last = trace(function last(shadow)
    {
        if (shadow.children.length == 0)
            return shadow;
        else
            return Shadow_last(shadow.children[shadow.children.length-1]);
    });

    var Shadow_outerNext = trace(function outerNext(shadow,structure)
    {
        var last = Shadow_last(shadow);
        if (last == null)
            return null;
        else if (last.item.next == null)
            return null;
        else
            return structure.shadowsByNode.get(last.item.next.node);
    });

    var firstTextDescendant = trace(function firstTextDescendant(node)
    {
        if (node.nodeType == Node.TEXT_NODE)
            return node;
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            var result = firstTextDescendant(child);
            if (result != null)
                return result;
        }
        return null;
    });

    function Structure()
    {
        this.toplevelSections = new Array();
        this.toplevelFigures = new Array();
        this.toplevelTables = new Array();
        this.shadowsByNode = new NodeMap();
    }

    var discoverStructure = trace(function _discoverStructure()
    {
        var structure = new Structure();
        var nextToplevelSectionNumber = 1;
        var nextFigureNumber = 1;
        var nextTableNumber = 1;
        var headingNumbering = Styles_headingNumbering();

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

            if (!headingNumbering || (DOM_getAttribute(item.node,"class") == "Unnumbered")) {
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
            if ((titleNode == null) || DOM_getAttribute(titleNode,"class") == "Unnumbered") {
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
            if ((titleNode == null) || DOM_getAttribute(titleNode,"class") == "Unnumbered") {
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
    });

    var updateStructureReal = trace(function updateStructureReal(pageNumbers)
    {
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

        Editor_outlineUpdated();
    });

    Outline_getOutline = trace(function getOutline()
    {
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

        function encodeShadow(shadow,result)
        {
            var encChildren = new Array();
            for (var i = 0; i < shadow.children.length; i++)
                encodeShadow(shadow.children[i],encChildren);

            var obj = { id: shadow.item.id,
                        number: shadow.item.computedNumber ? shadow.item.computedNumber : "",
                        children: encChildren };
            result.push(obj);
        }
    });

    var updateRefsForItem = trace(function _updateRefsForItem(item)
    {
        var id = item.node.getAttribute("id");
        var refs = refsById[id];
        if (refs == null)
            return;
        for (var i = 0; i < refs.length; i++) {
            DOM_deleteAllChildren(refs[i]);
            var text = null;

            var className = DOM_getAttribute(refs[i],"class");
            if (className == "uxwrite-ref-num") {
                text = item.computedNumber;
            }
            else if (className == "uxwrite-ref-text") {
                if (item.type == "section") {
                    if (item.numberSpan != null)
                        text = getNodeTextAfter(item.numberSpan);
                    else
                        text = normalizeWhitespace(getNodeText(item.node));
                }
                else if ((item.type == "figure") || (item.type == "table")) {
                    var titleNode = OutlineItem_getTitleNode(item,false);
                    if (titleNode != null) {
                        text = getNodeText(titleNode);

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
                        text = normalizeWhitespace(getNodeText(item.node));
                }
                else if ((item.type == "figure") || (item.type == "table")) {
                    var titleNode = OutlineItem_getTitleNode(item,false);
                    if (titleNode != null) {
                        if (item.numberSpan != null)
                            text = getNodeTextAfter(item.numberSpan);
                        else
                            text = normalizeWhitespace(getNodeText(titleNode));
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

            DOM_appendChild(refs[i],DOM_createTextNode(document,text));
        }
    });

    Outline_plainText = trace(function plainText()
    {
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
            var title = titleNode ? getNodeText(titleNode) : "[no caption]";
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
            var title = titleNode ? getNodeText(titleNode) : "[no caption]";
            if (shadow.item.computedNumber != null) {
                if (title.length > 0)
                    title = shadow.item.computedNumber+" "+title;
                else
                    title = shadow.item.computedNumber;
            }
            strings.push("    "+title+" ("+table.id+")\n");
        }
        return strings.join("");

        function printSectionRecursive(shadow,indent)
        {
            var titleNode = OutlineItem_getTitleNode(shadow.item,false);
            var content = getNodeText(titleNode);
            if (shadow.item.computedNumber != null)
                content = shadow.item.computedNumber+" "+content;
            if (isWhitespaceString(content))
                content = "[empty]";
            strings.push(indent+content+" ("+shadow.item.id+")\n");
            for (var i = 0; i < shadow.children.length; i++)
                printSectionRecursive(shadow.children[i],indent+"    ");
        }
    });

    // public
    Outline_init = trace(function init()
    {
        Selection_preserveWhileExecuting(function() {

            function isTableNode(node)
            {
                return (node._type == HTML_TABLE);
            }

            function isFigureNode(node)
            {
                return (node._type == HTML_FIGURE);
            }

            function isNonTOCHeadingNode(node)
            {
                return (HEADING_ELEMENTS[node._type] && !isInTOC(node));
            }

            sections = new Category("section",isNonTOCHeadingNode,sectionNumberRegex);
            figures = new Category("figure",isFigureNode,figureNumberRegex);
            tables = new Category("table",isTableNode,tableNumberRegex);
            itemsByNode = new NodeMap();
            refsById = new Object();

            DOM_ensureUniqueIds(document.documentElement);
            document.addEventListener("DOMNodeInserted",docNodeInserted);
            document.addEventListener("DOMNodeRemoved",docNodeRemoved);

            docNodeInserted({target:document});
        });
        doneInit = true;
    });

    // public (for the undo tests, when they report results)
    Outline_removeListeners = trace(function removeListeners()
    {
        document.removeEventListener("DOMNodeInserted",docNodeInserted);
        document.removeEventListener("DOMNodeRemoved",docNodeRemoved);

        removeCategoryListeners(sections);
        removeCategoryListeners(figures);
        removeCategoryListeners(tables);

        function removeCategoryListeners(category)
        {
            for (var item = category.list.first; item != null; item = item.next)
                item.node.removeEventListener("DOMSubtreeModified",item.modificationListener);
        }
    });

    // private
    var getShadowNodes = trace(function getShadowNodes(structure,shadow,result)
    {
        var endShadow = Shadow_outerNext(shadow,structure);
        var endNode = endShadow ? endShadow.item.node : null;
        for (var n = shadow.item.node; (n != null) && (n != endNode); n = n.nextSibling)
            result.push(n);
    });

    // public
    Outline_moveSection = trace(function moveSection(sectionId,parentId,nextId)
    {
        UndoManager_newGroup("Move section");
        Selection_clear();

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
                DOM_appendChild(document.body,sectionNodes[i]);
        }
        else {
            for (var i = 0; i < sectionNodes.length; i++)
                DOM_insertBefore(next.item.node.parentNode,sectionNodes[i],next.item.node);
        }

        var pos = new Position(node,0,node,0);
        pos = Position_closestMatchForwards(pos,Position_okForInsertion);
        Selection_set(pos.node,pos.offset,pos.node,pos.offset);

        scheduleUpdateStructure();
        PostponedActions_add(UndoManager_newGroup);
    });

    // public
    Outline_deleteItem = trace(function deleteItem(itemId)
    {
        UndoManager_newGroup("Delete outline item");
        var structure = discoverStructure();
        Selection_preserveWhileExecuting(function() {
            var node = document.getElementById(itemId);
            var item = itemsByNode.get(node);
            var shadow = structure.shadowsByNode.get(item.node);
            if (item.type == "section") {
                var sectionNodes = new Array();
                getShadowNodes(structure,shadow,sectionNodes);
                for (var i = 0; i < sectionNodes.length; i++)
                    DOM_deleteNode(sectionNodes[i]);
            }
            else {
                DOM_deleteNode(item.node);
            }
        });

        scheduleUpdateStructure();
        PostponedActions_add(UndoManager_newGroup);
    });

    // public
    Outline_goToItem = trace(function goToItem(itemId)
    {
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
            var position = new Position(node,0);
            position = Position_closestMatchForwards(position,Position_okForMovement);
            Selection_set(position.node,position.offset,position.node,position.offset);

            var section = document.getElementById(itemId);
            var location = webkitConvertPointFromNodeToPage(section,new WebKitPoint(0,0));
            window.scrollTo(0,location.y);
        }
    });

    // public
    Outline_getItemElement = trace(function getItemElement(itemId)
    {
        return document.getElementById(itemId);
    });

    // public
    Outline_resetSectionNumbering = trace(function resetSectionNumbering()
    {
        // This function is called when the user turns of heading numbering in the settings menu.
        // We need to remove the "Unnumbered" class name from all heading elements, because those
        // classes will be deleted from the stylesheet.
        for (var section = sections.list.first; section != null; section = section.next)
            DOM_removeAttribute(section.node,"class");
        scheduleUpdateStructure();
    });

    // public
    Outline_setNumbered = trace(function setNumbered(itemId,numbered)
    {
        var node = document.getElementById(itemId);
        var item = itemsByNode.get(node);

        Selection_preserveWhileExecuting(function() {
            if (item.type == "section") {
                if (numbered)
                    DOM_removeAttribute(node,"class");
                else
                    DOM_setAttribute(node,"class","Unnumbered");
            }
            else if ((item.type == "figure") || (item.type == "table")) {
                if (numbered) {
                    var caption = OutlineItem_getTitleNode(item,true);
                    DOM_removeAttribute(caption,"class");
                }
                else {
                    var caption = OutlineItem_getTitleNode(item,false);
                    if (caption != null) {
                        if (nodeHasContent(caption))
                            DOM_setAttribute(caption,"class","Unnumbered");
                        else
                            DOM_deleteNode(caption);
                    }
                }
            }
        });

        scheduleUpdateStructure();
    });

    // public
    Outline_setTitle = trace(function setTitle(itemId,title)
    {
        var node = document.getElementById(itemId);
        var item = itemsByNode.get(node);
        Selection_preserveWhileExecuting(function() {
            var titleNode = OutlineItem_getTitleNode(item,true);
            var oldEmpty = (item.title == "");
            var newEmpty = (title == "");
            if (oldEmpty != newEmpty) {
                // Add or remove the : at the end of table and figure numbers
                scheduleUpdateStructure();
            }
            if (item.numberSpan != null) {
                while (item.numberSpan.nextSibling != null)
                    DOM_deleteNode(item.numberSpan.nextSibling);
            }
            else {
                DOM_deleteAllChildren(titleNode);
            }
            DOM_appendChild(titleNode,DOM_createTextNode(document,title));
            OutlineItem_updateItemTitle(item);
        });
    });

    // private
    // FIXME: prevent a TOC from being inserted inside a heading, figure, or table
    var insertTOC = trace(function insertTOC(key,initialText)
    {
        var div = DOM_createElement(document,"NAV");
        DOM_setAttribute(div,"class",key);
        Cursor_makeContainerInsertionPoint();
        Clipboard_pasteNodes([div]);
    });

    // public
    Outline_insertTableOfContents = trace(function insertTableOfContents()
    {
        insertTOC(Keys.SECTION_TOC);
    });

    // public
    Outline_insertListOfFigures = trace(function insertListOfFigures()
    {
        insertTOC(Keys.FIGURE_TOC);
    });

    // public
    Outline_insertListOfTables = trace(function insertListOfTables()
    {
        insertTOC(Keys.TABLE_TOC);
    });

    // public
    Outline_setPrintMode = trace(function setPrintMode(newPrintMode)
    {
        printMode = newPrintMode;
        scheduleUpdateStructure();
    });

    // public
    Outline_examinePrintLayout = trace(function examinePrintLayout(pageHeight)
    {
        var result = new Object();
        var structure = discoverStructure();
        var pageNumbers = new NodeMap();

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

            var offset = DOM_nodeOffset(a);
            var range = new Range(a.parentNode,offset,a.parentNode,offset+1);
            var rects = Range_getClientRects(range);
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


        function recurse(node)
        {
            if (node.firstChild == null) {
                var offset = DOM_nodeOffset(node);
                var range = new Range(node.parentNode,offset,node.parentNode,offset+1);
                var rects = Range_getClientRects(range);
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
    });

    Outline_setReferenceTarget = trace(function setReferenceTarget(node,itemId) {
        Selection_preserveWhileExecuting(function() {
            refRemoved(node);
            DOM_setAttribute(node,"href","#"+itemId);
            refInserted(node);
        });
    });

    Outline_detectSectionNumbering = trace(function detectSectionNumbering()
    {
        var sectionNumbering = detectNumbering(sections);
        if (sectionNumbering)
            makeNumberingExplicit(sections);
        makeNumberingExplicit(figures);
        makeNumberingExplicit(tables);
        return sectionNumbering;
    });

    var detectNumbering = trace(function _detectNumbering(category)
    {
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
    });

    var makeNumberingExplicit = trace(function _makeNumberingExplicit(category)
    {
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
                    DOM_setNodeValue(firstText,newValue);
                }
                else {
                    var titleNode = OutlineItem_getTitleNode(item,true);
                    if (titleNode != null)
                        DOM_setAttribute(titleNode,"class","Unnumbered");
                }
            }
        }
    });

    // Search through the document for any elements corresponding to built-in styles that are
    // normally latent (i.e. only included in the stylesheet if used)
    Outline_findUsedStyles = trace(function findUsedStyles()
    {
        var used = new Object();
        recurse(document.body);
        return used;

        function recurse(node)
        {
            switch (node._type) {
            case HTML_NAV: {
                var className = DOM_getAttribute(node,"class");
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
                var className = DOM_getAttribute(node,"class");
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
    });

})();
