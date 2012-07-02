function Entry_get(c)
{
    var li = DOM_createElement(document,"LI");
    var name = c.getAttribute("name");
    name = name.toUpperCase();
    var text = DOM_createTextNode(document,name);
    DOM_appendChild(li,text);
    li._source = c;
    c._target = li;
    return li;
}

function Entry_create(a,cdoc)
{
    var entry = DOM_createElement(cdoc,"entry");
    entry.setAttribute("name",getNodeText(a));
    return entry;
}

function Entry_put(a,c)
{
    var getResult = Entry_get(c);
    if (!compare(a,getResult))
        c.setAttribute("name",getNodeText(a));
}

function Bookmarks_get(c)
{
    var ul = DOM_createElement(document,"UL");
    ul._source = c;
    c._target = ul;
    for (var cchild = c.firstChild; cchild != null; cchild = cchild.nextSibling) {
        if (isVisibleNode(cchild))
            DOM_appendChild(ul,Entry_get(cchild));
    }
    return ul;
}

function isVisibleNode(node)
{
    return (DOM_upperName(node) == "ENTRY");
}

function findVisibleNodeForwards(node)
{
    while ((node != null) && !isVisibleNode(node))
        node = node.nextSibling;
    return node;
}

function findVisibleNodeBackwards(node)
{
    while ((node != null) && !isVisibleNode(node))
        node = node.previousSibling;
    return node;
}

function entry(node)
{
    if (node == null)
        return null;
    else if (node.nodeName == "entry")
        return JSON.stringify(node.getAttribute("name"));
    else
        return nodeString(node);
}

function Bookmarks_put(a,c)
{
    var present = new NodeSet();
    for (var achild = a.firstChild; achild != null; achild = achild.nextSibling) {
        if (achild._source != null)
            present.add(achild._source);
    }

    var next;
    for (var cchild = c.firstChild; cchild != null; cchild = next) {
        next = cchild.nextSibling;
        if (isVisibleNode(cchild) && !present.contains(cchild))
            DOM_deleteNode(cchild);
    }

    var newList = new Array();
    for (var cchild = c.firstChild; (cchild != null) && !isVisibleNode(cchild);
         cchild = cchild.nextSibling) {
        newList.push(cchild);
    }

    for (var achild = a.firstChild; achild != null; achild = achild.nextSibling) {
        if (achild._source != null) {
            var cchild = achild._source;
            newList.push(cchild);
            cchild = cchild.nextSibling;
            while ((cchild != null) && !isVisibleNode(cchild)) {
                newList.push(cchild);
                cchild = cchild.nextSibling;
            }
        }
    }

    for (var i = 0; i < newList.length; i++)
        DOM_appendChild(c,newList[i]);


    var before = null;
    for (var achild = a.lastChild; achild != null; achild = achild.previousSibling) {
        if (achild._source != null) {
            Entry_put(achild,achild._source);
            before = achild._source;
        }
        else {
            var element = Entry_create(achild,c.ownerDocument);
            DOM_insertBefore(c,element,before);
            before = element;
        }
    }


//    for (var achild = a.firstChild; achild != null; achild = achild.nextSibling) {
//        Entry_put(achild,achild._source);
//    }
}

function compare(node1,node2)
{
    return (PrettyPrinter.getHTML(node1) == PrettyPrinter.getHTML(node2));
}

function bdtSetup()
{
    var result = new Object();
    result.concreteDocument = readXML("bookmarks.xml");;
    result.concrete = result.concreteDocument.documentElement;
    result.abstract = Bookmarks_get(result.concrete);;
    return result;
}

function bdtApply(bdt)
{
    Bookmarks_put(bdt.abstract,bdt.concrete);
    var str = PrettyPrinter.getHTML(bdt.concrete);
    var newAbstract = Bookmarks_get(bdt.concrete);;
    str += "\nnew abstract matches? "+compare(bdt.abstract,newAbstract);
    return str;
}

function createListItem(name)
{
    var li = DOM_createElement(document,"LI");
    DOM_appendChild(li,DOM_createTextNode(document,name));
    return li;
}
