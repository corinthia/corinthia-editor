// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function() {

    function mouseDown(self,event)
    {
        self.element.viewportElement.addEventListener("mousemove",self.mouseMoveListener,false);
        self.element.viewportElement.addEventListener("mouseup",self.mouseUpListener,false);
    }

    function mouseMove(self,event)
    {
        var proportion = (event.clientX - self.x)/self.width;

        proportion = Math.max(proportion,0.0);
        proportion = Math.min(proportion,1.0);

        var oldValue = self.value;
        self.value = Math.floor(self.min + proportion*(self.max - self.min));
        updateThumbPosition(self);

        if ((self.value != oldValue) && (self.this.onValueChanged != null))
            self.this.onValueChanged(self.value);

    }

    function mouseUp(self,event)
    {
        self.element.viewportElement.removeEventListener("mousemove",self.mouseMoveListener,false);
        self.element.viewportElement.removeEventListener("mouseup",self.mouseUpListener,false);
    }

    function clampValue(self)
    {
        if (self.value < self.min)
            self.value = self.min;
        else if (self.value > self.max)
            self.value = self.max;
    }

    function updateThumbPosition(self)
    {
        if ((self.x == null) || (self.y == null))
            return;
        self.thumb.setAttribute("width",self.thumbWidth);
        self.thumb.setAttribute("height",self.thumbHeight);
        var proportion = (self.value/(self.max-self.min));
        self.thumb.setAttribute("x",self.x + self.width*proportion - self.thumbWidth/2);
        self.thumb.setAttribute("y",self.y);
        self.text.firstChild.nodeValue = "Step "+self.value+" of "+self.max;
    }

    function getValue()
    {
        var self = this.self;
        return self.value;
    }

    function setValue(value)
    {
        var self = this.self;
        if (self.value != value) {
            self.value = value;
            clampValue(self);
            updateThumbPosition(self);
        }
    }

    // public
    function Slider()
    {
        Object.defineProperty(this,"self",{value: {}});
        var self = this.self;
        self.element = DOM.createElementNS(document,SVG_NAMESPACE,"g");
        self.bar = DOM.createElementNS(document,SVG_NAMESPACE,"rect");
        self.thumb = DOM.createElementNS(document,SVG_NAMESPACE,"rect");
        self.text = DOM.createElementNS(document,SVG_NAMESPACE,"text");
        DOM.appendChild(self.text,DOM.createTextNode(document,""));
        DOM.appendChild(self.element,self.bar);
        DOM.appendChild(self.element,self.thumb);
        DOM.appendChild(self.element,self.text);

        self.barHeight = 6;
        self.thumbWidth = 20;
        self.thumbHeight = 20;

        self.bar.setAttribute("stroke","black");
        self.bar.setAttribute("stroke-width","1");
        self.bar.setAttribute("fill","#F0F0F0");
        self.bar.setAttribute("rx","3");
        self.bar.setAttribute("ry","3");
        self.thumb.setAttribute("stroke","black");
        self.thumb.setAttribute("stroke-width","1");
        self.thumb.setAttribute("fill","#808080");
        self.thumb.setAttribute("fill-opacity","0.75");
        self.thumb.setAttribute("rx","4");
        self.thumb.setAttribute("ry","4");
        self.text.style.textAnchor = "middle";
        self.text.style.fontFamily = "sans-serif";

        self.min = 0;
        self.max = 50;
        self.value = 10;

        var slider = self;
        self.mouseDownListener = function(event) { mouseDown(self,event); }
        self.mouseMoveListener = function(event) { mouseMove(self,event); }
        self.mouseUpListener = function(event) { mouseUp(self,event); }
        self.thumb.onmousedown = self.mouseDownListener;

        self.x = null;
        self.y = null;
        self.width = null;
        self.height = null;

        self.this = this;
        this.onValueChanged = null;

        Object.defineProperty(this,"element",{ value: self.element, writable: false });
        Object.defineProperty(this,"value",{ get: getValue, set: setValue });
        Object.preventExtensions(this);
    }

    // public
    Slider.prototype.setRange = function(min,max)
    {
        var self = this.self;
        self.min = min;
        self.max = max;
        clampValue(self);
        updateThumbPosition(self);
    }

    // public
    Slider.prototype.setPosition = function(x,y,width,height)
    {
        var self = this.self;
        self.x = x;
        self.y = y;
        self.width = width;
        self.height = height;

        self.bar.setAttribute("x",self.x);
        self.bar.setAttribute("y",self.y + self.thumbHeight/2 - self.barHeight/2);
        self.bar.setAttribute("width",width);
        self.bar.setAttribute("height",self.barHeight);

        self.text.setAttribute("x",self.x + width/2);
        self.text.setAttribute("y",self.y + self.thumbHeight + 16);
        self.text.setAttribute("width","100%");
        self.text.setAttribute("height",20);

        updateThumbPosition(self);
    }

    window.Slider = Slider;

})();
