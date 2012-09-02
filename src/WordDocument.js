var WordDocument_get;
var WordDocument_put;

// FIXME: find somewhere better for this
function WordStyle()
{
    this.cssProperties = new Object();
}

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

//    var WordT_get = trace(function _WordT_get(con)
//    {
//    });

//    var WordT_put = trace(function _WordT_put(abs,con)
//    {
//    });

    var WordR_get = trace(function _WordR_get(con)
    {
        var abs = DOM_createElement(document,"SPAN");
        addSourceMapping(abs,con);

        if (con._child_rPr != null) {
            var style = new WordStyle();
            WordRPR_toCSS(style,con._child_rPr);
            DOM_setStyleProperties(abs,style.cssProperties);

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
    });

    var WordP_get = trace(function _WordP_get(con)
    {
        debug("WordP_get: con = "+nodeString(con));
        var abs = DOM_createElement(document,"P");
        addSourceMapping(abs,con);

        if (con._child_pPr != null) {
            var style = new WordStyle();
            WordPPR_toCSS(style,con._child_pPr);
            DOM_setStyleProperties(abs,style.cssProperties);

            if (con._child_pPr._child_pStyle != null) {
                var val = DOM_getAttributeNS(con._child_pPr._child_pStyle,WORD_NAMESPACE,"val");
                if (val != null)
                    DOM_setAttribute(abs,"class",val);
            }
        }

        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            if (child._is_r)
                DOM_appendChild(abs,WordR_get(child));
        }

        return abs;
    });

    var WordP_put = trace(function _WordP_put(abs,con)
    {
        debug("WordBody_put: abs = "+nodeString(abs)+", con = "+nodeString(con));
    });

    var WordTc_get = trace(function _WordTc_get(con)
    {
        var abs = DOM_createElement(document,"TD");
        addSourceMapping(abs,con);
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            var childAbs = EG_BlockLevelEltsChild_get(child);
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

    var EG_BlockLevelEltsChild_isVisible = trace(function _EG_BlockLevelEltsChild_isVisible(con)
    {
        if (con._is_p)
            return true;
        else if (con._is_tbl)
            return true;
        else
            return false;
    });

    var EG_BlockLevelEltsChild_get = trace(function _EG_BlockLevelEltsChild_get(con)
    {
        if (con._is_p)
            return WordP_get(con);
        else if (con._is_tbl)
            return WordTbl_get(con);
        else
            return null;
    });

    var EG_BlockLevelEltsChild_put = trace(function _EG_BlockLevelEltsChild_put(abs,con)
    {
        if (con._is_p)
            return WordP_put(abs,con);
        else if (con._is_tbl)
            return WordTbl_put(abs,con);
        else
            return null;
    });

    var EG_BlockLevelEltsChild_create = trace(function _EG_BlockLevelEltsChild_put(abs,doc)
    {
        if (isWhitespaceTextNode(abs))
            return null;

        if (isParagraphNode(abs)) {
            debug("EG_BlockLevelEltsChild_create "+nodeString(abs));
            printTree(abs);

            var p = DOM_createElementNS(doc,WORD_NAMESPACE,WORD_PREFIX+"p");

            var leafNodes = getContentLeafNodes(abs);
            for (var i = 0; i < leafNodes.length; i++) {

                var leaf = leafNodes[i];
                if (leaf.nodeType == Node.TEXT_NODE) {
                    var r = DOM_createElementNS(doc,WORD_NAMESPACE,WORD_PREFIX+"r");

                    var rPr = WordRPR_createFromCSS(Formatting_getAllNodeProperties(leaf),doc);
                    if (rPr != null)
                        DOM_appendChild(r,rPr);

                    var t = DOM_createElementNS(doc,WORD_NAMESPACE,WORD_PREFIX+"t");
                    if (leaf.nodeValue.trim() != leaf.nodeValue)
                        DOM_setAttributeNS(t,XML_NAMESPACE,"xml:space","preserve");
                    DOM_appendChild(t,DOM_createTextNode(doc,leaf.nodeValue));

                    DOM_appendChild(r,t);
                    DOM_appendChild(p,r);
                }
                else {
                    // FIXME: support images and any other new types of leaf nodes (e.g.
                    // references)
                }
            }

            return p;
        }

        return null;
    });

    var EG_BlockLevelEltsChildLens = {
        isVisible: EG_BlockLevelEltsChild_isVisible,
        put: EG_BlockLevelEltsChild_put,
        create: EG_BlockLevelEltsChild_create,
        getSource: lookupSourceMapping,
    };

    var WordBody_get = trace(function _WordBody_get(con)
    {
        debug("WordBody_get: con = "+nodeString(con));
        var abs = DOM_createElement(document,"BODY");
        addSourceMapping(abs,con);
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            debug("WordBody_get: child = "+nodeString(child));
            var childAbs = EG_BlockLevelEltsChild_get(child);
            if (childAbs != null)
                DOM_appendChild(abs,childAbs);
        }
        return abs;
    });

    var WordBody_put = trace(function _WordBody_put(abs,con)
    {
        debug("WordBody_put: abs = "+nodeString(abs)+", con = "+nodeString(con));
        var sectPr = con._child_sectPr;
        BDT_Container_put(abs,con,EG_BlockLevelEltsChildLens);
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
