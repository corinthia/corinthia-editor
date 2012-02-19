(function() {

    function Section(structure,node)
    {
        if ((node != null) && (node.hasAttribute("id"))) {
            this.id = node.getAttribute("id");
        }
        else {
            this.id = "section"+(structure.nextSectionId++);
            if (node != null)
                node.setAttribute("id",this.id);
        }
        this.node = node;
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

        structure.sectionIdMap[this.id] = this;

        Object.seal(this);
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
        }

        for (var i = 0; i < this.children.length; i++) {
            this.children[i].updateFullNumberRecursive(number);
        }
    }

    function headingModified(self,event)
    {
    }

    function headingInserted(self,node)
    {
        var prevSection = findPrevSection(self,node);
        var section = new Section(self,node);

        // Remove any existing numbering
        var firstText = findFirstTextDescendant(node);
        if (firstText != null)
            firstText.nodeValue = firstText.nodeValue.replace(/^(\d+\.)*\d*\s+/,"");

        section.next = prevSection.next;
        if (section.next != null)
            section.next.prev = section;

        section.prev = prevSection;
        section.prev.next = section;

        function findPrevSection(self,node)
        {
            do node = prevNode(node);
            while ((node != null) && !isHeadingNode(node));
            return (node == null) ? self.rootSection : self.sectionIdMap[node.getAttribute("id")];
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

    function headingRemoved(self,node)
    {
        var section = self.sectionIdMap[node.getAttribute("id")];
        if (section.prev != null)
            section.prev.next = section.next;
        if (section.next != null)
            section.next.prev = section.prev;
        if (section.span != null)
            DOM.deleteNode(section.span);
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

    function docNodeInserted(self,event)
    {
        if (!acceptNode(event.target))
            return;
        recurse(event.target);
        updateSectionStructure(self.rootSection);

        function recurse(node)
        {
            if (isHeadingNode(node))
                headingInserted(self,node);

            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }

    function docNodeRemoved(self,event)
    {
        if (!acceptNode(event.target))
            return;
        recurse(event.target);
        updateSectionStructure(self.rootSection);

        function recurse(node)
        {
            if (isHeadingNode(node))
                headingRemoved(self,node);

            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }

    function updateSectionStructure(topSection)
    {
        var current = topSection;

        for (var section = topSection; section != null; section = section.next) {
            section.parent = null;
            section.children = [];
        }

        for (var section = topSection.next; section != null; section = section.next) {
           
            while (section.level < current.level+1)
                current = current.parent;

            section.parent = current;
            section.index = current.children.length;
            current.children.push(section);

            current = section;

        }

        for (var i = 0; i < topSection.children.length; i++)
            topSection.children[i].updateFullNumberRecursive("");
    }

    function Structure()
    {
        var self = this.self = {};
        self.sectionIdMap = new Object();
        self.nextSectionId = 0;
        self.rootSection = new Section(self);
    }

    Structure.prototype.examineDocument = function(root)
    {
        var self = this.self;

        document.addEventListener("DOMNodeInserted",
                                  function(event) { docNodeInserted(self,event); });
        document.addEventListener("DOMNodeRemoved",
                                  function(event) { docNodeRemoved(self,event); });

        var topSection = self.rootSection;

        docNodeInserted(self,{target:document});


        topSection.print();
    }

    var instance = null;

    Structure.examineDocument = function(root)
    {
        if (instance == null)
            instance = new Structure();
        instance.examineDocument(root);
    }

    window.Structure = Structure;

})();
