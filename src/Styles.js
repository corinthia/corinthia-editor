// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Styles_reportStylesToEditor;

(function() {

    var styles = new Array();

    // public
    function count()
    {
        return styles.length;
    }

    // public
    function styleAtIndex(index)
    {
        return styles[i];
    }

    // public
    function reportStylesToEditor()
    {
        debug("reportStylesToEditor()");
        for (var i = 0; i < document.styleSheets.length; i++) {
            var sheet = document.styleSheets[i];
            var str = "";
            for (name in sheet)
                str += name+"\n";
            for (var j = 0; j < sheet.cssRules.length; j++) {
                var rule = sheet.cssRules[j];
                if (rule.type == CSSRule.STYLE_RULE) {
                    var properties = new Object();
                    for (k = 0; k < rule.style.length; k++)
                        properties[rule.style[k]] = rule.style.getPropertyValue(rule.style[k]);
                    
                    styles.push({"selector": rule.selectorText,
                               "properties": properties });
                }
            }
        }
        Editor_setStyles(styles);
    }

    Styles_reportStylesToEditor = trace(reportStylesToEditor);

})();
