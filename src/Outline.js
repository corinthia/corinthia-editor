(function() {

    var itemIdMap = new Object();
    var nextSectionId = 1;
    var outlineDirty = false;
    var ignoreHeadingModifications = 0;
    var figureList = new DoublyLinkedList();
    var tableList = new DoublyLinkedList();
    var sectionList = new DoublyLinkedList();

    function DoublyLinkedList()
    {
        this.sentinel = new Object();
        this.sentinel.next = this.sentinel;
        this.sentinel.prev = this.sentinel;
        this.sentinel.isSentinel = true;
    }

    DoublyLinkedList.prototype.insertItemAfter = function(item,after)
    {
        if (after == null)
            after = this.sentinel;

        item.prev = after;
        item.next = after.next;

        item.prev.next = item;
        item.next.prev = item;
    }

    DoublyLinkedList.prototype.removeItem = function(item)
    {
        if (item == this.sentinel)
            throw new Error("DoublyLinkedList: attempt tor remove sentinel node");
        item.prev.next = item.next;
        item.next.prev = item.prev;
        item.prev = null;
        item.next = null;
    }

    function OutlineItem(node)
    {
        var section = this;
        if ((node != null) && (node.hasAttribute("id"))) {
            this.id = node.getAttribute("id");
        }
        else {
            this.id = "section"+(nextSectionId++);
            if (node != null)
                node.setAttribute("id",this.id);
        }
        this.node = node;
        this.title = node ? getNodeText(node) : "Contents";
        this.level = node ? parseInt(DOM.upperName(node).substring(1)) : 0;
        this.index = null;
        this.parent = null;
        this.children = new Array();
        this.fullNumber = null;
        this.isRoot = (this.level == 0);
        this.span = null;

        this.prev = null;
        this.next = null;
        this.references = new NodeSet();
        this.modificationListener = function(event) { headingModified(section); }

        itemIdMap[this.id] = this;

        Object.seal(this);
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
        else if (last.next.isSentinel)
            return null;
        else
            return last.next;
    }

    OutlineItem.prototype.toString = function()
    {
        if (this.isRoot)
            return "(root)";

        var str = "["+this.id+"] "+this.fullNumber+" "+this.node;
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

    OutlineItem.prototype.updateFullNumberRecursive = function(prefix)
    {
        var number;
        if (prefix == "")
            number = ""+(this.index+1)
        else
            number = prefix+"."+(this.index+1);

        if (number != this.fullNumber) {
            this.fullNumber = number;

            if (this.span == null) {
                this.span = DOM.createElement(document,"SPAN");
                this.span.setAttribute("class",Keys.HEADING_NUMBER);
                DOM.insertBefore(this.node,this.span,this.node.firstChild);
                var text = DOM.createTextNode(document,"");
                DOM.appendChild(this.span,text);
            }

            DOM.setNodeValue(this.span.firstChild,this.fullNumber+" ");
            this.title = getNodeText(this.node);
        }

        for (var i = 0; i < this.children.length; i++) {
            this.children[i].updateFullNumberRecursive(number);
        }
    }

    function headingModified(section)
    {
        if (ignoreHeadingModifications > 0)
            return;
        var newTitle = getNodeText(section.node);
        if (newTitle != section.title) {
            section.title = newTitle;
            scheduleUpdateOutlineItemStructure();
        }
    }

    function headingInserted(node)
    {
        var section = new OutlineItem(node);

        // Remove any existing numbering
        var firstText = findFirstTextDescendant(node);
        if (firstText != null)
            DOM.setNodeValue(firstText,firstText.nodeValue.replace(/^(\d+\.)*\d*\s+/,""));

        var actualPrev = findPrevItemOfType(node,isHeadingNode,null);
        sectionList.insertItemAfter(section,actualPrev);


        node.addEventListener("DOMSubtreeModified",section.modificationListener);
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
        var section = itemIdMap[node.getAttribute("id")];

        sectionList.removeItem(section);

        if (section.span != null)
            DOM.deleteNode(section.span);

        node.removeEventListener("DOMSubtreeModified",section.modificationListener);
        scheduleUpdateOutlineItemStructure();
        return;
    }

    function findPrevItemOfType(node,typeFun,defaultValue)
    {
        do node = prevNode(node);
        while ((node != null) && !typeFun(node));
        return (node == null) ? defaultValue : itemIdMap[node.getAttribute("id")];
    }


    function findNextItemOfType(node,typeFun)
    {
        do node = nextNode(node);
        while ((node != null) && !typeFun(node));
        return (node == null) ? null : itemIdMap[node.getAttribute("id")];
    }

    function figureInserted(node)
    {
    }

    function figureRemoved(node)
    {
    }

    function tableInserted(node)
    {
    }

    function tableRemoved(node)
    {
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
        var wrapper = new Object();

        var current = null;
        wrapper.parent = null;
        wrapper.children = [];

        var countA = 0;
        for (var section = sectionList.sentinel.next;
             section != sectionList.sentinel;
             section = section.next) {
            section.parent = null;
            section.children = [];
            countA++;
        }

        var countB = 0;
        for (var section = sectionList.sentinel.next;
             section != sectionList.sentinel;
             section = section.next) {
           
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
            countB++;
        }

        ignoreHeadingModifications++;
        for (var i = 0; i < toplevelSections.length; i++)
            toplevelSections[i].updateFullNumberRecursive("");
        ignoreHeadingModifications--;

        var encOutlineItems = new Array();
        var encFigures = new Array();
        var encTables = new Array();

        for (var i = 0; i < toplevelSections.length; i++)
            encodeItem(toplevelSections[i],encOutlineItems);

        editor.setOutline({ sections: encOutlineItems,
                            figures: encFigures,
                            tables: encTables });
    }

    function encodeItem(item,result)
    {
        var encChildren = new Array();
        for (var i = 0; i < item.children.length; i++)
            encodeItem(item.children[i],encChildren);

        var obj = { id: item.id,
                    index: (item.index == null) ? -1 : item.index,
                    title: item.title,
                    children: encChildren };
        result.push(obj);
    }

    window.Outline = new Object();

    Outline.init = function()
    {
        DOM.ensureUniqueIds(document.documentElement);
        document.addEventListener("DOMNodeInserted",docNodeInserted);
        document.addEventListener("DOMNodeRemoved",docNodeRemoved);

        docNodeInserted({target:document});
    }

    function getOutlineItemNodes(section,result)
    {
        var endOutlineItem = section.outerNext();
        var endNode = endOutlineItem ? endOutlineItem.node : null;
        for (var n = section.node; (n != null) && (n != endNode); n = n.nextSibling)
            result.push(n);
    }

    Outline.moveSection = function(sectionId,parentId,nextId)
    {
        Selection.trackWhileExecuting(function() {
            updateOutlineItemStructure(); // make sure pointers are valid

            var section = itemIdMap[sectionId];
            var parent = parentId ? itemIdMap[parentId] : null;
            var next = nextId ? itemIdMap[nextId] : null;

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

    Outline.deleteItem = function(itempId)
    {
        Selection.trackWhileExecuting(function() {
            var section = itemIdMap[itempId];
            var sectionNodes = new Array();
            getOutlineItemNodes(section,sectionNodes);
            for (var i = 0; i < sectionNodes.length; i++)
                DOM.deleteNode(sectionNodes[i]);
        });

        scheduleUpdateOutlineItemStructure();
    }

    Outline.goToItem = function(itemId)
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

})();
