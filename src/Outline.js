(function() {

    var itemsById = new Object();
    var refsById = new Object();
    var nextItemId = 1;
    var outlineDirty = false;
    var ignoreModifications = 0;

    var sectionNumberRegex = /^\s*(Chapter\s+)?\d+(\.\d+)*\.?\s+/i;
    var figureNumberRegex = /^\s*Figure\s+\d+(\.\d+)*:?\s*/i;
    var tableNumberRegex = /^\s*Table\s+\d+(\.\d+)*:?\s*/i;

    var sections = new Category("section",isHeadingNode,sectionNumberRegex);
    var figures = new Category("figure",isFigureNode,figureNumberRegex);
    var tables = new Category("table",isTableNode,tableNumberRegex);

    var doneInit = false;

    function Category(type,nodeFilter,numberRegex)
    {
        this.type = type;
        this.nodeFilter = nodeFilter;
        this.numberRegex = numberRegex;
        this.list = new DoublyLinkedList();
    }

    Category.prototype.add = function(node)
    {
        var item = new OutlineItem(this.type,node);
        var prevItem = findPrevItemOfType(node,this.nodeFilter);
        this.list.insertAfter(item,prevItem);
        Editor.addOutlineItem(item.id,this.type);

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
            var regex = item.numberRegex;
            var str = firstText.nodeValue;
            if (str.match(item.numberRegex)) {
                DOM.setNodeValue(firstText,str.replace(item.numberRegex,""));
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

        scheduleUpdateStructure();
        return item;

        function findPrevItemOfType(node,typeFun)
        {
            do node = prevNode(node);
            while ((node != null) && !typeFun(node));
            return (node == null) ? null : itemsById[node.getAttribute("id")];
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
    }

    Category.prototype.remove = function(node)
    {
        var item = itemsById[node.getAttribute("id")];
        if (item == null) {
            throw new Error("Attempt to remove non-existant "+node.nodeName+" item "+
                            node.getAttribute("id"));
        }
        this.list.remove(item);
        Editor.removeOutlineItem(item.id);
        item.node.removeEventListener("DOMSubtreeModified",item.modificationListener);
        if (item.numberSpan != null)
            DOM.deleteNode(item.numberSpan);
        scheduleUpdateStructure();
    }

    function OutlineItem(type,node)
    {
        var item = this;
        if ((node != null) && (node.hasAttribute("id"))) {
            this.id = node.getAttribute("id");
        }
        else {
            this.id = generateItemId();
            if (node != null)
                node.setAttribute("id",this.id);
        }
        this.type = type;
        this.node = node;
        this.title = null;
        this.level = node ? parseInt(DOM.upperName(node).substring(1)) : 0;
        this.index = null;
        this.parent = null;
        this.children = new Array();
        this.isRoot = (this.level == 0);
        this.numberSpan = null;
        this.titleNode = null;
        this.referenceText = null;

        this.prev = null;
        this.next = null;
        this.references = new NodeSet();
        this.modificationListener = function(event) { itemModified(item); }

        itemsById[this.id] = this;

        this.spanClass = null;
        if (type == "section") {
            this.titleNode = node;
            this.spanClass = Keys.HEADING_NUMBER;
        }
        else if (type == "figure") {
            this.titleNode = findChild(node,"FIGCAPTION");
            if (this.titleNode == null) {
                this.titleNode = DOM.createElement(document,"FIGCAPTION");
                DOM.appendChild(this.node,this.titleNode);
            }
            this.spanClass = Keys.FIGURE_NUMBER;
            this.enableNumbering();
        }
        else if (type == "table") {
            this.titleNode = findChild(node,"CAPTION");
            if (this.titleNode == null) {
                this.titleNode = DOM.createElement(document,"CAPTION");
                DOM.insertBefore(this.node,this.titleNode,this.node.firstChild);
            }
            this.spanClass = Keys.TABLE_NUMBER;
            this.enableNumbering();
        }

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

        function findChild(node,name)
        {
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                if (DOM.upperName(child) == name)
                    return child;
            }
            return null;
        }
    }

    OutlineItem.prototype.enableNumbering = function()
    {
        if (this.numberSpan != null)
            return;
        this.numberSpan = DOM.createElement(document,"SPAN");
        this.numberSpan.setAttribute("class",this.spanClass);
        DOM.insertBefore(this.titleNode,this.numberSpan,this.titleNode.firstChild);
        DOM.appendChild(this.numberSpan,DOM.createTextNode(document,""));
        scheduleUpdateStructure();
    }

    OutlineItem.prototype.disableNumbering = function()
    {
        if (this.numberSpan == null)
            return;
        DOM.deleteNode(this.numberSpan);
        this.numberSpan = null;
        scheduleUpdateStructure();
    }

    OutlineItem.prototype.setNumberedUsingAdjacent = function()
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
    }

    OutlineItem.prototype.last = function()
    {
        if (this.children.length == 0)
            return this;
        else
            return this.children[this.children.length-1].last();
    }

    OutlineItem.prototype.outerNext = function()
    {
        var last = this.last();
        if (last == null)
            return null;
        else if (last.next == null)
            return null;
        else
            return last.next;
    }

    OutlineItem.prototype.toString = function()
    {
        if (this.isRoot)
            return "(root)";

        var str = "["+this.id+"] "+this.getFullNumber()+" "+this.node;
        if (this.node != null)
            str += " "+JSON.stringify(getNodeText(this.node));
        str += " (level "+this.level+")";
        return str;
    }

    OutlineItem.prototype.print = function(indent)
    {
        if (indent == null)
            indent = "";
        debug(indent+this);
        for (var i = 0; i < this.children.length; i++)
            this.children[i].print(indent+"    ");
    }

    OutlineItem.prototype.getFullNumber = function()
    {
        if (this.numberSpan == null)
            return "";
        var item = this;
        var fullNumber = ""+(item.index+1);
        while (item.parent != null) {
            item = item.parent;
            fullNumber = (item.index+1)+"."+fullNumber;
        }
        return fullNumber;
    }

    OutlineItem.prototype.setReferenceText = function(referenceText)
    {
        if (this.referenceText == referenceText)
            return; // don't waste time updating refs

        this.referenceText = referenceText;

        var refs = refsById[this.id];
        if (refs != null) {
            for (var i = 0; i < refs.length; i++) {
                DOM.deleteAllChildren(refs[i]);
                DOM.appendChild(refs[i],DOM.createTextNode(document,referenceText));
            }
        }
    }

    OutlineItem.prototype.updateItemNumbering = function()
    {
        var item = this;
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
            DOM.setNodeValue(item.numberSpan.firstChild,spanText);
        }
    }

    OutlineItem.prototype.updateItemTitle = function()
    {
        if (this.numberSpan != null)
            newTitle = normalizeWhitespace(getNodeTextAfter(this.numberSpan));
        else
            newTitle = normalizeWhitespace(getNodeText(this.titleNode));

        if (this.title != newTitle) {
            this.title = newTitle;
            Editor.updateOutlineItem(this.id,this.title);
        }

        function getNodeTextAfter(node)
        {
            var text = "";
            for (var child = node.nextSibling; child != null; child = child.nextSibling)
                text += getNodeText(child);
            return text;
        }
    }

    function itemModified(item)
    {
        if (ignoreModifications > 0)
            return;
        item.updateItemTitle();
    }

    function refInserted(node)
    {
        var href = node.getAttribute("href");
        if (href.charAt(0) != "#")
            throw new Error("refInserted: not a # reference");
        var id = href.substring(1);

        if (refsById[id] == null)
            refsById[id] = new Array();
        refsById[id].push(node);

        var item = itemsById[id];
        if ((item != null) && (item.referenceText != null)) {
            DOM.deleteAllChildren(node);
            DOM.appendChild(node,DOM.createTextNode(document,item.referenceText));
        }
    }

    function refRemoved(node)
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
    }

    function acceptNode(node)
    {
        for (var p = node; p != null; p = p.parentNode) {
            if ((p.nodeType == Node.ELEMENT_NODE) &&
                (DOM.upperName(p) == "SPAN") &&
                (p.getAttribute("class") == Keys.HEADING_NUMBER))
                return false;
        }
        return true;
    }

    function docNodeInserted(event)
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

            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }

    function docNodeRemoved(event)
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

            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }

    function scheduleUpdateStructure()
    {
        if (!outlineDirty) {
            outlineDirty = true;
            PostponedActions.add(updateStructure);
        }
    }

    function updateStructure()
    {
        if (!outlineDirty)
            return;
        outlineDirty = false;

        var toplevelSections = new Array();
        var toplevelFigures = new Array();
        var toplevelTables = new Array();
        var wrapper = new Object();

        var current = null;
        wrapper.parent = null;
        wrapper.children = [];

        var countA = 0;
        for (var section = sections.list.first; section != null; section = section.next) {
            section.parent = null;
            section.children = [];
            countA++;
        }

        ignoreModifications++;

        for (var section = sections.list.first; section != null; section = section.next) {
           
            while ((current != null) && (section.level < current.level+1))
                current = current.parent;

            section.parent = current;
            if (current == null) {
                section.index = toplevelSections.length;
                toplevelSections.push(section);
            }
            else {
                section.index = current.children.length;
                current.children.push(section);
            }

            current = section;
            section.updateItemNumbering();
            section.setReferenceText("Section "+section.getFullNumber());
        }

        for (var figure = figures.list.first; figure != null; figure = figure.next) {
            figure.index = toplevelFigures.length;
            toplevelFigures.push(figure);
            figure.updateItemNumbering();
            figure.setReferenceText("Figure "+figure.getFullNumber());
        }

        for (var table = tables.list.first; table != null; table = table.next) {
            table.index = toplevelTables.length;
            toplevelTables.push(table);
            table.updateItemNumbering();
            table.setReferenceText("Table "+table.getFullNumber());
        }

        ignoreModifications--;

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
        Editor.setOutline(arg);
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
    }

    // public
    function init()
    {
        DOM.ensureUniqueIds(document.documentElement);
        document.addEventListener("DOMNodeInserted",docNodeInserted);
        document.addEventListener("DOMNodeRemoved",docNodeRemoved);

        docNodeInserted({target:document});
        doneInit = true;
    }

    function getOutlineItemNodes(section,result)
    {
        var endOutlineItem = section.outerNext();
        var endNode = endOutlineItem ? endOutlineItem.node : null;
        for (var n = section.node; (n != null) && (n != endNode); n = n.nextSibling)
            result.push(n);
    }

    // public
    function moveSection(sectionId,parentId,nextId)
    {
        Selection.trackWhileExecuting(function() {
            updateStructure(); // make sure pointers are valid

            var section = itemsById[sectionId];
            var parent = parentId ? itemsById[parentId] : null;
            var next = nextId ? itemsById[nextId] : null;

            var sectionNodes = new Array();
            getOutlineItemNodes(section,sectionNodes);

            if ((next == null) && (parent != null))
                next = parent.outerNext();

            if (next == null) {
                for (var i = 0; i < sectionNodes.length; i++)
                    DOM.appendChild(document.body,sectionNodes[i]);
            }
            else {
                for (var i = 0; i < sectionNodes.length; i++)
                    DOM.insertBefore(next.node.parentNode,sectionNodes[i],next.node);
            }
        });

        scheduleUpdateStructure();
    }

    // public
    function deleteItem(itemId)
    {
        Selection.trackWhileExecuting(function() {
            var item = itemsById[itemId];
            if (item.type == "section") {
                var sectionNodes = new Array();
                getOutlineItemNodes(item,sectionNodes);
                for (var i = 0; i < sectionNodes.length; i++)
                    DOM.deleteNode(sectionNodes[i]);
            }
            else {
                DOM.deleteNode(item.node);
            }
        });

        scheduleUpdateStructure();
    }

    // public
    function goToItem(itemId)
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
    }

    // public
    function setNumbered(itemId,numbered)
    {
        var item = itemsById[itemId];
        if (numbered)
            item.enableNumbering();
        else
            item.disableNumbering();
    }

    window.Outline = new (function Outline(){});
    Outline.init = trace(init);
    Outline.moveSection = trace(moveSection);
    Outline.deleteItem = trace(deleteItem);
    Outline.goToItem = trace(goToItem);
    Outline.setNumbered = setNumbered;

})();
