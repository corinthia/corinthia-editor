function Structure()
{
    this.outline = null;
}

Structure.prototype.numberHeadings = function()
{
    var sectionNumbers = [0,0,0,0,0,0];
    for (var child = document.body.firstChild; child != null; child = child.nextSibling) {
        if (isHeadingElement(child)) {
            var level = parseInt(child.nodeName.slice(1))-1;
            sectionNumbers[level]++;
            for (var i = level+1; i < 6; i++)
                sectionNumbers[i] = 0;
            var str = "";
            for (var i = 0; i <= level; i++) {
                if (str == "")
                    str += sectionNumbers[i];
                else
                    str += "."+sectionNumbers[i];
            }
            var text = document.createTextNode(str+" ");
            var span = document.createElement("SPAN");
            span.setAttribute("class","uxwrite.headingnumber");
            span.appendChild(text);
            child.insertBefore(span,child.firstChild);
        }
    }
}

Structure.prototype.examineDocument = function()
{
//    this.numberHeadings();
}

structure = new Structure();
