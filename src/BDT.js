var BDT_Container_put;

(function() {

    var deleteOldConcreteNodes = trace(function deleteOldConcreteNodes(a,c,lens)
    {
        var present = new NodeSet();
        for (var achild = a.firstChild; achild != null; achild = achild.nextSibling) {
            if (achild._source != null)
                present.add(achild._source);
        }

        var next;
        for (var cchild = c.firstChild; cchild != null; cchild = next) {
            next = cchild.nextSibling;
            if (lens.isVisible(cchild) && !present.contains(cchild))
                DOM_deleteNode(cchild);
        }
    });

    var reconstructList = trace(function reconstructList(a,c,lens)
    {
        var newList = new Array();
        var cchild = c.firstChild;
        while ((cchild != null) && !lens.isVisible(cchild)) {
            newList.push(cchild);
            cchild = cchild.nextSibling;
        }

        for (var achild = a.firstChild; achild != null; achild = achild.nextSibling) {
            if (achild._source != null) {
                cchild = achild._source;
                do {
                    newList.push(cchild);
                    cchild = cchild.nextSibling;
                }
                while ((cchild != null) && !lens.isVisible(cchild));
            }
        }

        for (var i = 0; i < newList.length; i++)
            DOM_appendChild(c,newList[i]);
    });

    var putChildren = trace(function putChildren(a,c,lens)
    {
        var before = null;
        for (var achild = a.lastChild; achild != null; achild = achild.previousSibling) {
            if (achild._source != null) {
                if (lens.put == null)
                    throw new Error(nodeString(achild)+": "+lens.constructor.name+
                                    " has no put method");
                lens.put(achild,achild._source);
                before = achild._source;
            }
            else {
                if (lens.create == null)
                    throw new Error(nodeString(achild)+": "+lens.constructor.name+
                                    " has no create method");
                var element = lens.create(achild,c.ownerDocument);
                if (element != null) {
                    DOM_insertBefore(c,element,before);
                    before = element;
                }
            }
        }
    });

    BDT_Container_put = trace(function Container_put(a,c,lens)
    {
        deleteOldConcreteNodes(a,c,lens);
        reconstructList(a,c,lens);
        putChildren(a,c,lens);
    });

})();
