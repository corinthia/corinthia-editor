(function() {

    var sectionIdMap = new Object();
    var nextSectionId = 0;
    var outlineDirty = false;
    var ignoreHeadingModifications = 0;
    var rootSection = null;

    function Section(node)
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
        this.level = node ? parseInt(node.nodeName.substring(1)) : 0;
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

        sectionIdMap[this.id] = this;

        Object.seal(this);
    }

    Section.prototype.last = function()
    {
        if (this.children.length == 0)
            return this;
        else
            return this.children[this.children.length-1].last();
    }

    Section.prototype.outerNext = function()
    {
        var last = this.last();
        if (last == null)
            return null;
        else
            return last.next;
    }

    Section.prototype.toString = function()
    {
        if (this.isRoot)
            return "(root)";

        var str = "["+this.id+"] "+this.fullNumber+" "+this.node;
        if (this.node != null)
            str += " "+JSON.stringify(getNodeText(this.node));
        str += " (level "+this.level+")";
        return str;
    }

    Section.prototype.print = function(indent)
    {
        if (indent == null)
            indent = "";
        debug(indent+this);
        for (var i = 0; i < this.children.length; i++)
            this.children[i].print(indent+"    ");
    }

    Section.prototype.updateFullNumberRecursive = function(prefix)
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
                this.span.setAttribute("class","-uxwrite-heading-number");
                this.span.setAttribute("style","color: red");
                DOM.insertBefore(this.node,this.span,this.node.firstChild);
                var text = DOM.createTextNode(document,"");
                DOM.appendChild(this.span,text);
            }

            this.span.firstChild.nodeValue = this.fullNumber+" ";
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
            scheduleUpdateSectionStructure();
        }
    }

    function headingInserted(node)
    {
        var prevSection = findPrevSection(node);
        var section = new Section(node);

        // Remove any existing numbering
        var firstText = findFirstTextDescendant(node);
        if (firstText != null)
            firstText.nodeValue = firstText.nodeValue.replace(/^(\d+\.)*\d*\s+/,"");

        section.next = prevSection.next;
        if (section.next != null)
            section.next.prev = section;

        section.prev = prevSection;
        section.prev.next = section;

        node.addEventListener("DOMSubtreeModified",section.modificationListener);
        scheduleUpdateSectionStructure();
        return;

        function findPrevSection(node)
        {
            do node = prevNode(node);
            while ((node != null) && !isHeadingNode(node));
            return (node == null) ? rootSection : sectionIdMap[node.getAttribute("id")];
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

    function headingRemoved(node)
    {
        var section = sectionIdMap[node.getAttribute("id")];
        if (section.prev != null)
            section.prev.next = section.next;
        if (section.next != null)
            section.next.prev = section.prev;
        if (section.span != null)
            DOM.deleteNode(section.span);

        node.removeEventListener("DOMSubtreeModified",section.modificationListener);
        scheduleUpdateSectionStructure();
        return;
    }

    function acceptNode(node)
    {
        for (var p = node; p != null; p = p.parentNode) {
            if ((p.nodeType == Node.ELEMENT_NODE) &&
                (p.nodeName == "SPAN") &&
                (p.getAttribute("class") == "-uxwrite-heading-number"))
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

            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }

    function scheduleUpdateSectionStructure()
    {
        if (!outlineDirty) {
            outlineDirty = true;
            PostponedActions.add(updateSectionStructure);
        }
    }

    function updateSectionStructure()
    {
        if (!outlineDirty)
            return;
        outlineDirty = false;
        var current = rootSection;

        for (var section = rootSection; section != null; section = section.next) {
            section.parent = null;
            section.children = [];
        }

        for (var section = rootSection.next; section != null; section = section.next) {
           
            while (section.level < current.level+1)
                current = current.parent;

            section.parent = current;
            section.index = current.children.length;
            current.children.push(section);

            current = section;

        }

        ignoreHeadingModifications++;
        for (var i = 0; i < rootSection.children.length; i++)
            rootSection.children[i].updateFullNumberRecursive("");
        ignoreHeadingModifications--;

        var sections = new Array();
        encodeSection(rootSection,sections);
        editor.setOutline(sections);
    }

    function encodeSection(section,result)
    {
        var childIds = new Array();
        for (var i = 0; i < section.children.length; i++)
            childIds.push(section.children[i].id);

        var obj = { id: section.id,
                    index: (section.index == null) ? -1 : section.index,
                    title: section.title,
                    childIds: childIds };
        result.push(obj);
        for (var i = 0; i < section.children.length; i++)
            encodeSection(section.children[i],result);
    }

    window.Outline = new Object();

    Outline.init = function()
    {
        Outline.root = rootSection = new Section();
        document.addEventListener("DOMNodeInserted",docNodeInserted);
        document.addEventListener("DOMNodeRemoved",docNodeRemoved);

        docNodeInserted({target:document});
//        rootSection.print();
    }

    Outline.addSection = function(title,parentId)
    {
        updateSectionStructure(); // make sure pointers are valid

        var parent = sectionIdMap[parentId];
        if (parent.level == 6) // H6 is max depth in HTML
            parent = parent.parent;

        var outerNext = parent.outerNext();
        var parentNode = outerNext ? outerNext.node.parentNode : document.body;
        var nextSibling = outerNext ? outerNext.node : null;

        var heading = DOM.createElement(document,"H"+(parent.level+1));
        DOM.appendChild(heading,DOM.createTextNode(document,title));
        DOM.insertBefore(parentNode,heading,nextSibling);

        Outline.goToSection(heading.getAttribute("id"));
    }

    function getSectionNodes(section,result)
    {
        var endSection = section.outerNext();
        var endNode = endSection ? endSection.node : null;
        for (var n = section.node; (n != null) && (n != endNode); n = n.nextSibling)
            result.push(n);
    }

    function getSectionNodesRecursive(section,result)
    {
        getSectionNodes(section,result);
        for (var i = 0; i < section.children.length; i++)
            getSectionNodesRecursive(section.children[i],result);
    }

    Outline.moveSection = function(sectionId,parentId,nextId)
    {
        updateSectionStructure(); // make sure pointers are valid

        var section = sectionIdMap[sectionId];
        var parent = sectionIdMap[parentId];
        var next = nextId ? sectionIdMap[nextId] : null;

        if (parent.level != section.level-1)
            throw new Error("Moving section to a different level is not yet supported");

        if (section == next)
            throw new Error("Attempt to place a section directly before itself");

        if (next == null)
            next = parent.outerNext();

        var nextNode;
        if (next != null)
            nextNode = next.node;

        var sectionNodes = new Array();
        getSectionNodes(section,sectionNodes);

        if (next == null) {
            for (var i = 0; i < sectionNodes.length; i++)
                DOM.appendChild(document.body,sectionNodes[i]);
        }
        else {
            for (var i = 0; i < sectionNodes.length; i++)
                DOM.insertBefore(next.node.parentNode,sectionNodes[i],nextNode);
        }

        scheduleUpdateSectionStructure();
    }

    Outline.deleteSection = function(sectionId)
    {
        var section = sectionIdMap[sectionId];
        var sectionNodes = new Array();
        getSectionNodes(section,sectionNodes);
        for (var i = 0; i < sectionNodes.length; i++)
            DOM.deleteNode(sectionNodes[i]);

        scheduleUpdateSectionStructure();
    }

    Outline.goToSection = function(sectionId)
    {
        if (sectionId == rootSection.id) {
            window.scrollTo(0);
        }
        else {
            var section = document.getElementById(sectionId);
            var location = webkitConvertPointFromNodeToPage(section,
                                                            new WebKitPoint(0,0));
            window.scrollTo(0,location.y);
        }
    }

    Outline.test1 = function()
    {
        var first3c = document.getElementById("first3c");
        var second3c = document.getElementById("second3c");
        var next;
        for (var node = first3c; node != second3c; node = next) {
            next = node.nextSibling;
            DOM.deleteNode(node);
        }
    }

    Outline.test2 = function()
    {
        var first6c = document.getElementById("first6c");
        var second6c = document.getElementById("second6c");
        var next;
        for (var node = first6c; node != second6c; node = next) {
            next = node.nextSibling;
            DOM.deleteNode(node);
        }
    }

})();
