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

function Bookmarks_get(c,lens)
{
    var ul = DOM_createElement(document,"UL");
    ul._source = c;
    c._target = ul;
    for (var cchild = c.firstChild; cchild != null; cchild = cchild.nextSibling) {
        if (lens.isVisible(cchild))
            DOM_appendChild(ul,lens.get(cchild));
    }
    return ul;
}

function compare(node1,node2)
{
    return (PrettyPrinter.getHTML(node1) == PrettyPrinter.getHTML(node2));
}

function bdtSetup()
{
    var lens = new EntryLens();
    var result = new Object();
    result.concreteDocument = readXML("bookmarks.xml");;
    result.concrete = result.concreteDocument.documentElement;
    result.abstract = Bookmarks_get(result.concrete,lens);;
    return result;
}

function bdtApply(bdt)
{
    var lens = new EntryLens();
    BDT_Container_put(bdt.abstract,bdt.concrete,lens);
    var str = PrettyPrinter.getHTML(bdt.concrete);
    var newAbstract = Bookmarks_get(bdt.concrete,lens);;
    str += "\nnew abstract matches? "+compare(bdt.abstract,newAbstract);
    return str;
}

function createListItem(name)
{
    var li = DOM_createElement(document,"LI");
    DOM_appendChild(li,DOM_createTextNode(document,name));
    return li;
}
