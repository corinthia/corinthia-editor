(function() {

    var itemsById = new Object();
    var refsById = new Object();
    var nextItemId = 1;
    var outlineDirty = false;
    var ignoreModifications = 0;
    var figureList = new DoublyLinkedList();
    var tableList = new DoublyLinkedList();
    var sectionList = new DoublyLinkedList();
    var doneInit = false;

    function DoublyLinkedList()
    {
        this.first = null;
        this.last = null;
    }

    DoublyLinkedList.prototype.insertItemAfter = function(item,after)
    {
        item.prev = null;
        item.next = null;

        if (this.first == null) { // empty list
            this.first = item;
            this.last = item;
        }
        else if (after == null) { // insert at start
            item.next = this.first;
            this.first = item;
        }
        else {
            item.next = after.next;
            item.prev = after;
            if (this.last == after)
                this.last = item;
        }

        if (item.next != null)
            item.next.prev = item;
        if (item.prev != null)
            item.prev.next = item;
    }

    DoublyLinkedList.prototype.removeItem = function(item)
    {
        if (this.first == item)
            this.first = this.first.next;
        if (this.last == item)
            this.last = this.last.prev;
        if (item.prev != null)
            item.prev.next = item.next;
        if (item.next != null)
            item.next.prev = item.prev;
        item.prev = null;
        item.next = null;
    }

    function generateItemId()
    {
        var id;
        do {
            id = "item"+(nextItemId++);
        } while (document.getElementById(id) != null);
        return id;
    }

    function OutlineItem(type,node)
    {
        var section = this;
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
        this.span = null;
        this.titleNode = null;
        this.referenceText = null;
        this.numbered = false;

        this.prev = null;
        this.next = null;
        this.references = new NodeSet();
        this.modificationListener = function(event) { headingModified(section); }

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
    }

    function findChild(node,name)
    {
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            if (DOM.upperName(child) == name)
                return child;
        }
        return null;
    }

    OutlineItem.prototype.enableNumbering = function()
    {
        if (this.numbered)
            return;
        this.span = DOM.createElement(document,"SPAN");
        this.span.setAttribute("class",this.spanClass);
        DOM.insertBefore(this.titleNode,this.span,this.titleNode.firstChild);
        DOM.appendChild(this.span,DOM.createTextNode(document,""));
        this.numbered = true;
        scheduleUpdateOutlineItemStructure();
    }

    OutlineItem.prototype.disableNumbering = function()
    {
        if (!this.numbered)
            return;
        DOM.deleteNode(this.span);
        this.span = null;
        this.numbered = false;
        scheduleUpdateOutlineItemStructure();
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
            if (((this.prev != null) && this.prev.numbered) ||
                ((this.next != null) && this.next.numbered)) {
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
        if (!this.numbered)
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

    function getNodeTextAfter(node)
    {
        var text = "";
        for (var child = node.nextSibling; child != null; child = child.nextSibling)
            text += getNodeText(child);
        return text;
    }

    function getItemTitle(item)
    {
        if (item.span != null)
            return normalizeWhitespace(getNodeTextAfter(item.span));
        else
            return normalizeWhitespace(getNodeText(item.titleNode));
    }

    function updateSectionItem(item)
    {
        item.title = getItemTitle(item);
        if (item.numbered) {
            var spanText = item.getFullNumber()+" ";
            DOM.setNodeValue(item.span.firstChild,spanText);
        }
    }

    function updateFigureItem(item)
    {
        item.title = getItemTitle(item);
        if (item.numbered) {
            var spanText = "Figure "+item.getFullNumber();
            if (item.title != "")
                spanText += ": ";
            DOM.setNodeValue(item.span.firstChild,spanText);
        }
    }

    function updateTableItem(item)
    {
        item.title = getItemTitle(item);
        if (item.numbered) {
            var spanText = "Table "+item.getFullNumber();
            if (item.title != "")
                spanText += ": ";
            DOM.setNodeValue(item.span.firstChild,spanText);
        }
    }

    function headingModified(section)
    {
        if (ignoreModifications > 0)
            return;
        var newTitle = getNodeText(section.node);
        if (newTitle != section.title) {
            section.title = newTitle;
            scheduleUpdateOutlineItemStructure();
        }
    }

    function headingInserted(node)
    {
        var item = new OutlineItem("section",node);
        var prev = findPrevItemOfType(node,isHeadingNode);
        sectionList.insertItemAfter(item,prev);

        // Remove any existing numbering
        var firstText = findFirstTextDescendant(node);
        if (firstText != null) {
            var regex = /^(\d+\.)*\d*\s+/;
            if (firstText.nodeValue.match(regex)) {
                DOM.setNodeValue(firstText,firstText.nodeValue.replace(regex,""));
                item.enableNumbering();
            }
        }

        if (doneInit && !item.numbered)
            item.setNumberedUsingAdjacent();

        node.addEventListener("DOMSubtreeModified",item.modificationListener);
        scheduleUpdateOutlineItemStructure();
        return;

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

    function headingRemoved(node)
    {
        var section = itemsById[node.getAttribute("id")];

        sectionList.removeItem(section);

        if (section.span != null)
            DOM.deleteNode(section.span);

        node.removeEventListener("DOMSubtreeModified",section.modificationListener);
        scheduleUpdateOutlineItemStructure();
        return;
    }

    function findPrevItemOfType(node,typeFun)
    {
        do node = prevNode(node);
        while ((node != null) && !typeFun(node));
        return (node == null) ? null : itemsById[node.getAttribute("id")];
    }

    function figureInserted(node)
    {
        var item = new OutlineItem("figure",node);
        var prev = findPrevItemOfType(node,isFigureNode);
        figureList.insertItemAfter(item,prev);

        scheduleUpdateOutlineItemStructure();
        return;
    }

    function figureRemoved(node)
    {
        var table = itemsById[node.getAttribute("id")];
        figureList.removeItem(table);
    }

    function tableInserted(node)
    {
        var item = new OutlineItem("table",node);
        var prev = findPrevItemOfType(node,isTableNode);
        tableList.insertItemAfter(item,prev);

        scheduleUpdateOutlineItemStructure();
        return;
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

    function tableRemoved(node)
    {
        var table = itemsById[node.getAttribute("id")];
        figureList.removeItem(table);
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
                headingInserted(node);
            else if (isFigureNode(node))
                figureInserted(node);
            else if (isTableNode(node))
                tableInserted(node);
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
                headingRemoved(node);
            else if (isFigureNode(node))
                figureRemoved(node);
            else if (isTableNode(node))
                tableRemoved(node);
            else if (isRefNode(node))
                refRemoved(node);

            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }

    function scheduleUpdateOutlineItemStructure()
    {
        if (!outlineDirty) {
            outlineDirty = true;
            PostponedActions.add(updateOutlineItemStructure);
        }
    }

    function updateOutlineItemStructure()
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
        for (var section = sectionList.first; section != null; section = section.next) {
            section.parent = null;
            section.children = [];
            countA++;
        }

        ignoreModifications++;

        for (var section = sectionList.first; section != null; section = section.next) {
           
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
            updateSectionItem(section);
            section.setReferenceText("Section "+section.getFullNumber());
        }

        for (var figure = figureList.first; figure != null; figure = figure.next) {
            figure.index = toplevelFigures.length;
            toplevelFigures.push(figure);
            updateFigureItem(figure);
            figure.setReferenceText("Figure "+figure.getFullNumber());
        }

        for (var table = tableList.first; table != null; table = table.next) {
            table.index = toplevelTables.length;
            toplevelTables.push(table);
            updateTableItem(table);
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
        editor.setOutline(arg);
    }

    function encodeItem(item,result)
    {
        var encChildren = new Array();
        for (var i = 0; i < item.children.length; i++)
            encodeItem(item.children[i],encChildren);

        var obj = { id: item.id,
                    type: item.type,
                    index: (item.index == null) ? -1 : item.index,
                    number: item.getFullNumber(),
                    title: item.title,
                    children: encChildren };
        result.push(obj);
    }

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

    function moveSection(sectionId,parentId,nextId)
    {
        Selection.trackWhileExecuting(function() {
            updateOutlineItemStructure(); // make sure pointers are valid

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

        scheduleUpdateOutlineItemStructure();
    }

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

        scheduleUpdateOutlineItemStructure();
    }

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
