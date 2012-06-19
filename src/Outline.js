// Copyright (c) 2012 UX Productivity Pty Ltd. All rights reserved.

// FIXME: The TOC/ItemList stuff won't work with Undo, because we're making DOM mutations in
// response to other DOM mutations, so at undo time the changes will be made twice

var Outline_init;
var Outline_removeListeners;
var Outline_moveSection;
var Outline_deleteItem;
var Outline_goToItem;
var Outline_setTitle;
var Outline_setNumbered;
var Outline_getItemElement;
var Outline_plainText;
var Outline_insertTableOfContents;
var Outline_insertListOfFigures;
var Outline_insertListOfTables;
var Outline_setPrintMode;
var Outline_preparePrintMargins;
var Outline_examinePrintLayout;
var Outline_setReferenceTarget;

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

    Category.prototype.add = trace(function add(node)
    {
        var item = itemsByNode.get(node);
        if (item == null)
            item = new OutlineItem(this,node);

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
        var firstText = null;
        var titleNode = item.getTitleNode();
        if (titleNode != null)
            firstText = findFirstTextDescendant(titleNode);
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
        item.title = null;
        item.node.removeEventListener("DOMSubtreeModified",item.modificationListener);
        if (item.numberSpan != null) {
            DOM_deleteNode(item.numberSpan);
            item.numberSpan = null;
        }
        var titleNode = item.getTitleNode(false);
        if ((titleNode != null) &&
            ((item.type == "figure") || (item.type == "table")) &&
            (titleNode.firstChild == null) &&
            (titleNode.lastChild == null)) {
            DOM_deleteNode(titleNode);
        }
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

    TOC.prototype.updateStructure = trace(function updateStructure(structure,toplevelShadows,
                                                                   pageNumbers)
    {
        var toc = this;
        DOM_deleteAllChildren(this.node);

        var headingText;
        var cls = this.node.getAttribute("class");
        if (cls == Keys.SECTION_TOC)
            headingText = "Contents";
        else if (cls == Keys.FIGURE_TOC)
            headingText = "List of Figures";
        else if (cls == Keys.TABLE_TOC)
            headingText = "List of Tables";

        var heading = DOM_createElement(document,"H1");
        DOM_appendChild(heading,DOM_createTextNode(document,headingText));
        DOM_appendChild(this.node,heading);

        if (printMode)
            Styles_addDefaultRuleCategory("toc-print");
        else
            Styles_addDefaultRuleCategory("toc");

        if (toplevelShadows.length == 0) {
            createEmptyTOC(this.node);
        }
        else {
            recurse(toplevelShadows,this.node,1);
        }

        if (printMode) {
            var brk = DOM_createElement(document,"DIV");
            DOM_setStyleProperties(brk,{ "clear": "both" });
            DOM_appendChild(this.node,brk);
        }

        function createEmptyTOC(parent)
        {
            if (!printMode) {
                var str;

                if (cls == Keys.SECTION_TOC)
                    str = "[No sections defined]";
                else if (cls == Keys.FIGURE_TOC)
                    str = "[No figures defined]";
                else if (cls == Keys.TABLE_TOC)
                    str = "[No tables defined]";

                var text = DOM_createTextNode(document,str);

                var div = DOM_createElement(document,"DIV");
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
                    var div = DOM_createElement(document,"DIV");
                    DOM_setAttribute(div,"class","toc"+level+"-print");
                    DOM_appendChild(parent,div);

                    var leftSpan = DOM_createElement(document,"SPAN");
                    DOM_setAttribute(leftSpan,"class","toctitle");

                    var rightSpan = DOM_createElement(document,"SPAN");
                    DOM_setAttribute(rightSpan,"class","tocpageno");

                    DOM_appendChild(div,leftSpan);
                    DOM_appendChild(div,rightSpan);

                    // FIXME: item -> shadow
                    if (item.numberSpan != null)
                        DOM_appendChild(leftSpan,DOM_createTextNode(document,
                                                                    shadow.getFullNumber()+" "));
                    DOM_appendChild(leftSpan,toc.textNodes[item.id]);
                    var pageNo = pageNumbers ? pageNumbers.get(item.node) : null;
                    if (pageNo == null)
                        DOM_appendChild(rightSpan,DOM_createTextNode(document,"XXXX"));
                    else
                        DOM_appendChild(rightSpan,DOM_createTextNode(document,pageNo));
                }
                else {
                    var div = DOM_createElement(document,"DIV");
                    DOM_setAttribute(div,"class","toc"+level);
                    DOM_appendChild(parent,div);

                    var a = DOM_createElement(document,"A");
                    DOM_setAttribute(a,"href","#"+item.id);
                    DOM_appendChild(div,a);

                    if (item.numberSpan != null) {
                        var numText = shadow.getFullNumber()+" ";
                        DOM_appendChild(a,DOM_createTextNode(document,numText));
                    }
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

        // numberSpan
        this.numberSpan = null;
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

    OutlineItem.prototype.info = trace(function info()
    {
        if (this.numberSpan == null)
            return nodeString(this.node)+" (numberSpan null)";
        else
            return nodeString(this.node)+" (numberSpan "+nodeString(this.numberSpan)+
            ", parent "+nodeString(this.numberSpan.parentNode)+")";
    });

    OutlineItem.prototype.enableNumbering = trace(function enableNumbering()
    {
        if (this.numberSpan != null)
            return;
        var titleNode = this.getTitleNode(true);

        var item = this;
        item.numberSpan = item.spareSpan;
        DOM_insertBefore(titleNode,item.numberSpan,titleNode.firstChild);
        scheduleUpdateStructure();
    });

    OutlineItem.prototype.disableNumbering = trace(function disableNumbering()
    {
        var item = this;

        if (item.numberSpan == null)
            return;

        // Set item.numberSpan to null before the deleting node, so that updateItemTitle gets the
        // correct text for the title
        var numberSpan = item.numberSpan;
        item.numberSpan = null;
        DOM_deleteNode(numberSpan);

        var titleNode = item.getTitleNode(false);
        if ((titleNode != null) && !nodeHasContent(titleNode))
            DOM_deleteNode(titleNode);

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
                titleNode = item.spareTitle;
                DOM_appendChild(item.node,titleNode);
            }
            return titleNode;
        }
        else if (item.type == "table") {
            var titleNode = findChild(item.node,"CAPTION");
            if ((titleNode == null) && create) {
                titleNode = item.spareTitle;
                DOM_insertBefore(item.node,titleNode,item.node.firstChild);
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
        var numbered = (item.numberSpan != null);
        if (!numbered)
            setReferenceText(item.node,item.title);
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

        scheduleUpdateStructure();
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
            if (!doneInit && isHeadingNode(node) && isWhitespaceString(getNodeText(node))) {
                DOM_ignoreMutationsWhileExecuting(function() {
                    DOM_deleteNode(node);
                });
                return;
            }

            if (isHeadingNode(node) && !isInTOC(node))
                sections.add(node);
            else if (isFigureNode(node))
                figures.add(node);
            else if (isTableNode(node))
                tables.add(node);
            else if (isRefNode(node) && !isInTOC(node))
                refInserted(node);

            if (DOM_upperName(node) == "NAV") {
                var cls = node.getAttribute("class");
                if (cls == Keys.SECTION_TOC)
                    sections.addTOC(node);
                else if (cls == Keys.FIGURE_TOC)
                    figures.addTOC(node);
                else if (cls == Keys.TABLE_TOC)
                    tables.addTOC(node);
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
            if (isHeadingNode(node) && !isInTOC(node))
                sections.remove(node);
            else if (isFigureNode(node))
                figures.remove(node);
            else if (isTableNode(node))
                tables.remove(node);
            else if (isRefNode(node) && !isInTOC(node))
                refRemoved(node);

            if (DOM_upperName(node) == "NAV") {
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
        Selection_preserveWhileExecuting(function() {
            updateStructureReal();
        });
    });

    function Shadow(node)
    {
        this.node = node;
        this.item = itemsByNode.get(node);
        this.level = parseInt(DOM_upperName(node).substring(1));
        this.children = [];
        this.parent = null;
    }

    Shadow.prototype.last = trace(function last()
    {
        if (this.children.length == 0)
            return this;
        else
            return this.children[this.children.length-1].last();
    });

    Shadow.prototype.outerNext = trace(function outerNext(structure)
    {
        var last = this.last();
        if (last == null)
            return null;
        else if (last.item.next == null)
            return null;
        else
            return structure.shadowsByNode.get(last.item.next.node);
    });

    Shadow.prototype.getFullNumber = trace(function getFullNumber()
    {
        if (this.item.numberSpan == null)
            return "";
        var shadow = this;
        var fullNumber = ""+shadow.index;
        while (shadow.parent != null) {
            shadow = shadow.parent;
            fullNumber = shadow.index+"."+fullNumber;
        }
        return fullNumber;
    });

    Shadow.prototype.updateItemNumbering = trace(function updateItemNumbering()
    {
        var shadow = this;
        var item = this.item;
        if (item.title == null)
            throw new Error("updateItemNumbering: item "+item.id+" has null title");
        if (item.numberSpan != null) {
            var spanText = "";
            if (item.type == "section") {
                spanText = shadow.getFullNumber()+" ";
            }
            else if (item.type == "figure") {
                spanText = "Figure "+shadow.getFullNumber();
                if (item.title != "")
                    spanText += ": ";
            }
            else if (item.type == "table") {
                spanText = "Table "+shadow.getFullNumber();
                if (item.title != "")
                    spanText += ": ";
            }
            DOM_setNodeValue(item.numberSpan.firstChild,spanText);
        }

        var refText = shadow.getFullNumber();
        if (refText == "")
            refText = shadow.item.title;
        setReferenceText(shadow.item.node,refText);
    });

    function Structure()
    {
        this.toplevelSections = new Array();
        this.toplevelFigures = new Array();
        this.toplevelTables = new Array();
        this.shadowsByNode = new NodeMap();
    }

    var discoverStructure = trace(function discoverStructure()
    {
        var structure = new Structure();
        var nextToplevelSectionNumber = 1;
        var nextFigureNumber = 1;
        var nextTableNumber = 1;

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
           
            while ((current != null) && (shadow.level < current.level+1))
                current = current.parent;

            shadow.parent = current;
            if (current == null) {
                if (shadow.item.numberSpan != null)
                    shadow.index = nextToplevelSectionNumber++;
                else
                    shadow.index = 0;
                structure.toplevelSections.push(shadow);
            }
            else {
                if (shadow.item.numberSpan != null)
                    shadow.index = current.nextChildSectionNumber++;
                else
                    shadow.index = 0;
                current.children.push(shadow);
            }

            current = shadow;
        }

        for (var figure = figures.list.first; figure != null; figure = figure.next) {
            var shadow = structure.shadowsByNode.get(figure.node);
            if (shadow.item.numberSpan != null)
                shadow.index = nextFigureNumber++;
            else
                shadow.index = 0;
            structure.toplevelFigures.push(shadow);
        }

        for (var table = tables.list.first; table != null; table = table.next) {
            var shadow = structure.shadowsByNode.get(table.node);
            if (shadow.item.numberSpan != null)
                shadow.index = nextTableNumber++;
            else
                shadow.index = 0;
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
            shadow.updateItemNumbering();
        }

        for (var figure = figures.list.first; figure != null; figure = figure.next) {
            var shadow = structure.shadowsByNode.get(figure.node);
            shadow.updateItemNumbering();
        }

        for (var table = tables.list.first; table != null; table = table.next) {
            var shadow = structure.shadowsByNode.get(table.node);
            shadow.updateItemNumbering();
        }

        sections.tocs.forEach(function (node,toc) {
            toc.updateStructure(structure,structure.toplevelSections,pageNumbers);
        });
        figures.tocs.forEach(function (node,toc) {
            toc.updateStructure(structure,structure.toplevelFigures,pageNumbers);
        });
        tables.tocs.forEach(function (node,toc) {
            toc.updateStructure(structure,structure.toplevelTables,pageNumbers);
        });

        var encSections = new Array();
        var encFigures = new Array();
        var encTables = new Array();

        for (var i = 0; i < structure.toplevelSections.length; i++)
            encodeShadow(structure.toplevelSections[i],encSections);
        for (var i = 0; i < structure.toplevelFigures.length; i++)
            encodeShadow(structure.toplevelFigures[i],encFigures);
        for (var i = 0; i < structure.toplevelTables.length; i++)
            encodeShadow(structure.toplevelTables[i],encTables);

        var arg = { sections: encSections,
                    figures: encFigures,
                    tables: encTables };
        Editor_setOutline(arg);
        return;


        function encodeShadow(shadow,result)
        {
            var encChildren = new Array();
            for (var i = 0; i < shadow.children.length; i++)
                encodeShadow(shadow.children[i],encChildren);

            var obj = { id: shadow.item.id,
                        number: shadow.getFullNumber(),
                        children: encChildren };
            result.push(obj);
        }

    });

    function setReferenceText(node,referenceText)
    {
        var id = node.getAttribute("id");
        var refs = refsById[id];
        if (refs != null) {
            for (var i = 0; i < refs.length; i++) {
                DOM_deleteAllChildren(refs[i]);
                DOM_appendChild(refs[i],DOM_createTextNode(document,referenceText));
            }
        }
    }

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

        function printSectionRecursive(shadow,indent)
        {
            var titleNode = shadow.item.getTitleNode(false);
            var content = getNodeText(titleNode);
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
    var getShadowNodes = trace(function getShadowNodes(structure,shadow,result)
    {
        var endShadow = shadow.outerNext(structure);
        var endNode = endShadow ? endShadow.item.node : null;
        for (var n = shadow.item.node; (n != null) && (n != endNode); n = n.nextSibling)
            result.push(n);
    });

    // public
    Outline_moveSection = trace(function moveSection(sectionId,parentId,nextId)
    {
        Selection_preserveWhileExecuting(function() {
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
                next = parent.outerNext(structure);

            if (next == null) {
                for (var i = 0; i < sectionNodes.length; i++)
                    DOM_appendChild(document.body,sectionNodes[i]);
            }
            else {
                for (var i = 0; i < sectionNodes.length; i++)
                    DOM_insertBefore(next.item.node.parentNode,sectionNodes[i],next.item.node);
            }
        });

        scheduleUpdateStructure();
    });

    // public
    Outline_deleteItem = trace(function deleteItem(itemId)
    {
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
    });

    // public
    Outline_goToItem = trace(function goToItem(itemId)
    {
        if (itemId == null) {
            window.scrollTo(0);
        }
        else {
            var node = document.getElementById(itemId);
            var position = new Position(node,0);
            position = Position_closestMatchForwards(position,Position_okForMovement);
            Selection_set(position.node,position.offset,position.node,position.offset);
            Selection_update();

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
    Outline_setNumbered = trace(function setNumbered(itemId,numbered)
    {
        var node = document.getElementById(itemId);
        var item = itemsByNode.get(node);

        var oldNumbered = (item.numberSpan != null);
        UndoManager_addAction(Outline_setNumbered,itemId,oldNumbered);

        UndoManager_disableWhileExecuting(function() {
            if (numbered)
                item.enableNumbering();
            else
                item.disableNumbering();
        });
    });

    // public
    Outline_setTitle = trace(function setTitle(itemId,title)
    {
        var node = document.getElementById(itemId);
        var item = itemsByNode.get(node);
        Selection_preserveWhileExecuting(function() {
            var titleNode = item.getTitleNode(true);
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
            item.updateItemTitle();
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

        updateStructureReal(pageNumbers);
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

    Outline_setReferenceTarget = trace(function setReferenceTarget(node,itemId) {
        Selection_preserveWhileExecuting(function() {
            refRemoved(node);
            DOM_setAttribute(node,"href","#"+itemId);
            refInserted(node);
        });
    });

})();
