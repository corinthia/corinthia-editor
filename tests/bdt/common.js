function Entry_get(c)
{
    var li = DOM_createElement(document,"LI");
    var text = DOM_createTextNode(document,c.getAttribute("name"));
    DOM_appendChild(li,text);
    li._source = c;
    c._target = li;
    return li;
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

function Bookmarks_put(a,c)
{
    var moveList = new Array();

    for (var cchild = c.firstChild; cchild != null; cchild = cchild.nextSibling) {
        if (isVisibleNode(cchild)) {
            var oldNext = findVisibleNodeForwards(cchild.nextSibling);
            var oldPrev = findVisibleNodeBackwards(cchild.previousSibling);
            var newNext = null;
            if (cchild._target.nextSibling != null)
                newNext = cchild._target.nextSibling._source;
            var newPrev = null;
            if (cchild._target.previousSibling != null)
                newPrev = cchild._target.previousSibling._source;

            if (oldNext != newNext)
                moveList.push({ node: cchild, prev: newPrev, next: newNext });
        }
    }

    for (var i = 0; i < moveList.length; i++) {
        moveList[i].order = -DOM_nodeOffset(moveList[i].node._target,a);
    }

    moveList.sort(function (a,b) { return a.order - b.order; });

    for (var i = 0; i < moveList.length; i++) {
        if (findVisibleNodeForwards(moveList[i].node.nextSibling) !=
            findVisibleNodeForwards(moveList[i].next)) {
            DOM_insertBefore(moveList[i].node.parentNode,
                             moveList[i].node,
                             moveList[i].next);
        }
    }
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
