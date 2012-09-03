var WordDocument_get;
var WordDocument_put;

(function() {

    var wordSourceById = new Object();
    var nextWordId = 0;

    var addSourceMapping = trace(function _addSourceMapping(abs,con)
    {
        var id = "word"+nextWordId;
        wordSourceById[id] = con;
        DOM_setAttribute(abs,"id",id);
        nextWordId++;
    });

    var lookupSourceMapping = trace(function _lookupSourceMapping(abs)
    {
        if (abs.nodeType != Node.ELEMENT_NODE)
            return null;
        var id = DOM_getAttribute(abs,"id");
        if (id == null)
            return id;
        else
            return wordSourceById[id];
    });

    var WordR_get = trace(function _WordR_get(con)
    {
        var abs = DOM_createElement(document,"SPAN");
        addSourceMapping(abs,con);

        if (con._child_rPr != null) {
            var cssProperties = new Object();
            WordRPR_toCSS(cssProperties,con._child_rPr);
            DOM_setStyleProperties(abs,cssProperties);

            if (con._child_rPr._child_rStyle != null) {
                var val = DOM_getAttributeNS(con._child_rPr._child_rStyle,WORD_NAMESPACE,"val");
                if (val != null)
                    DOM_setAttribute(abs,"class",val);
            }
        }

        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child._is_t)
                DOM_appendChild(abs,DOM_createTextNode(document,getNodeText(child)));
        }
        return abs;
    });

    var WordR_put = trace(function _WordR_put(abs,con)
    {
        var oldText = getNodeText(con);
        var newText = getNodeText(abs);
        if (oldText != newText) {
            var next;
            for (var child = con.firstChild; child != null; child = next) {
                next = child.nextSibling;
                if (child._is_t)
                    DOM_deleteNode(child);
            }

            var t = DOM_createElementNS(con.ownerDocument,WORD_NAMESPACE,WORD_PREFIX+"t");
            var str = getNodeText(abs);
            if (str.trim() != str)
                DOM_setAttributeNS(t,XML_NAMESPACE,"xml:space","preserve");
            DOM_appendChild(t,DOM_createTextNode(con.ownerDocument,str));
            DOM_appendChild(con,t);
        }

        var rPr = con._child_rPr;
        if (rPr == null) {
            rPr = DOM_createElementNS(con.ownerDocument,WORD_NAMESPACE,WORD_PREFIX+"rPr");
            DOM_insertBefore(con,rPr,con.firstChild);
        }
        WordRPR_updateFromCSS(rPr,DOM_getStyleProperties(abs));
        if (rPr.firstChild == null)
            DOM_deleteNode(rPr);
    });

    var WordR_create = trace(function _WordR_create(abs,doc)
    {
        var con = DOM_createElementNS(doc,WORD_NAMESPACE,WORD_PREFIX+"r");
        WordR_put(abs,con);
        return con;
    });

    var PContentChild_isVisible = trace(function _PContentChild_isVisible(con)
    {
        return con._is_r;
    });

    var PContentChild_get = trace(function _PContentChild_get(con)
    {
        if (con._is_r)
            return WordR_get(con);
        else
            return null;
    });

    var PContentChild_put = trace(function _PContentChild_put(abs,con)
    {
        if (con._is_r)
            WordR_put(abs,con);
    });

    var PContentChild_create = trace(function _PContentChild_create(abs,doc)
    {
        if (DOM_upperName(abs) == "SPAN")
            return WordR_create(abs,doc);
        else
            return null;
    });

    var PContentChildLens = {
        isVisible: PContentChild_isVisible,
        put: PContentChild_put,
        create: PContentChild_create,
        getSource: lookupSourceMapping,
    };

    var WordP_get = trace(function _WordP_get(con)
    {
        debug("WordP_get: con = "+nodeString(con));
        var abs = DOM_createElement(document,"P");
        addSourceMapping(abs,con);

        if (con._child_pPr != null) {
            var cssProperties = new Object();
            WordPPR_toCSS(cssProperties,con._child_pPr);
            DOM_setStyleProperties(abs,cssProperties);

            if (con._child_pPr._child_pStyle != null) {
                var val = DOM_getAttributeNS(con._child_pPr._child_pStyle,WORD_NAMESPACE,"val");
                if (val != null)
                    DOM_setAttribute(abs,"class",val);
            }
        }

        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            var childAbs = PContentChild_get(child);
            if (childAbs != null)
                DOM_appendChild(abs,childAbs);
        }

        return abs;
    });

    var WordP_put = trace(function _WordP_put(abs,con)
    {
//        debug("WordP_put: abs = "+nodeString(abs)+", con = "+nodeString(con));
        debug("WordP_put");
        debug("    abs = "+nodeString(abs)+" "+JSON.stringify(getNodeText(abs)));
        debug("    con = "+nodeString(con)+" "+JSON.stringify(getNodeText(con)));
        BDT_Container_put(abs,con,PContentChildLens);
    });

    var WordP_create = trace(function _WordP_create(abs,doc)
    {
        var p = DOM_createElementNS(doc,WORD_NAMESPACE,WORD_PREFIX+"p");

        var normalised = normaliseParagraph(abs);
        for (var child = normalised.firstChild; child != null; child = child.nextSibling) {
            var childAbs = PContentChild_create(child,doc);
            if (childAbs != null)
                DOM_appendChild(p,childAbs);
        }

        return p;
    });

    var WordTc_get = trace(function _WordTc_get(con)
    {
        var abs = DOM_createElement(document,"TD");
        addSourceMapping(abs,con);
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            var childAbs = BlockLevelEltsChild_get(child);
            if (childAbs != null)
                DOM_appendChild(abs,childAbs);
        }
        return abs;
    });

    var WordTc_put = trace(function _WordTc_put(con)
    {
    });

    var WordTr_get = trace(function _WordTr_get(con)
    {
        var abs = DOM_createElement(document,"TR");
        addSourceMapping(abs,con);
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child._is_tc) {
                DOM_appendChild(abs,WordTc_get(child));
            }
        }
        return abs;
    });

    var WordTr_put = trace(function _WordTr_put(con)
    {
    });

    var WordTbl_get = trace(function _WordTbl_get(con)
    {
        var abs = DOM_createElement(document,"TABLE");
        addSourceMapping(abs,con);
        DOM_setAttribute(abs,"border","1"); // FIXME: temp
        DOM_setAttribute(abs,"width","100%"); // FIXME: temp

        if (con._child_tblPr != null) {
        }
        if (con._child_tblGrid != null) {
        }

        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child._is_tr) {
                DOM_appendChild(abs,WordTr_get(child)); 
            }
        }
        return abs;
    });

    var WordTbl_put = trace(function _WordTbl_put(abs,con)
    {
    });

    var BlockLevelEltsChild_isVisible = trace(function _BlockLevelEltsChild_isVisible(con)
    {
        return (con._is_p || con._is_tbl);
    });

    var BlockLevelEltsChild_get = trace(function _BlockLevelEltsChild_get(con)
    {
        if (con._is_p)
            return WordP_get(con);
        else if (con._is_tbl)
            return WordTbl_get(con);
        else
            return null;
    });

    var BlockLevelEltsChild_put = trace(function _BlockLevelEltsChild_put(abs,con)
    {
        if (con._is_p)
            return WordP_put(abs,con);
        else if (con._is_tbl)
            return WordTbl_put(abs,con);
        else
            return null;
    });

    var normaliseParagraph = trace(function _normaliseParagraph(p)
    {
        var paragraph = Text_analyseParagraph(new Position(p,0));
        if (paragraph == null)
            throw new Error("Paragraph analysis failed");

        var res = DOM_createElement(document,p.nodeName);
        for (var i = 0; i < paragraph.runs.length; i++) {
            var run = paragraph.runs[i];
//            debug("paragraph.runs["+i+"] = "+run.start+"-"+run.end+" "+nodeString(run.node));
            var properties = Formatting_getAllNodeProperties(run.node);
            var span = DOM_createElement(document,"SPAN");
            DOM_setStyleProperties(span,properties);
            DOM_appendChild(res,span);
            DOM_appendChild(span,DOM_cloneNode(run.node,true));
        }
        return res;
    });

    var BlockLevelEltsChild_create = trace(function _BlockLevelEltsChild_put(abs,doc)
    {
        if (isParagraphNode(abs))
            return WordP_create(abs,doc);
        else
            return null;
    });

    var BlockLevelEltsChildLens = {
        isVisible: BlockLevelEltsChild_isVisible,
        put: BlockLevelEltsChild_put,
        create: BlockLevelEltsChild_create,
        getSource: lookupSourceMapping,
    };

    var WordBody_get = trace(function _WordBody_get(con)
    {
        debug("WordBody_get: con = "+nodeString(con));
        var abs = DOM_createElement(document,"BODY");
        addSourceMapping(abs,con);
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            debug("WordBody_get: child = "+nodeString(child));
            var childAbs = BlockLevelEltsChild_get(child);
            if (childAbs != null)
                DOM_appendChild(abs,childAbs);
        }
        return abs;
    });

    var WordBody_put = trace(function _WordBody_put(abs,con)
    {
        debug("WordBody_put: abs = "+nodeString(abs)+", con = "+nodeString(con));
        var sectPr = con._child_sectPr;
        BDT_Container_put(abs,con,BlockLevelEltsChildLens);
        // Make sure the sectPr element is at the end
        if ((sectPr != null) && (sectPr.parentNode == con))
            DOM_appendChild(con,sectPr);
    });

    WordDocument_get = trace(function _WordDocument_get(con)
    {
        var html = DOM_createElement(document,"HTML");
        DOM_appendChild(html,WordBody_get(con._child_body));
        return html;
    });

    WordDocument_put = trace(function _WordDocument_put(abs,con)
    {
        debug("WordDocument_put: abs = "+nodeString(abs)+", con = "+nodeString(con));
        for (var absChild = abs.firstChild; absChild != null; absChild = absChild.nextSibling) {
            if (DOM_upperName(absChild) == "BODY") {
                WordBody_put(absChild,con._child_body);
                return;
            }
        }
    });

})();
