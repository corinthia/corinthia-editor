// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function() {
    function Point(x,y)
    {
        this.x = x;
        this.y = y;
    }

    Point.prototype.toString = function()
    {
        return "("+this.x+","+this.y+")";
    }

    function Polygon()
    {
        this.points = new Array();
    }

    Polygon.prototype.addPoint = function(p)
    {
        this.points.push(p);
    }

    Polygon.prototype.toString = function(p)
    {
        return this.points.join("-");
    }

    function Grid(nrows,ncols)
    {
        this.nrows = nrows;
        this.ncols = ncols;
        this.contents = new Array(nrows*ncols);
    }

    Grid.prototype.get = function(row,col)
    {
        if ((row < 0) || (row >= this.nrows) || (col < 0) || (col >= this.ncols))
            return null;
        return this.contents[row*this.ncols + col];
    }

    Grid.prototype.set = function(row,col,value)
    {
        if ((row < 0) || (row >= this.nrows) || (col < 0) || (col >= this.ncols))
            throw new Error("Attempt to set value at "+row+","+col);
        this.contents[row*this.ncols + col] = value;
    }

    function GridPoint(grid,row,col)
    {
        this.grid = grid;
        this.row = row;
        this.col = col;
        this.topLeft = grid.get(row-1,col-1);
        this.topRight = grid.get(row-1,col);
        this.botLeft = grid.get(row,col-1);
        this.botRight = grid.get(row,col);
    }

    GridPoint.prototype.toString = function()
    {
        return "("+this.row+","+this.col+")";
    }

    // Convex corner in which the bottom and right blocks are *not* part of the shape
    GridPoint.prototype.hasConvexBottomRightCorner = function()
    {
        return ((this.topLeft != null) &&
                (this.topLeft != this.topRight) &&
                (this.topLeft != this.botLeft));
    }

    // Convex corner in which the bottom and left blocks are *not* part of the shape
    GridPoint.prototype.hasConvexBottomLeftCorner = function()
    {
        return ((this.topRight != null) &&
                (this.topRight != this.topLeft) &&
                (this.topRight != this.botRight));
    }

    // Convex corner in which the top and right blocks are *not* part of the shape
    GridPoint.prototype.hasConvexTopRightCorner = function()
    {
        return ((this.botLeft != null) &&
                (this.botLeft != this.botRight) &&
                (this.botLeft != this.topLeft));
    }

    // Convex corner in which the top and left blocks are *not* part of the shape
    GridPoint.prototype.hasConvexTopLeftCorner = function()
    {
        return ((this.botRight != null) &&
                (this.botRight != this.botLeft) &&
                (this.botRight != this.topRight));
    }

    // Concave corner with blocks at top and left *are* part of the shape
    GridPoint.prototype.hasConcaveTopLeftCorner = function()
    {
        return ((this.topLeft != null) &&
                (this.topLeft == this.topRight) &&
                (this.topLeft == this.botLeft) &&
                (this.topLeft != this.botRight));
    }

    // Concave corner with blocks at top and right *are* part of the shape
    GridPoint.prototype.hasConcaveTopRightCorner = function()
    {
        return ((this.topRight != null) &&
                (this.topRight == this.topLeft) &&
                (this.topRight == this.botRight) &&
                (this.topRight != this.botLeft));
    }

    // Concave corner with blocks at bottom and left *are* part of the shape
    GridPoint.prototype.hasConcaveBottomLeftCorner = function()
    {
        return ((this.botLeft != null) &&
                (this.botLeft == this.botRight) &&
                (this.botLeft == this.topLeft) &&
                (this.botLeft != this.topRight));
    }

    // Concave corner with blocks at bottom and right *are* part of the shape
    GridPoint.prototype.hasConcaveBottomRightCorner = function()
    {
        return ((this.botRight != null) &&
                (this.botRight == this.botLeft) &&
                (this.botRight == this.topRight) &&
                (this.botRight != this.topLeft));
    }

    function findXYValues(self)
    {
        self.xmap = new Object();
        self.ymap = new Object();
        for (var i = 0; i < self.include.length; i++) {
            self.xmap[self.include[i].left] = true;
            self.xmap[self.include[i].right] = true;
            self.ymap[self.include[i].top] = true;
            self.ymap[self.include[i].bottom] = true;
        }
        
        for (var i = 0; i < self.exclude.length; i++) {
            self.xmap[self.exclude[i].left] = true;
            self.xmap[self.exclude[i].right] = true;
            self.ymap[self.exclude[i].top] = true;
            self.ymap[self.exclude[i].bottom] = true;
        }

        self.xvalues = numberMapToArray(self.xmap);
        self.yvalues = numberMapToArray(self.ymap);

        self.ncols = self.xvalues.length;
        self.nrows = self.yvalues.length;
        self.xtocol = reverseRangeMapping(self.xvalues);
        self.ytorow = reverseRangeMapping(self.yvalues);

        return;

        function numberMapToArray(map)
        {
            var array = new Array();
            for (var name in map)
                array.push(parseFloat(name));
            array.sort(function(a,b) { return a - b; });
            return array;
        }

        function reverseRangeMapping(values)
        {
            var mapping = new Array();
            var v = 0;
            for (var i = 0; i < values.length-1; i++) {
                while (v < values[i+1]) {
                    mapping[v++] = i;
                }
            }
            return mapping;
        }
    }

    function setInitialGridStates(self)
    {
        for (var i = 0; i < self.include.length; i++)
            setGridState(self.include[i],"lime");
        for (var i = 0; i < self.exclude.length; i++)
            setGridState(self.exclude[i],"blue");

        function setGridState(rect,state)
        {
            var startY = Math.floor(rect.top);
            var startX = Math.floor(rect.left);
            for (var row = self.ytorow[startY]; self.yvalues[row] < rect.bottom; row++) {
                for (var col = self.xtocol[startX]; self.xvalues[col] < rect.right; col++) {
                    self.grid.set(row,col,state);
                }
            }
        }
    }

    function extendStates(self)
    {
        var changed;
        do {
            changed = false;

            for (var col = 0; col < self.ncols; col++) {
                var start = null;
                var state = null;
                for (var row = 0; row < self.nrows; row++) {
                    if (self.grid.get(row,col) != null) {
                        if (self.grid.get(row,col) == state) {
                            for (var i = start; i < row; i++) {
                                self.grid.set(i,col,state);
                                changed = true;
                            }
                        }

                        start = row+1;
                        state = self.grid.get(row,col);
                    }
                }
            }

            for (var row = 0; row < self.nrows; row++) {
                var start = null;
                var state = null;
                for (var col = 0; col < self.ncols; col++) {
                    if (self.grid.get(row,col) != null) {
                        if (self.grid.get(row,col) == state) {
                            for (var i = start; i < col; i++) {
                                self.grid.set(row,i,state);
                                changed = true;
                            }
                        }

                        start = col+1;
                        state = self.grid.get(row,col);
                    }
                }
            }

        }
        while (changed);
    }

    function findPolygons(self)
    {
        var DIRECTION_UP = 1;
        var DIRECTION_DOWN = 2;
        var DIRECTION_LEFT = 3;
        var DIRECTION_RIGHT = 4;

        var xadjust = [0,
                       -self.surround,
                       self.surround,
                       0,
                       0];

        var yadjust = [0,
                       0,
                       0,
                       self.surround,
                       -self.surround];

        var cornersDone = new Object();

        // Each time we find a corner that we have not yet processed, we start at that point
        // and traverse the shape clockwise, collecting all its corners until we get back to
        // the start.

        for (var row = 0; row < self.nrows; row++) {
            for (var col = 0; col < self.ncols; col++) {
                var point = new GridPoint(self.grid,row,col);

                if (point.hasConvexTopLeftCorner() && !cornersDone[point+"ConvexTopLeft"])
                    followPerimiter(point,point.botRight,DIRECTION_RIGHT,
                                    -self.surround,-self.surround);
                if (point.hasConvexTopRightCorner() && !cornersDone[point+"ConvexTopRight"])
                    throw new Error("Encountered ConvexTopRight at "+point);
                if (point.hasConvexBottomRightCorner() && !cornersDone[point+"ConvexBottomRight"])
                    throw new Error("Encountered ConvexBottomRight at "+point);
                if (point.hasConvexBottomLeftCorner() && !cornersDone[point+"ConvexBottomLeft"])
                    throw new Error("Encountered ConvexBottomLeft at "+point);

                if (point.hasConcaveTopLeftCorner() && !cornersDone[point+"ConcaveTopLeft"])
                    followPerimiter(point,point.topLeft,DIRECTION_DOWN,self.surround,self.surround);
                if (point.hasConcaveTopRightCorner() && !cornersDone[point+"ConcaveTopRight"])
                    throw new Error("Encountered ConcaveTopRight at "+point);
                if (point.hasConcaveBottomLeftCorner() && !cornersDone[point+"ConcaveBottomLeft"])
                    throw new Error("Encountered ConcaveBottomLeft at "+point);
                if (point.hasConcaveBottomRightCorner() && !cornersDone[point+"ConcaveBottomRight"])
                    throw new Error("Encountered ConcaveBottomRight at "+point);

            }
        }

        return;

        function followPerimiter(start,state,direction,xadj0,yadj0)
        {
            var polygon = new Polygon();
            polygon.state = state;
            polygon.addPoint(new Point(self.xvalues[start.col]+xadj0,self.yvalues[start.row]+yadj0));
            var current = start;
            var iterations = 0;
            while (true) {
                // Move in the current direction
                switch (direction) {
                case DIRECTION_RIGHT:
                    current = new GridPoint(current.grid,current.row,current.col+1);
                    break;
                case DIRECTION_DOWN:
                    current = new GridPoint(current.grid,current.row+1,current.col);
                    break;
                case DIRECTION_LEFT:
                    current = new GridPoint(current.grid,current.row,current.col-1);
                    break;
                case DIRECTION_UP:
                    current = new GridPoint(current.grid,current.row-1,current.col);
                    break;
                }

                // Are we back at the start?
                if ((current.row == start.row) && (current.col == start.col))
                    break;

                var oldDirection = direction;

                // Determine whether we've reached a corner, and if so, change direction
                switch (direction) {
                case DIRECTION_RIGHT:
                    if (current.hasConvexTopRightCorner()) {
                        cornersDone[current+"ConvexTopRight"] = true;
                        direction = DIRECTION_DOWN;
                    }
                    else if (current.hasConcaveBottomRightCorner()) {
                        cornersDone[current+"ConcaveBottomRight"] = true;
                        direction = DIRECTION_UP;
                    }
                    break;
                case DIRECTION_DOWN:
                    if (current.hasConvexBottomRightCorner()) {
                        cornersDone[current+"ConvexBottomRight"] = true;
                        direction = DIRECTION_LEFT;
                    }
                    else if (current.hasConcaveBottomLeftCorner()) {
                        cornersDone[current+"ConcaveBottomLeft"] = true;
                        direction = DIRECTION_RIGHT;
                    }
                    break;
                case DIRECTION_LEFT:
                    if (current.hasConvexBottomLeftCorner()) {
                        cornersDone[current+"ConvexBottomLeft"] = true;
                        direction = DIRECTION_UP;
                    }
                    else if (current.hasConcaveTopLeftCorner()) {
                        cornersDone[current+"ConcaveTopLeft"] = true;
                        direction = DIRECTION_DOWN;
                    }
                    break;
                case DIRECTION_UP:
                    if (current.hasConvexTopLeftCorner()) {
                        cornersDone[current+"ConvexTopLeft"] = true;
                        direction = DIRECTION_RIGHT;
                    }
                    else if (current.hasConcaveTopRightCorner()) {
                        cornersDone[current+"ConcaveTopRight"] = true;
                        direction = DIRECTION_LEFT;
                    }
                    break;
                }

                if (direction != oldDirection) {
                    var xadj;
                    var yadj;
                    if (xadjust[direction] != 0)
                        xadj = xadjust[direction];
                    else
                        xadj = xadjust[oldDirection];
                    if (yadjust[direction] != 0)
                        yadj = yadjust[direction];
                    else
                        yadj = yadjust[oldDirection];

                    polygon.addPoint(new Point(self.xvalues[current.col] + xadj,
                                               self.yvalues[current.row] + yadj));
                }
            }

            if (state == "lime")
                self.polygons.push(polygon);
        }
    }

    // public
    function BoundingPolygons(include,exclude)
    {
        Object.defineProperty(this,"self",{value: {}});
        var self = this.self;

        self.include = include;
        self.exclude = exclude;
        self.surround = 6;

        findXYValues(self);

        self.grid = new Grid(self.nrows,self.ncols);
        self.polygons = new Array();
        setInitialGridStates(self);
        extendStates(self);
        findPolygons(self);
    }

    // public
    BoundingPolygons.prototype.showXYValues = function(svgParent)
    {
        var self = this.self;
        var firstX = self.xvalues[0];
        var firstY = self.yvalues[0];
        var lastX = self.xvalues[self.xvalues.length-1];
        var lastY = self.yvalues[self.yvalues.length-1];
        for (var row = 0; row < self.nrows; row++) {
            svgParent.appendChild(makeLine(firstX,self.yvalues[row],lastX,self.yvalues[row],"red"));

            var text = document.createElementNS(SVG_NAMESPACE,"text");
            text.setAttribute("text-anchor","end");
            text.setAttribute("font-family","sans-serif");
            text.setAttribute("font-size","10");
            text.setAttribute("x",firstX-6);
            text.setAttribute("y",self.yvalues[row]+3);
            text.appendChild(document.createTextNode(row));
            svgParent.appendChild(text);
        }
        for (var col = 0; col < self.ncols; col++) {
            svgParent.appendChild(makeLine(self.xvalues[col],firstY,self.xvalues[col],lastY,"red"));

            var text = document.createElementNS(SVG_NAMESPACE,"text");
            text.setAttribute("text-anchor","middle");
            text.setAttribute("font-family","sans-serif");
            text.setAttribute("font-size","10");
            text.setAttribute("x",self.xvalues[col]);
            text.setAttribute("y",firstY-6);
            text.appendChild(document.createTextNode(col));
            svgParent.appendChild(text);
        }

        function makeLine(x1,y1,x2,y2,color)
        {
            var line = document.createElementNS(SVG_NAMESPACE,"line");
            line.setAttribute("x1",x1);
            line.setAttribute("y1",y1);
            line.setAttribute("x2",x2);
            line.setAttribute("y2",y2);
            line.setAttribute("stroke",color);
            return line;
        }
    }

    // public
    BoundingPolygons.prototype.showStates = function(svgParent)
    {
        var self = this.self;
        for (var row = 0; row < self.nrows-1; row++) {
            for (var col = 0; col < self.ncols-1; col++) {
                var state = self.grid.get(row,col);
                if (state != null) {

                    var rect = document.createElementNS(SVG_NAMESPACE,"rect");
                    rect.setAttribute("x",self.xvalues[col]);
                    rect.setAttribute("y",self.yvalues[row]);
                    rect.setAttribute("width",self.xvalues[col+1] - self.xvalues[col]);
                    rect.setAttribute("height",self.yvalues[row+1] - self.yvalues[row]);
                    rect.setAttribute("stroke","black");
                    rect.setAttribute("fill",state);
                    rect.setAttribute("fill-opacity","0.5");
                    svgParent.appendChild(rect);
                }
            }
        }
    }

    // public
    BoundingPolygons.prototype.showPolygons = function(svgParent)
    {
        var self = this.self;
        for (var i = 0; i < self.polygons.length; i++) {
            var polygon = self.polygons[i];
            var path = document.createElementNS(SVG_NAMESPACE,"path");
            var steps = new Array();
            steps.push("M "+polygon.points[0].x+" "+polygon.points[0].y);
            for (var p = 1; p < polygon.points.length; p++) {
                steps.push("L "+polygon.points[p].x+" "+polygon.points[p].y);
            }
            steps.push("Z");
            path.setAttribute("d",steps.join(" "));
            path.setAttribute("stroke","none");
            path.setAttribute("fill","#E8F0F0");
            svgParent.appendChild(path);
        }
    }

    // public
    BoundingPolygons.Rect = function(left,top,right,bottom)
    {
        this.left = left;
        this.top = top;
        this.right = right;
        this.bottom = bottom;
    }

    // public
    BoundingPolygons.Rect.prototype.toString = function()
    {
        return "("+this.left+","+this.top+") - ("+this.right+","+this.bottom+")";
    }

    window.BoundingPolygons = BoundingPolygons;

})();
