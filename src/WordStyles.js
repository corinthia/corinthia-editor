var WordRPR_toCSS;
var WordRPR_updateFromCSS;
//var WordRPR_createFromCSS;
var WordPPR_toCSS;
var WordStyles_parseStyles;

(function() {

    var rrggbbRegex = /^[0-9A-Fa-f]{6}$/;

    var WordPBdrSide_toCSS = trace(function _WordPBdrSide_toCSS(style,node,prefix)
    {
        var val = DOM_getAttributeNS(node,WORD_NAMESPACE,"val");
        var sz = DOM_getAttributeNS(node,WORD_NAMESPACE,"sz");
        var space = DOM_getAttributeNS(node,WORD_NAMESPACE,"space");
        var color = DOM_getAttributeNS(node,WORD_NAMESPACE,"color");

        style.cssProperties[prefix+"style"] = "solid"; // FIXME
        style.cssProperties[prefix+"width"] = "2px"; // FIXME

        if ((color != null) && color.match(rrggbbRegex))
            style.cssProperties[prefix+"color"] = "#"+color;
        else
            style.cssProperties[prefix+"color"] = "black";
    });

    var WordPBdr_toCSS = trace(function _WordPBdr_toCSS(style,node)
    {
        if (node._child_left != null)
            WordPBdrSide_toCSS(style,node._child_left,"border-left-");
        if (node._child_right != null)
            WordPBdrSide_toCSS(style,node._child_right,"border-right-");
        if (node._child_top != null)
            WordPBdrSide_toCSS(style,node._child_top,"border-top-");
        if (node._child_bottom != null)
            WordPBdrSide_toCSS(style,node._child_bottom,"border-bottom-");
    });

    var WordShd_toCSS = trace(function _WordShd_toCSS(style,node)
    {
        var fill = DOM_getAttributeNS(node,WORD_NAMESPACE,"fill");
        debug("******** shading: fill = "+fill);
        if ((fill != null) && fill.match(rrggbbRegex))
            style.cssProperties["background-color"] = "#"+fill;
    });

    WordB_toCSS = trace(function _WordB_toCSS(style,node)
    {
        // val: type xsd:boolean;  {true, false, 1, 0}.
        var val = DOM_getAttributeNS(node,WORD_NAMESPACE,"val");
        if ((val == "false") || (val == "0"))
            style.cssProperties["font-weight"] = "normal";
        else
            style.cssProperties["font-weight"] = "bold";
    });

    // Run properties
    WordRPR_toCSS = trace(function _WordRPR_toCSS(style,node)
    {
        // w_EG_RPrBase
        if (node._child_b)
            WordB_toCSS(style,node._child_b);

        if (node._child_i)
            style.cssProperties["font-style"] = "italic";
        if (node._child_u)
            style.cssProperties["text-decoration"] = "underline";
        if (node._child_color) {
            var val = DOM_getAttributeNS(node._child_color,WORD_NAMESPACE,"val");
            if ((val != null) && val.match(rrggbbRegex)) {
                style.cssProperties["color"] = "#"+val;
            }
        }
        if (node._child_sz) {
            // units: 1/2 pt
            var val = DOM_getAttributeNS(node._child_sz,WORD_NAMESPACE,"val");
            if (val != null) {
                style.cssProperties["font-size"] = (val/2)+"pt";
            }
        }
        if (node._child_rFonts) {
            var ascii = DOM_getAttributeNS(node._child_rFonts,WORD_NAMESPACE,"ascii");
            var hAnsi = DOM_getAttributeNS(node._child_rFonts,WORD_NAMESPACE,"hAnsi");
            if (ascii != null)
                style.cssProperties["font-family"] = ascii;
            else if (hAnsi != null)
                style.cssProperties["font-family"] = hAnsi;
        }
        if (node._child_shd != null)
            WordShd_toCSS(style,node._child_shd);
    });

    function getChild(parent,name)
    {
        var property = "_child_"+name;
        if (parent[property] == null) {
            var child = DOM_createElementNS(parent.ownerDocument,WORD_NAMESPACE,WORD_PREFIX+name);
            DOM_appendChild(parent,child);
            parent[property] = child;
        }
        return parent[property];
    }

    function removeChild(parent,name)
    {
        var property = "_child_"+name;
        if (parent[property] == null) {
            DOM_deleteNode(parent[property]);
            parent[property] = null;
        }
    }

    function setChildVal(parentNode,childName,val)
    {
        if (val != null) {
            var childNode = getChild(parentNode,childName);
            DOM_setAttributeNS(childNode,WORD_NAMESPACE,WORD_PREFIX+"val",val);
        }
        else {
            removeChild(parentNode,childName);
        }
    }

    WordRPR_updateFromCSS = trace(function _WordRPR_updateFromCSS(con,newProperties)
    {
        var oldProperties = {};
        WordRPR_toCSS({ cssProperties: oldProperties },con);
        var oldTextDecoration = fromTokenList(oldProperties["text-decoration"]);
        var newTextDecoration = fromTokenList(newProperties["text-decoration"]);

        // bold
        var oldFontWeight = oldProperties["font-weight"];
        var newFontWeight = newProperties["font-weight"];
        if (oldFontWeight != newFontWeight) {
            if (newFontWeight == "bold")
                setChildVal(con,"b","true");
            else if (newFontWeight == "bold")
                setChildVal(con,"b","false");
            else
                setChildVal(con,"b",null);
        }

        // italic
        var oldFontStyle = oldProperties["font-style"];
        var newFontStyle = newProperties["font-style"];
        if (oldFontStyle != newFontStyle) {
            if (newFontStyle == "italic")
                setChildVal(con,"i","true");
            else if (newFontStyle == "normal")
                setChildVal(con,"i","false");
            else
                setChildVal(con,"i",null);
        }

        // underline
        var oldUnderline = oldTextDecoration["underline"];
        var newUnderline = newTextDecoration["underline"];
        if (oldUnderline != newUnderline) {
            if (newUnderline)
                setChildVal(con,"u","single");
            else
                setChildVal(con,"u",null);
        }

        // line-through/strike-through
        var oldLineThrough = oldTextDecoration["line-through"];
        var newLineThrough = newTextDecoration["line-through"];
        if (oldLineThrough != newLineThrough) {
            if (newLineThrough)
                setChildVal(con,"strike","true");
            else
                setChildVal(con,"strike",null);
        }
    });

//    WordRPR_createFromCSS = trace(function _WordRPR_createFromCSS(cssProperties,doc)
//    {
//        var rPr = DOM_createElementNS(doc,WORD_NAMESPACE,WORD_PREFIX+"rPr");
//        WordRPR_updateFromCSS(rPr,cssProperties);
//        return (rPr.firstChild != null) ? rPr : null;
//    });

    // Paragraph properties
    WordPPR_toCSS = trace(function _WordPPR_toCSS(style,node)
    {
        for (var child = node.firstChild; child != null; child = child.nextSibling) {
            debug("pPr child "+nodeString(child));
        }
        if (node._child_shd != null)
            WordShd_toCSS(style,node._child_shd);
        if (node._child_pBdr != null)
            WordPBdr_toCSS(style,node._child_pBdr);
    });

    var WordStyle_parseStyle = trace(function _WordStyle_parseStyle(con)
    {
        var styleId = DOM_getAttributeNS(con,WORD_NAMESPACE,"styleId");
        var type = DOM_getAttributeNS(con,WORD_NAMESPACE,"type");
        var displayName = null;
        if ((con._child_name != null) && con.hasAttributeNS(WORD_NAMESPACE,"val"))
            displayName = DOM_getAttributeNS(con,WORD_NAMESPACE,"val");
        else
            displayName = styleId;
        var wstyle = new WordStyle();

        debug("WordStyle_parseStyle: styleId "+styleId+" type "+type+
              " display name "+JSON.stringify(displayName));

        if (con._child_pPr != null)
            WordPPR_toCSS(wstyle,con._child_pPr);
        if (con._child_rPr != null)
            WordRPR_toCSS(wstyle,con._child_rPr);


        // These are the only four possible types of styles

        var selector = null;
        if (type == "paragraph") {
            selector = "p."+styleId;
        }
        else if (type == "character") {
            selector = "span."+styleId;
        }
        else if (type == "table") {
        }
        else if (type == "numbering") {
        }

        if (selector != null) {
            var uxrule = Rule_create(selector,wstyle.cssProperties);
            var uxstyle = Style_create(selector,displayName,{ base: uxrule });
            Styles_setStyle(uxstyle);
        }
    });

    WordStyles_parseStyles = trace(function _WordStyles_parseStyles(con)
    {
        debug("WordStyles_parseStyles: con = "+nodeString(con));
        for (var child = con.firstChild; child != null; child = child.nextSibling) {
            debug("WordStyles_parseStyles: child = "+nodeString(child));
            if (child._is_style)
                WordStyle_parseStyle(child);
        }
    });

})();
