// Copyright (c) 2012 UX Productivity Pty Ltd. All rights reserved.

// FIXME: The TOC/ItemList stuff won't work with Undo, because we're making DOM mutations in
// response to other DOM mutations, so at undo time the changes will be made twice

// Any DOM manipulations performed by this class in response to other DOM events (insertion or
// removal of a node) must be wrapped in a call to UndoManager_disableWhileExecuting(), to avoid
// duplicate numberSpans and the like from appearing in the document if an undo + redo occurs.

var Outline_init;
var Outline_removeListeners;
var Outline_moveSection;
var Outline_deleteItem;
var Outline_goToItem;
var Outline_setNumbered;
var Outline_getItemElement;
var Outline_plainText;
var Outline_insertSectionTOC;
var Outline_insertFigureTOC;
var Outline_insertTableTOC;
var Outline_preparePrintMargins;
var Outline_examinePrintLayout;

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

    function Category(type,nodeFilter,numberRegex)
    {
        this.type = type;
        this.nodeFilter = nodeFilter;
        this.numberRegex = numberRegex;
        this.list = new DoublyLinkedList();
        this.tocs = new NodeMap();
    }

    Category.prototype.add = trace(function add(node)
    {
        var item = new OutlineItem(this,node);
        var prevItem = findPrevItemOfType(node,this.nodeFilter);
        this.list.insertAfter(item,prevItem);
        Editor_addOutlineItem(item.id,this.type);
        this.tocs.forEach(function(node,toc) { toc.addOutlineItem(item.id); });

        // Register for notifications to changes to this item's node content. We may need to
        // update the title when such a modification occurs.
        node.addEventListener("DOMSubtreeModified",item.modificationListener);

        // Examine the content of the node to determine whether it contains text representing
        // a section, figure, or table number. This is done using the regular expressions at the
        // top of the file. If we find a match, we mark the item as being numbered.
        // The actual number given in the node content is irrelevant; we assign our own number
        // based on the position of the item in the overall structurel.
        var firstText = findFirstTextDescendant(node);
        if (firstText != null) {
            var regex = this.numberRegex;
            var str = firstText.nodeValue;
            if (str.match(this.numberRegex)) {
                var match = str.match(this.numberRegex);
                DOM_setNodeValue(firstText,str.replace(this.numberRegex,""));
                item.enableNumbering();
            }
        }

        // If we did not determine the item to be numbered based on inspecting its textual content
        // above, consider adjacent items of the same type to decide whether to automatically
        // number this item. If it is the only item of its type, or either of its neighbours are
        // numbered, then this item will also be numbered. If it has two unnumbered neighbours,
        // or only one neighbour (and that neighbour is not numbered), then it will not be numbered.
        if (doneInit && (item.numberSpan == null))
            item.setNumberedUsingAdjacent();

        item.updateItemTitle();
        scheduleUpdateStructure();
        return item;

        function findPrevItemOfType(node,typeFun)
        {
            do node = prevNode(node);
            while ((node != null) && !typeFun(node));
            return (node == null) ? null : itemsByNode.get(node);
        }

        function findFirstTextDescendant(node)
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
        }
    });

    Category.prototype.remove = trace(function remove(node)
    {
        var item = itemsByNode.get(node);
        if (item == null) {
            throw new Error("Attempt to remove non-existant "+DOM_upperName(node)+
                            " item "+node.getAttribute("id"));
        }
        this.list.remove(item);
        Editor_removeOutlineItem(item.id);
        this.tocs.forEach(function(node,toc) { toc.removeOutlineItem(item.id); });
        item.node.removeEventListener("DOMSubtreeModified",item.modificationListener);
        UndoManager_disableWhileExecuting(function() {
            if (item.numberSpan != null) {
                DOM_deleteNode(item.numberSpan);
            }
            var titleNode = item.getTitleNode(false);
            if ((titleNode != null) &&
                ((item.type == "figure") || (item.type == "table")) &&
                (titleNode.firstChild == null) &&
                (titleNode.lastChild == null)) {
                DOM_deleteNode(titleNode);
            }
        });
        scheduleUpdateStructure();
    });

    Category.prototype.addTOC = trace(function addTOC(node)
    {
        var toc = new TOC(node);
        this.tocs.put(node,toc);

        for (var item = this.list.first; item != null; item = item.next) {
            toc.addOutlineItem(item.id);
            toc.updateOutlineItem(item.id,item.title);
        }

        scheduleUpdateStructure();
    });

    Category.prototype.removeTOC = trace(function removeTOC(node)
    {
        if (this.tocs.get(node) == null)
            throw new Error("Attempt to remove ItemList that doesn't exist");
        this.tocs.remove(node);
    });

    function TOC(node)
    {
        this.node = node;
        this.textNodes = new Object();
    }

    TOC.prototype.addOutlineItem = trace(function addOutlineItem(id)
    {
        this.textNodes[id] = DOM_createTextNode(document,"");
    });

    TOC.prototype.removeOutlineItem = trace(function removeOutlineItem(id)
    {
        delete this.textNodes[id];
    });

    TOC.prototype.updateOutlineItem = trace(function updateOutlineItem(id,title)
    {
        DOM_setNodeValue(this.textNodes[id],title);
    });

    TOC.prototype.updateStructure = trace(function updateStructure(toplevelItems)
    {
        var toc = this;
        DOM_deleteAllChildren(this.node);

        Styles_addDefaultRuleCategory("section-toc");

        recurse(toplevelItems,this.node);

        function recurse(items,parent)
        {
            var ul = DOM_createElement(document,"UL");
            DOM_appendChild(parent,ul);
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var li = DOM_createElement(document,"LI");
                DOM_setAttribute(li,"class",Keys.SECTION_TOC);
                DOM_appendChild(ul,li);

                var leftSpan = DOM_createElement(document,"SPAN");
                DOM_setAttribute(leftSpan,"class","uxwrite-toc-title");

                var rightSpan = DOM_createElement(document,"SPAN");
                DOM_setAttribute(rightSpan,"class","uxwrite-toc-pageno");

                DOM_appendChild(li,leftSpan);
                DOM_appendChild(li,rightSpan);

                if (item.numberSpan != null)
                    DOM_appendChild(leftSpan,DOM_createTextNode(document,item.getFullNumber()+" "));
                DOM_appendChild(leftSpan,toc.textNodes[item.id]);
                if (item.pageNo == null)
                    DOM_appendChild(rightSpan,DOM_createTextNode(document,"XXXX"));
                else
                    DOM_appendChild(rightSpan,DOM_createTextNode(document,item.pageNo));

                recurse(item.children,li);
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
        this.level = node ? parseInt(DOM_upperName(node).substring(1)) : 0;
        this.index = null;
        this.parent = null;
        this.children = new Array();
        this.isRoot = (this.level == 0);
        this.numberSpan = null;
        this.referenceText = null;
        this.nextChildSectionNumber = null;
        this.pageNo = null;

        this.prev = null;
        this.next = null;
        this.references = new NodeSet();
        this.modificationListener = function(event) { itemModified(item); }

        itemsByNode.put(this.node,this);

        this.spanClass = null;
        if (type == "section")
            this.spanClass = Keys.HEADING_NUMBER;
        else if (type == "figure")
            this.spanClass = Keys.FIGURE_NUMBER;
        else if (type == "table")
            this.spanClass = Keys.TABLE_NUMBER;

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

    OutlineItem.prototype.enableNumbering = trace(function enableNumbering()
    {
        if (this.numberSpan != null)
            return;
        var titleNode = this.getTitleNode(true);

        var item = this;
        UndoManager_disableWhileExecuting(function() {
            item.numberSpan = DOM_createElement(document,"SPAN");
            DOM_setAttribute(item.numberSpan,"class",item.spanClass);
            DOM_insertBefore(titleNode,item.numberSpan,titleNode.firstChild);
            DOM_appendChild(item.numberSpan,DOM_createTextNode(document,""));
        });
        scheduleUpdateStructure();
    });

    OutlineItem.prototype.disableNumbering = trace(function disableNumbering()
    {
        var item = this;

        if (item.numberSpan == null)
            return;

        UndoManager_disableWhileExecuting(function() {
            DOM_deleteNode(item.numberSpan);
            item.numberSpan = null;

            var titleNode = item.getTitleNode(false);
            if ((titleNode != null) && !nodeHasContent(titleNode)) {
                DOM_deleteNode(titleNode);
            }
        });

        scheduleUpdateStructure();
    });

    OutlineItem.prototype.getTitleNode = trace(function getTitleNode(create)
    {
        var item = this;
        if (item.type == "section") {
            return item.node;
        }
        else if (item.type == "figure") {
            var titleNode = findChild(item.node,"FIGCAPTION");
            if ((titleNode == null) && create) {
                titleNode = DOM_createElement(document,"FIGCAPTION");
                DOM_appendChild(item.node,titleNode);
            }
            return titleNode;
        }
        else if (item.type == "table") {
            var titleNode = findChild(item.node,"CAPTION");
            if ((titleNode == null) && create) {
                UndoManager_disableWhileExecuting(function() {
                    titleNode = DOM_createElement(document,"CAPTION");
                    DOM_insertBefore(item.node,titleNode,item.node.firstChild);
                });
            }
            return titleNode;
        }

        function findChild(node,name)
        {
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                if (DOM_upperName(child) == name)
                    return child;
            }
            return null;
        }
    });

    OutlineItem.prototype.setNumberedUsingAdjacent = trace(function setNumberedUsingAdjacent()
    {
        // Enable numbering for the specified outline numbered if there are either no other
        // items of its type, or either the preceding or following item of that type has
        // numbering enabled
        if ((this.prev == null) && (this.next == null)) {
            this.enableNumbering();
        }
        else {
            if (((this.prev != null) && (this.prev.numberSpan != null)) ||
                ((this.next != null) && (this.next.numberSpan != null))) {
                this.enableNumbering();
            }
            else {
                this.disableNumbering();
            }
        }
    });

    OutlineItem.prototype.last = trace(function last()
    {
        if (this.children.length == 0)
            return this;
        else
            return this.children[this.children.length-1].last();
    });

    OutlineItem.prototype.outerNext = trace(function outerNext()
    {
        var last = this.last();
        if (last == null)
            return null;
        else if (last.next == null)
            return null;
        else
            return last.next;
    });

    OutlineItem.prototype.toString = trace(function toString()
    {
        if (this.isRoot)
            return "(root)";

        var str = "["+this.id+"] "+this.getFullNumber()+" "+this.node;
        if (this.node != null)
            str += " "+JSON.stringify(getNodeText(this.node));
        str += " (level "+this.level+")";
        return str;
    });

    OutlineItem.prototype.print = trace(function print(indent)
    {
        if (indent == null)
            indent = "";
        debug(indent+this);
        for (var i = 0; i < this.children.length; i++)
            this.children[i].print(indent+"    ");
    });

    OutlineItem.prototype.getFullNumber = trace(function getFullNumber()
    {
        if (this.numberSpan == null)
            return "";
        var item = this;
        var fullNumber = ""+item.index;
        while (item.parent != null) {
            item = item.parent;
            fullNumber = item.index+"."+fullNumber;
        }
        return fullNumber;
    });

    OutlineItem.prototype.setReferenceText = trace(function setReferenceText(referenceText)
    {
        if (this.referenceText == referenceText)
            return; // don't waste time updating refs

        this.referenceText = referenceText;

        var refs = refsById[this.id];
        if (refs != null) {
            for (var i = 0; i < refs.length; i++) {
                DOM_deleteAllChildren(refs[i]);
                DOM_appendChild(refs[i],DOM_createTextNode(document,referenceText));
            }
        }
    });

    OutlineItem.prototype.updateItemNumbering = trace(function updateItemNumbering()
    {
        var item = this;
        if (item.title == null)
            throw new Error("updateItemNumbering: item "+item.id+" has null title");
        if (item.numberSpan != null) {
            var spanText = "";
            if (item.type == "section") {
                spanText = item.getFullNumber()+" ";
            }
            else if (item.type == "figure") {
                spanText = "Figure "+item.getFullNumber();
                if (item.title != "")
                    spanText += ": ";
            }
            else if (item.type == "table") {
                spanText = "Table "+item.getFullNumber();
                if (item.title != "")
                    spanText += ": ";
            }
            DOM_setNodeValue(item.numberSpan.firstChild,spanText);
        }
    });

    OutlineItem.prototype.updateItemTitle = trace(function updateItemTitle()
    {
        var titleNode = this.getTitleNode(false);
        if (this.numberSpan != null)
            newTitle = normalizeWhitespace(getNodeTextAfter(this.numberSpan));
        else if (titleNode != null)
            newTitle = normalizeWhitespace(getNodeText(titleNode));
        else
            newTitle = "";

        if (this.title != newTitle) {
            this.title = newTitle;
            Editor_updateOutlineItem(this.id,this.title);
            var item = this;
            this.category.tocs.forEach(function(node,toc) {
                toc.updateOutlineItem(item.id,item.title);
            });
        }

        function getNodeTextAfter(node)
        {
            var text = "";
            for (var child = node.nextSibling; child != null; child = child.nextSibling)
                text += getNodeText(child);
            return text;
        }
    });

    // private
    var itemModified = trace(function itemModified(item)
    {
        if (ignoreModifications > 0)
            return;
        item.updateItemTitle();
    });

    // private
    var refInserted = trace(function refInserted(node)
    {
        var href = node.getAttribute("href");
        if (href.charAt(0) != "#")
            throw new Error("refInserted: not a # reference");
        var id = href.substring(1);

        if (refsById[id] == null)
            refsById[id] = new Array();
        refsById[id].push(node);

        var item = itemsByNode.get(node);
        if ((item != null) && (item.referenceText != null)) {
            DOM_deleteAllChildren(node);
            DOM_appendChild(node,DOM_createTextNode(document,item.referenceText));
        }
    });

    // private
    var refRemoved = trace(function refRemoved(node)
    {
        var href = node.getAttribute("href");
        if (href.charAt(0) != "#")
            throw new Error("refInserted: not a # reference");
        var id = href.substring(1);

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
    var acceptNode = trace(function acceptNode(node)
    {
        for (var p = node; p != null; p = p.parentNode) {
            if ((p.nodeType == Node.ELEMENT_NODE) &&
                (DOM_upperName(p) == "SPAN") &&
                (p.getAttribute("class") == Keys.HEADING_NUMBER))
                return false;
        }
        return true;
    });

    // private
    var docNodeInserted = trace(function docNodeInserted(event)
    {
        if (!acceptNode(event.target))
            return;
        recurse(event.target);

        function recurse(node)
        {
            if (isHeadingNode(node))
                sections.add(node);
            else if (isFigureNode(node))
                figures.add(node);
            else if (isTableNode(node))
                tables.add(node);
            else if (isRefNode(node))
                refInserted(node);

            if (DOM_upperName(node) == "DIV") {
                var cls = node.getAttribute("class");
                if (cls == Keys.SECTION_TOC)
                    sections.addTOC(node);
                else if (cls == Keys.FIGURE_TOC)
                    figures.addTOC(node);
                else if (cls == Keys.TABLE_TOC)
                    tables.addTOC(node);
            }

            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    });

    // private
    var docNodeRemoved = trace(function docNodeRemoved(event)
    {
        if (!acceptNode(event.target))
            return;
        recurse(event.target);

        function recurse(node)
        {
            if (isHeadingNode(node))
                sections.remove(node);
            else if (isFigureNode(node))
                figures.remove(node);
            else if (isTableNode(node))
                tables.remove(node);
            else if (isRefNode(node))
                refRemoved(node);

            if (DOM_upperName(node) == "DIV") {
                var cls = node.getAttribute("class");
                if (cls == Keys.SECTION_TOC)
                    sections.removeTOC(node);
                else if (cls == Keys.FIGURE_TOC)
                    figures.removeTOC(node);
                else if (cls == Keys.TABLE_TOC)
                    tables.removeTOC(node);
            }

            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    });

    // private
    var scheduleUpdateStructure = trace(function scheduleUpdateStructure()
    {
        if (!outlineDirty) {
            outlineDirty = true;
            PostponedActions_add(updateStructure);
        }
    });

    // private
    var updateStructure = trace(function updateStructure()
    {
        if (!outlineDirty)
            return;
        outlineDirty = false;
        UndoManager_disableWhileExecuting(updateStructureReal);
    });

    var updateStructureReal = trace(function updateStructureReal()
    {
        var toplevelSections = new Array();
        var toplevelFigures = new Array();
        var toplevelTables = new Array();
        var nextToplevelSectionNumber = 1;
        var nextFigureNumber = 1;
        var nextTableNumber = 1;
        var wrapper = new Object();

        var current = null;
        wrapper.parent = null;
        wrapper.children = [];

        for (var section = sections.list.first; section != null; section = section.next) {
            section.parent = null;
            section.children = [];
            section.nextChildSectionNumber = 1;
        }

        ignoreModifications++;

        for (var section = sections.list.first; section != null; section = section.next) {
           
            while ((current != null) && (section.level < current.level+1))
                current = current.parent;

            section.parent = current;
            if (current == null) {
                if (section.numberSpan != null)
                    section.index = nextToplevelSectionNumber++;
                else
                    section.index = 0;
                toplevelSections.push(section);
            }
            else {
                if (section.numberSpan != null)
                    section.index = current.nextChildSectionNumber++;
                else
                    section.index = 0;
                current.children.push(section);
            }

            current = section;
            section.updateItemNumbering();
            section.setReferenceText("Section "+section.getFullNumber());
        }

        for (var figure = figures.list.first; figure != null; figure = figure.next) {
            if (figure.numberSpan != null)
                figure.index = nextFigureNumber++;
            else
                figure.index = 0;
            toplevelFigures.push(figure);
            figure.updateItemNumbering();
            figure.setReferenceText("Figure "+figure.getFullNumber());
        }

        for (var table = tables.list.first; table != null; table = table.next) {
            if (table.numberSpan != null)
                table.index = nextTableNumber++;
            else
                table.index = 0;
            toplevelTables.push(table);
            table.updateItemNumbering();
            table.setReferenceText("Table "+table.getFullNumber());
        }

        ignoreModifications--;

        sections.tocs.forEach(function (node,toc) { toc.updateStructure(toplevelSections); });
        figures.tocs.forEach(function (node,toc) { toc.updateStructure(toplevelFigures); });
        tables.tocs.forEach(function (node,toc) { toc.updateStructure(toplevelTables); });

        var encSections = new Array();
        var encFigures = new Array();
        var encTables = new Array();

        for (var i = 0; i < toplevelSections.length; i++)
            encodeItem(toplevelSections[i],encSections);
        for (var i = 0; i < toplevelFigures.length; i++)
            encodeItem(toplevelFigures[i],encFigures);
        for (var i = 0; i < toplevelTables.length; i++)
            encodeItem(toplevelTables[i],encTables);

        var arg = { sections: encSections,
                    figures: encFigures,
                    tables: encTables };
        Editor_setOutline(arg);
        return;


        function encodeItem(item,result)
        {
            var encChildren = new Array();
            for (var i = 0; i < item.children.length; i++)
                encodeItem(item.children[i],encChildren);

            var obj = { id: item.id,
                        number: item.getFullNumber(),
                        children: encChildren };
            result.push(obj);
        }
    });

    Outline_plainText = trace(function plainText()
    {
        var strings = new Array();

        strings.push("Sections:\n");
        for (var section = sections.list.first; section != null; section = section.next) {
            if (section.level == 1)
                printSectionRecursive(section,"    ");
        }
        strings.push("Figures:\n");
        for (var figure = figures.list.first; figure != null; figure = figure.next) {
            var titleNode = figure.getTitleNode(false);
            var title = titleNode ? getNodeText(titleNode) : "[no caption]";
            strings.push("    "+title+" ("+figure.id+")\n");
        }
        strings.push("Tables:\n");
        for (var table = tables.list.first; table != null; table = table.next) {
            var titleNode = table.getTitleNode(false);
            var title = titleNode ? getNodeText(titleNode) : "[no caption]";
            strings.push("    "+title+" ("+table.id+")\n");
        }
        return strings.join("");

        function printSectionRecursive(section,indent)
        {
            var titleNode = section.getTitleNode(false);
            var content = getNodeText(titleNode);
            if (isWhitespaceString(content))
                content = "[empty]";
            strings.push(indent+content+" ("+section.id+")\n");
            for (var i = 0; i < section.children.length; i++)
                printSectionRecursive(section.children[i],indent+"    ");
        }
    });

    // public
    Outline_init = trace(function init()
    {
        sections = new Category("section",isHeadingNode,sectionNumberRegex);
        figures = new Category("figure",isFigureNode,figureNumberRegex);
        tables = new Category("table",isTableNode,tableNumberRegex);
        itemsByNode = new NodeMap();
        refsById = new Object();

        DOM_ensureUniqueIds(document.documentElement);
        document.addEventListener("DOMNodeInserted",docNodeInserted);
        document.addEventListener("DOMNodeRemoved",docNodeRemoved);

        docNodeInserted({target:document});
        doneInit = true;
    });

    // public (for the undo tests, when they report results)
    Outline_removeListeners = trace(function removeListeners()
    {
        document.removeEventListener("DOMNodeInserted",docNodeInserted);
        document.removeEventListener("DOMNodeRemoved",docNodeRemoved);
    });

    // private
    var getOutlineItemNodes = trace(function getOutlineItemNodes(section,result)
    {
        var endOutlineItem = section.outerNext();
        var endNode = endOutlineItem ? endOutlineItem.node : null;
        for (var n = section.node; (n != null) && (n != endNode); n = n.nextSibling)
            result.push(n);
    });

    // public
    Outline_moveSection = trace(function moveSection(sectionId,parentId,nextId)
    {
        Selection_preserveWhileExecuting(function() {
            updateStructure(); // make sure pointers are valid

            var node = document.getElementById(sectionId);
            var section = itemsByNode.get(node);

            // FIXME: We should throw an exception if a parentId or nextId which does not exist
            // in the document is specified. However there are currently some tests (like
            // moveSection-nested*) which rely us interpreting such parameters as null.
            var parentNode = parentId ? document.getElementById(parentId) : null;
            var nextNode = nextId ? document.getElementById(nextId) : null;
            var parent = parentNode ? itemsByNode.get(parentNode) : null;
            var next = nextNode ? itemsByNode.get(nextNode) : null;

            var sectionNodes = new Array();
            getOutlineItemNodes(section,sectionNodes);

            if ((next == null) && (parent != null))
                next = parent.outerNext();

            if (next == null) {
                for (var i = 0; i < sectionNodes.length; i++)
                    DOM_appendChild(document.body,sectionNodes[i]);
            }
            else {
                for (var i = 0; i < sectionNodes.length; i++)
                    DOM_insertBefore(next.node.parentNode,sectionNodes[i],next.node);
            }
        });

        scheduleUpdateStructure();
    });

    // public
    Outline_deleteItem = trace(function deleteItem(itemId)
    {
        Selection_preserveWhileExecuting(function() {
            var node = document.getElementById(itemId);
            var item = itemsByNode.get(node);
            if (item.type == "section") {
                var sectionNodes = new Array();
                getOutlineItemNodes(item,sectionNodes);
                for (var i = 0; i < sectionNodes.length; i++)
                    DOM_deleteNode(sectionNodes[i]);
            }
            else {
                DOM_deleteNode(item.node);
            }
        });

        scheduleUpdateStructure();
    });

    // public
    Outline_goToItem = trace(function goToItem(itemId)
    {
        if (itemId == null) {
            window.scrollTo(0);
        }
        else {
            var section = document.getElementById(itemId);
            var location = webkitConvertPointFromNodeToPage(section,
                                                            new WebKitPoint(0,0));
            window.scrollTo(0,location.y);
        }
    });

    // public
    Outline_getItemElement = trace(function getItemElement(itemId)
    {
        return document.getElementById(itemId);
    });

    // public
    Outline_setNumbered = trace(function setNumbered(itemId,numbered)
    {
        var node = document.getElementById(itemId);
        var item = itemsByNode.get(node);

        var oldNumbered = (item.numberSpan != null);
        UndoManager_addAction(Outline_setNumbered,itemId,oldNumbered);

        if (numbered)
            item.enableNumbering();
        else
            item.disableNumbering();
    });

    // private
    var insertTOC = trace(function insertTOC(key,initialText)
    {
        var div = DOM_createElement(document,"DIV");
        DOM_setAttribute(div,"class",key);
        Clipboard_pasteNodes([div]);
        DOM_setAttribute(div,"style","border: 1px solid red");
    });

    // public
    Outline_insertSectionTOC = trace(function insertSectionTOC()
    {
        insertTOC(Keys.SECTION_TOC);
    });

    // public
    Outline_insertFigureTOC = trace(function insertFigureTOC()
    {
        insertTOC(Keys.FIGURE_TOC);
    });

    // public
    Outline_insertTableTOC = trace(function insertTableTOC()
    {
        insertTOC(Keys.TABLE_TOC);
    });

    // public
    Outline_preparePrintMargins = trace(function preparePrintMargins()
    {
        var computed = window.getComputedStyle(document.body);
        var obj = { "margin-left": computed.marginLeft,
                    "margin-right": computed.marginRight,
                    "margin-top": computed.marginTop,
                    "margin-bottom": computed.marginBottom };

        var bodyStyle = Styles_getAllStyles()["body"];
        if (bodyStyle == null)
            throw new Error("no body style");
        bodyStyle.rules.base.properties["margin-left"] = "0";
        bodyStyle.rules.base.properties["margin-right"] = "0";
        bodyStyle.rules.base.properties["margin-top"] = "0";
        bodyStyle.rules.base.properties["margin-bottom"] = "0";
        Styles_setStyle(bodyStyle);

        return obj;
    });

    // public
    Outline_examinePrintLayout = trace(function examinePrintLayout(pageHeight)
    {
        var result = new Object();

        result.destsByPage = new Object();
        result.linksByPage = new Object();
        result.leafRectsByPage = new Object();
        debug("examinePrintLayout 1");

        itemsByNode.forEach(function(node,item) {
//            debug("examinePrintLayout 1.1: item "+item.id);
            var rect = item.node.getBoundingClientRect();
//            debug("examinePrintLayout 1.2: rect "+rect);
            var pageNo = 1+Math.floor(rect.top/pageHeight);
//            debug("examinePrintLayout 1.3: pageNo "+pageNo);
            var pageTop = (pageNo-1)*pageHeight;
//            debug("examinePrintLayout 1.4: pageTop "+pageTop);
            debug("item "+item.id+" ("+JSON.stringify(item.title)+") is on page "+pageNo);
            item.pageNo = pageNo;

            if (result.destsByPage[pageNo] == null)
                result.destsByPage[pageNo] = new Array();
            result.destsByPage[pageNo].push({ itemId: id,
                                              x: rect.left,
                                              y: rect.top - pageTop});
        });

        debug("examinePrintLayout 2");
        var links = document.getElementsByTagName("A");
        for (var i = 0; i < links.length; i++) {
            var a = links[i];

            if (!a.hasAttribute("href"))
                continue;

            var offset = DOM_nodeOffset(a);
            var range = new Range(a.parentNode,offset,a.parentNode,offset+1);
            var rects = range.getClientRects();
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

        debug("examinePrintLayout 3");
        scheduleUpdateStructure();
        return result;


        function recurse(node)
        {
            if (node.firstChild == null) {
                var offset = DOM_nodeOffset(node);
                var range = new Range(node.parentNode,offset,node.parentNode,offset+1);
                var rects = range.getClientRects();
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

})();
