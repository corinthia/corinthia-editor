function EntryLens()
{
}

EntryLens.prototype.get = function(c)
{
    var li = DOM_createElement(document,"LI");
    var name = c.getAttribute("name");
    name = name.toUpperCase();
    var text = DOM_createTextNode(document,name);
    DOM_appendChild(li,text);
    li._source = c;
    c._target = li;
    return li;
};

EntryLens.prototype.put = function(a,c)
{
    var getResult = this.get(c);
    if (!compare(a,getResult))
        c.setAttribute("name",getNodeText(a));
}

EntryLens.prototype.create = function(a,cdoc)
{
    var entry = DOM_createElement(cdoc,"entry");
    entry.setAttribute("name",getNodeText(a));
    return entry;
}

EntryLens.prototype.isVisible = function(node)
{
    return (DOM_upperName(node) == "ENTRY");
};

function BookmarkLens()
{
    this.entryLens = new EntryLens();
}

BookmarkLens.prototype.get = function(c)
{
    var ul = DOM_createElement(document,"UL");
    ul._source = c;
    c._target = ul;
    for (var cchild = c.firstChild; cchild != null; cchild = cchild.nextSibling) {
        if (this.entryLens.isVisible(cchild))
            DOM_appendChild(ul,this.entryLens.get(cchild));
    }
    return ul;
}

BookmarkLens.prototype.put = function(a,c)
{
    return BDT_Container_put(a,c,this.entryLens);
}

function compare(node1,node2)
{
    return (PrettyPrinter.getHTML(node1) == PrettyPrinter.getHTML(node2));
}

function bdtSetup()
{
    var bmLens = new BookmarkLens();
    var result = new Object();
    result.concreteDocument = readXML("bookmarks.xml");;
    result.concrete = result.concreteDocument.documentElement;
    result.abstract = bmLens.get(result.concrete);;
    return result;
}

function bdtApply(bdt)
{
    var bmLens = new BookmarkLens();
    bmLens.put(bdt.abstract,bdt.concrete);
    var str = PrettyPrinter.getHTML(bdt.concrete);
    var newAbstract = bmLens.get(bdt.concrete);;
    str += "\nnew abstract matches? "+compare(bdt.abstract,newAbstract);
    return str;
}

function createListItem(name)
{
    var li = DOM_createElement(document,"LI");
    DOM_appendChild(li,DOM_createTextNode(document,name));
    return li;
}
