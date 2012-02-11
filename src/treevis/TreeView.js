(function() {

    var DISPLAY_NODE_WIDTH = 16;
    var DISPLAY_NODE_SPACING = 6;
    var LEVEL_HEIGHT = 60;

    function DisplayNode(domNode,treeView)
    {
        this.domNode = domNode;
        this.treeView = treeView;

        this.svgNode = document.createElementNS(SVG_NAMESPACE,"circle");
        this.svgNode.setAttribute("class","DisplayNode");
        this.svgNode.setAttribute("r",Math.floor(DISPLAY_NODE_WIDTH/2));
        this.parentLink = document.createElementNS(SVG_NAMESPACE,"line");
        this.parentLink.setAttribute("class","DisplayLink");
        this.childrenHLine = document.createElementNS(SVG_NAMESPACE,"line");
        this.childrenHLine.setAttribute("class","DisplayLink");
        this.childrenVLine = document.createElementNS(SVG_NAMESPACE,"line");
        this.childrenVLine.setAttribute("class","DisplayLink");

        this.x = null;
        this.y = null;
    }

    function displayNodeOf(treeView,otherDomNode)
    {
        if (otherDomNode == null)
            return null;
        else
            return treeView.displayNodes.get(otherDomNode);
    }

    Object.defineProperty(DisplayNode.prototype,"parentNode", { get: function() {
        return displayNodeOf(this.treeView,this.domNode.parentNode); }});
    Object.defineProperty(DisplayNode.prototype,"firstChild", { get: function() {
        return displayNodeOf(this.treeView,this.domNode.firstChild); }});
    Object.defineProperty(DisplayNode.prototype,"lastChild", {get: function() {
        return displayNodeOf(this.treeView,this.domNode.lastChild); }});
    Object.defineProperty(DisplayNode.prototype,"nextSibling", { get: function() {
        return displayNodeOf(this.treeView,this.domNode.nextSibling); }});
    Object.defineProperty(DisplayNode.prototype,"previousSibling", {get: function() {
        return displayNodeOf(this.treeView,this.domNode.previousSibling); }});

    function updateTrackedProperties(self)
    {
        //    debug("TreeView: # tracked properties = "+
        //          Object.getOwnPropertyNames(PropertyTracker.allTrackedProperties));

        for (var watchId in PropertyTracker.allTrackedProperties) {
            var watch = PropertyTracker.allTrackedProperties[watchId];
            var value = watch.object[watch.property];
/*          if ((value != null) && (value instanceof Node)) {
                var displayNode = self.displayNodes.get(value);

                var rectWidth = 120;
                var rectHeight = 20;
                var rectSpacing = 20;

                var label = document.createElementNS(SVG_NAMESPACE,"text");
                self.watchGroup.appendChild(label);
                label.appendChild(document.createTextNode(watch.property));

                var ascent = -label.getBBox().y;

                label.setAttribute("x",displayNode.x);
                label.setAttribute("y",displayNode.y + rectSpacing + ascent);
                label.style.textAnchor = "middle";
                label.style.fontFamily = "sans-serif";

                var border = 4;

                var bbox = label.getBBox();
                var bounds = document.createElementNS(SVG_NAMESPACE,"rect");
                bounds.setAttribute("stroke","red");
                bounds.setAttribute("fill","yellow");
                bounds.setAttribute("x",bbox.x-border);
                bounds.setAttribute("y",bbox.y-border);
                bounds.setAttribute("width",bbox.width+2*border);
                bounds.setAttribute("height",bbox.height+2*border);
                self.watchGroup.insertBefore(bounds,label);

                var arrow = document.createElementNS(SVG_NAMESPACE,"line");
                arrow.setAttribute("stroke","red");
                arrow.setAttribute("stroke-width","2");
                arrow.setAttribute("x1",displayNode.x);
                arrow.setAttribute("y1",displayNode.y + rectSpacing);
                arrow.setAttribute("x2",displayNode.x);
                arrow.setAttribute("y2",displayNode.y);
                self.watchGroup.appendChild(arrow);

                var marker = document.createElementNS(SVG_NAMESPACE,"path");
                marker.setAttribute("stroke","red");
                marker.setAttribute("stroke-width","1");
                marker.setAttribute("fill","red");
                marker.setAttribute("d","M 0 0 L 5 10 L -5 10");
                marker.setAttribute("transform","translate("+displayNode.x+","+displayNode.y+")");
                
                self.watchGroup.appendChild(marker);
            }
            else */if ((value != null) && (value instanceof Position)) {
                var node = value.node;
                var offset = value.offset;

                if (node.childNodes.length > 0) {
                    var after = false;

                    var x = null;
                    var y = null;

                    var markerWidth = 2;

                    if (offset == 0) {
                        var cur = self.displayNodes.get(node.childNodes[offset]);
                        x = cur.x - DISPLAY_NODE_WIDTH/2 - markerWidth/2;
                        y = cur.y;
                    }
                    else if (offset == node.childNodes.length) {
                        var cur = self.displayNodes.get(node.childNodes[offset-1]);
                        x = cur.x + DISPLAY_NODE_WIDTH/2 + markerWidth/2;
                        y = cur.y;
                    }
                    else {
                        var prev = self.displayNodes.get(node.childNodes[offset-1]);
                        var cur = self.displayNodes.get(node.childNodes[offset]);
                        y = cur.y;
                        x = prev.x/2 + cur.x/2;
                    }

                    var marker = document.createElementNS(SVG_NAMESPACE,"rect");
                    marker.setAttribute("x",x);
                    marker.setAttribute("y",y - DISPLAY_NODE_WIDTH/2);
                    marker.setAttribute("width",markerWidth);
                    marker.setAttribute("height",DISPLAY_NODE_WIDTH);
                    marker.setAttribute("stroke","blue");
                    marker.setAttribute("fill","blue");
                    self.watchGroup.appendChild(marker);
                }
            }
/*            else if ((value != null) && (value instanceof NodeSet)) {
                for (var id in value.members) {
                    var node = value.members[id];
                    var displayNode = self.displayNodes.get(node);

                    var rect = document.createElementNS(SVG_NAMESPACE,"rect");
                    rect.setAttribute("x",displayNode.x-DISPLAY_NODE_WIDTH);
                    rect.setAttribute("y",displayNode.y-DISPLAY_NODE_WIDTH);
                    rect.setAttribute("width",2*DISPLAY_NODE_WIDTH);
                    rect.setAttribute("height",2*DISPLAY_NODE_WIDTH);
                    rect.setAttribute("stroke","none");
                    rect.setAttribute("fill","blue");
                    rect.setAttribute("fill-opacity","0.1");
                    self.watchGroup.appendChild(rect);
                }
            }
*/
        }
    }

    function layoutDisplayNodes(self)
    {
        var rootDisp = self.displayNodes.get(self.domRoot);
        var sep = DISPLAY_NODE_WIDTH + DISPLAY_NODE_SPACING;

        var max = new Array();
        var baseX = 0;
        var baseY = DISPLAY_NODE_WIDTH/2 + DISPLAY_NODE_SPACING;

        recurse(rootDisp,0);

        self.treeWidth = 0;
        for (var i = 0; i < max.length; i++)
            self.treeWidth = Math.max(self.treeWidth,max[i]+sep);
        self.treeHeight = max.length * LEVEL_HEIGHT;

        function recurse(disp,level)
        {
            disp.y = baseY + level*LEVEL_HEIGHT;
            if (disp.firstChild == null) {
                if (max[level] == null)
                    max[level] = baseX;

                disp.x = max[level] + sep;
                max[level] = disp.x;
            }
            else {
                for (var child = disp.firstChild; child != null; child = child.nextSibling)
                    recurse(child,level+1);
                disp.x = disp.firstChild.x/2 + disp.lastChild.x/2;
                if ((max[level] != null) && (disp.x < max[level] + sep)) {
                    var difference = max[level] + sep - disp.x;
                    adjust(disp,difference,0,level);
                }
                max[level] = disp.x;
            }
        }

        function adjust(disp,relX,relY,level)
        {
            disp.x += relX;
            disp.y += relY;
            if ((max[level] == null) || (max[level] < disp.x))
                max[level] = disp.x;
            for (var child = disp.firstChild; child != null; child = child.nextSibling)
                adjust(child,relX,relY,level+1);
        }
    }

    function updateDisplayNodeSVGElements(self)
    {
        recurse(self.displayNodes.get(self.domRoot));

        function recurse(disp)
        {
            if ((disp.x == null) || (disp.y == null)) {
                for (var child = disp.firstChild; child != null; child = child.nextSibling)
                    recurse(child);
                return;
            }

            disp.svgNode.setAttribute("cx",disp.x);
            disp.svgNode.setAttribute("cy",disp.y);

            if (disp.depth == 1) {
                for (var i = 0; i < disp.levels; i++) {
                    var rect = document.createElementNS(SVG_NAMESPACE,"rect");
                    rect.setAttribute("x",disp.minXAtLevel[i]);
                    rect.setAttribute("y",disp.y + i*LEVEL_HEIGHT - LEVEL_HEIGHT*0.4);
                    rect.setAttribute("width",disp.maxXAtLevel[i] - disp.minXAtLevel[i]);
                    rect.setAttribute("height",LEVEL_HEIGHT*0.8);
                    rect.setAttribute("stroke","red");
                    rect.setAttribute("fill","none");
                    self.nodeGroup.appendChild(rect);
                }
            }

            if (disp.firstChild == null)
                return;

            disp.childrenHLine.setAttribute("x1",disp.firstChild.x);
            disp.childrenHLine.setAttribute("y1",disp.y + LEVEL_HEIGHT/2);

            disp.childrenHLine.setAttribute("x2",disp.lastChild.x);
            disp.childrenHLine.setAttribute("y2",disp.y + LEVEL_HEIGHT/2);

            disp.childrenVLine.setAttribute("x1",disp.x);
            disp.childrenVLine.setAttribute("y1",disp.y);
            disp.childrenVLine.setAttribute("x2",disp.x);
            disp.childrenVLine.setAttribute("y2",disp.y + LEVEL_HEIGHT/2);


            for (var child = disp.firstChild; child != null; child = child.nextSibling) {
                child.parentLink.setAttribute("x1",child.x);
                child.parentLink.setAttribute("y1",child.y);
                child.parentLink.setAttribute("x2",child.x);
                child.parentLink.setAttribute("y2",disp.y + LEVEL_HEIGHT/2);
                recurse(child);
            }
        }
    }

    function displayNodeSet(self,set)
    {
        var radius = DISPLAY_NODE_WIDTH/2;
        var dispRoot = self.displayNodes.get(self.domRoot);

        var include = new Array();
        var exclude = new Array();
        buildIncludeExclude(dispRoot);

        var bp = new BoundingPolygons(include,exclude);

        //    bp.showXYValues(self.nodeGroup);
        //    bp.showStates(self.nodeGroup);
        bp.showPolygons(self.backgroundGroup);
        return;

        function buildIncludeExclude(disp)
        {
            var haveChildInSet = false;
            for (var child = disp.firstChild; child != null; child = child.nextSibling) {
                buildIncludeExclude(child);
                if (set.contains(child.domNode))
                    haveChildInSet = true;
            }

            if (set.contains(disp.domNode) && haveChildInSet) {
                include.push(new BoundingPolygons.Rect(disp.x - radius,
                                                       disp.y - radius + LEVEL_HEIGHT/2,
                                                       disp.x + radius,
                                                       disp.y + radius + LEVEL_HEIGHT/2));
            }


            var rect = new BoundingPolygons.Rect(disp.x - radius,
                                                 disp.y - radius,
                                                 disp.x + radius,
                                                 disp.y + radius);

            if (set.contains(disp.domNode))
                include.push(rect);
            else
                exclude.push(rect);



            if ((disp.domNode.parentNode != null) && (disp.domNode.parentNode != document.body)) {
                if (set.contains(disp.domNode.parentNode)) {
                    if (set.contains(disp.domNode)) {
                        include.push(new BoundingPolygons.Rect(disp.x - radius,
                                                               disp.y - LEVEL_HEIGHT/2 - radius,
                                                               disp.x + radius,
                                                               disp.y - LEVEL_HEIGHT/2 + radius));
                    }
                }
            }


        }
    }

    function displayGroups(self)
    {
        for (var watchId in PropertyTracker.allTrackedProperties) {
            var watch = PropertyTracker.allTrackedProperties[watchId];
            var value = watch.object[watch.property];
            if ((value != null) && (value instanceof NodeSet)) {
                displayNodeSet(self,value);
            }
        }
    }

    function displayNodeLabels(self)
    {
        recurse(self.displayNodes.get(self.domRoot));

        function recurse(disp)
        {
            for (var child = disp.firstChild; child != null; child = child.nextSibling)
                recurse(child);

            var text = document.createElementNS(SVG_NAMESPACE,"text");
            text.setAttribute("x",disp.x);
            text.setAttribute("y",disp.y+4);
            text.setAttribute("text-anchor","middle");
            text.setAttribute("font-size","8pt");
            text.setAttribute("font-family","sans-serif");
            var simpleId = parseInt(disp.domNode._nodeId.replace(/^.*:/,""));
            text.appendChild(document.createTextNode(simpleId.toString(16)));
            self.nodeGroup.appendChild(text);
        }
    }

    function createDisplayNodes(self)
    {
        recurse(self.domRoot);

        function recurse(node)
        {
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
            var displayNode = new DisplayNode(node,self);
            self.displayNodes.put(node,displayNode);
            self.nodeGroup.appendChild(displayNode.svgNode);
            self.linkGroup.appendChild(displayNode.parentLink);
            self.linkGroup.appendChild(displayNode.childrenHLine);
            self.linkGroup.appendChild(displayNode.childrenVLine);
        }
    }

    // public
    function TreeView(domRoot)
    {
        Object.defineProperty(this,"self",{value: {}});
        var self = this.self;

        self.domRoot = domRoot;

        self.treeGroup = document.createElementNS(SVG_NAMESPACE,"g");
        self.backgroundGroup = document.createElementNS(SVG_NAMESPACE,"g");
        self.linkGroup = document.createElementNS(SVG_NAMESPACE,"g");
        self.nodeGroup = document.createElementNS(SVG_NAMESPACE,"g");
        self.watchGroup = document.createElementNS(SVG_NAMESPACE,"g");
        self.treeGroup.appendChild(self.backgroundGroup);
        self.treeGroup.appendChild(self.linkGroup);
        self.treeGroup.appendChild(self.nodeGroup);
        self.treeGroup.appendChild(self.watchGroup);
        self.treeWidth = null;
        self.treeHeight = null;
        self.displayNodes = new NodeMap();

        this.element = self.treeGroup;
        Object.freeze(this);
    }


    // public
    TreeView.prototype.getTreeWidth = function()
    {
        var self = this.self;
        return self.treeWidth;
    }

    // public
    TreeView.prototype.update = function()
    {
        var self = this.self;
        while (self.backgroundGroup.firstChild != null)
            self.backgroundGroup.removeChild(self.backgroundGroup.firstChild);
        while (self.linkGroup.firstChild != null)
            self.linkGroup.removeChild(self.linkGroup.firstChild);
        while (self.nodeGroup.firstChild != null)
            self.nodeGroup.removeChild(self.nodeGroup.firstChild);
        while (self.watchGroup.firstChild != null)
            self.watchGroup.removeChild(self.watchGroup.firstChild);
        self.displayNodes.clear();
        createDisplayNodes(self);
        layoutDisplayNodes(self);
        updateDisplayNodeSVGElements(self);
        displayNodeLabels(self);
        displayGroups(self);

        updateTrackedProperties(self);
    }

    window.TreeView = TreeView;

})();
