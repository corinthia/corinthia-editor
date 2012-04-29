// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Styles_getAllStyles;
var Styles_setStyle;
var Styles_setStyleSheet;
var Styles_addDefaultRule;
var Styles_addDefaultRuleCategory;
var Styles_discoverStyles;
var Styles_init;

(function() {

    // FIXME: We should have a separate HTML style element for each style, so we only have to
    // update that one style each time we make a change. We should measure the performance benefit
    // of doing so first. If we use multiple style elements, we should consolidate them before
    // saving the file.

    var HTML_DISPLAY_NAMES = {

        // Built-in paragraph styles
        "P": "Normal paragraph",
        "H1": "Heading 1",
        "H2": "Heading 2",
        "H3": "Heading 3",
        "H4": "Heading 4",
        "H5": "Heading 5",
        "H6": "Heading 6",
        "PRE": "Preformatted text",
        "BLOCKQUOTE": "Block quote",

        // Built-in special styles
        "BODY": "Document defaults",
        "TABLE": "Table",
        "CAPTION": "Table caption",
        "FIGURE": "Figure",
        "FIGCAPTION": "Figure caption",
    };

    function Style(styleId,displayName,rules)
    {
        this.styleId = styleId;
        this.displayName = displayName;
        this.rules = rules;
        this.type = "general";
    }

    function Rule(selector,properties)
    {
        this.selector = selector;
        this.properties = properties;
        this.nilTextIfEmpty = false;
    }

    var stylesById = null;
    var documentStyleElement = null;
    var cssTextDirty = false;

    var defaultRuleCategories = {
        "td-paragraph-margins": {
            "td > p:first-child": {"margin-top": "0"},
            "td > p:last-child": {"margin-bottom": "0"},
        },
        "th-paragraph-margins": {
            "th > p:first-child": {"margin-top": "0"},
            "th > p:last-child": {"margin-bottom": "0"},
        },
        "table-borders": {
            "table": {"border-collapse": "collapse"},
            "td": {"border": "1px solid black"},
        },
        "table-caption": {
            "caption": {"caption-side": "bottom"},
        },
    };

    function stringsAllEqual(strings)
    {
        var first = strings[0];
        for (var i = 1; i < strings.length; i++) {
            if (first != strings[i])
                return false;
        }
        return true;
    }

    function condenseProperties(properties)
    {
        // Make a copy of cssProperties because we want to make some changes before preparing the
        // CSS text, while leaving the object itself unchanged
        properties = clone(properties);

        if ((properties["margin-left"] != null) &&
            stringsAllEqual(properties["margin-left"],
                            properties["margin-right"],
                            properties["margin-top"],
                            properties["margin-bottom"])) {
            properties["margin"] = properties["margin-left"];
            delete properties["margin-left"];
            delete properties["margin-right"];
            delete properties["margin-top"];
            delete properties["margin-bottom"];
        }

        var borderLeft = "";
        var borderRight = "";
        var borderTop = "";
        var borderBottom = "";

        if (properties["border-left-width"] != null)
            borderLeft += " " + properties["border-left-width"];
        if (properties["border-right-width"] != null)
            borderRight += " " + properties["border-right-width"];
        if (properties["border-top-width"] != null)
            borderTop += " " + properties["border-top-width"];
        if (properties["border-bottom-width"] != null)
            borderBottom += " " + properties["border-bottom-width"];

        if (properties["border-left-style"] != null)
            borderLeft += " " + properties["border-left-style"];
        if (properties["border-right-style"] != null)
            borderRight += " " + properties["border-right-style"];
        if (properties["border-top-style"] != null)
            borderTop += " " + properties["border-top-style"];
        if (properties["border-bottom-style"] != null)
            borderBottom += " " + properties["border-bottom-style"];

        if (properties["border-left-color"] != null)
            borderLeft += " " + properties["border-left-color"];
        if (properties["border-right-color"] != null)
            borderRight += " " + properties["border-right-color"];
        if (properties["border-top-color"] != null)
            borderTop += " " + properties["border-top-color"];
        if (properties["border-bottom-color"] != null)
            borderBottom += " " + properties["border-bottom-color"];

        
        if ((borderLeft.length > 0) &&
            (borderLeft == borderRight) &&
            (borderLeft == borderTop) &&
            (borderLeft == borderBottom)) {
            properties["border"] = borderLeft.substring(1);
        }
        else {
            if (borderLeft.length > 0)
                properties["border-left"] = borderLeft.substring(1);
            if (borderRight.length > 0)
                properties["border-right"] = borderRight.substring(1);
            if (borderTop.length > 0)
                properties["border-top"] = borderTop.substring(1);
            if (borderBottom.length > 0)
                properties["border-bottom"] = borderBottom.substring(1);
        }
        
        delete properties["border-left-width"];
        delete properties["border-right-width"];
        delete properties["border-top-width"];
        delete properties["border-bottom-width"];
        
        delete properties["border-left-style"];
        delete properties["border-right-style"];
        delete properties["border-top-style"];
        delete properties["border-bottom-style"];
        
        delete properties["border-left-color"];
        delete properties["border-right-color"];
        delete properties["border-top-color"];
        delete properties["border-bottom-color"];

        if ((properties["border-top-left-radius"] != null) &&
            stringsAllEqual(properties["border-top-left-radius"],
                            properties["border-top-right-radius"],
                            properties["border-bottom-left-radius"],
                            properties["border-bottom-right-radius"])) {
            properties["border-radius"] = properties["border-top-left-radius"];
            delete properties["border-top-left-radius"];
            delete properties["border-top-right-radius"];
            delete properties["border-bottom-left-radius"];
            delete properties["border-bottom-right-radius"];
        }

        if ((properties["padding-left"] != null) &&
            stringsAllEqual(properties["padding-left"],
                            properties["padding-right"],
                            properties["padding-top"],
                            properties["padding-bottom"])) {
            properties["padding"] = properties["padding-left"];
            delete properties["padding-left"];
            delete properties["padding-right"];
            delete properties["padding-top"];
            delete properties["padding-bottom"];
        }
        return properties;
    }

    function propertyListText(properties)
    {
        properties = condenseProperties(properties);

        if ((properties["font-family"] != null) &&
            (properties["font-family"].match(/\s+/))) {
            properties["font-family"] = JSON.stringify(properties["font-family"]);
        }

        var lines = new Array();
        var keys = Object.getOwnPropertyNames(properties).sort();
        for (var i = 0; i < keys.length; i++) {
            lines.push("    "+keys[i]+": "+properties[keys[i]]+";\n");
        }
        return lines.join("");
    }

    // Unfortunately, modifying the CSS stylesheet object associated with a style element
    // does not cause its text content to be updated. Thus, we have to do it ourselves.
    // To avoid doing this multiple times for a single editing operation, call the
    // scheduleApplyCSSTextChanges() function, which will cause the changes to be applied
    // when PostponedActions_perform() is next called.
    function applyCSSTextChanges()
    {
        if (cssTextDirty) {
            cssTextDirty = false;

            var styleElement = getOrCreateStyleElement();
            var cssTextArray = new Array();

            var styleIds = Object.getOwnPropertyNames(stylesById).sort();
            for (var styleIndex = 0; styleIndex < styleIds.length; styleIndex++) {
                var style = stylesById[styleIds[styleIndex]];
                var ruleIds = Object.getOwnPropertyNames(style.rules).sort();
                for (var ruleIndex = 0; ruleIndex < ruleIds.length; ruleIndex++) {
                    var rule = style.rules[ruleIds[ruleIndex]];
                    var text = propertyListText(rule.properties);
                    if ((text != "") || !rule.nilTextIfEmpty)
                        cssTextArray.push(rule.selector+" {\n"+text+"}\n");
                }
            }
            var allCSSText = cssTextArray.join("");

            DOM_deleteAllChildren(styleElement);
            DOM_appendChild(styleElement,DOM_createTextNode(document,allCSSText));
        }
    }

    function scheduleApplyCSSTextChanges()
    {
        cssTextDirty = true;
        PostponedActions_add(applyCSSTextChanges);
    }

    function canonicaliseSelector(selector)
    {
        // FIXME: are class names case sensitive?
        return selector.toLowerCase().replace(/\s+/g," ");
    }

    function getOrCreateStyleElement()
    {
        if (documentStyleElement != null)
            return documentStyleElement;
        var head = DOM_documentHead(document);
        for (var child = head.lastChild; child != null; child = child.previousSibling) {
            if (DOM_upperName(child) == "STYLE") {
                documentStyleElement = child;
                return documentStyleElement;
            }
        }
        documentStyleElement = DOM_createElement(document,"STYLE");
        documentStyleElement.setAttribute("type","text/css");
        DOM_appendChild(head,documentStyleElement);
        return documentStyleElement;
    }

    // public
    function getAllStyles()
    {
        return stylesById;
    }

    // public
    function setStyle(style)
    {
        stylesById[style.styleId] = style;
        scheduleApplyCSSTextChanges();
    }

    // public
    function setStyleSheet(styles)
    {
        stylesById = styles;
        scheduleApplyCSSTextChanges();
    }

    // public
    function addDefaultRule(selector,defaultProperties)
    {
        var style = getOrCreateStyle(selector);
        var rule = style.rules.base;

        for (name in defaultProperties) {
            if (rule.properties[name] == null)
                rule.properties[name] = defaultProperties[name];
        }

        scheduleApplyCSSTextChanges();
    }

    // public
    function addDefaultRuleCategory(category)
    {
        var selectors = defaultRuleCategories[category];
        if (selectors == null)
            throw new Error("No default rule category \""+category+"\"");
        var names = Object.getOwnPropertyNames(selectors).sort();
        for (var i = 0; i < names.length; i++) {
            addDefaultRule(names[i],selectors[names[i]]);
        }
    }

    function getOrCreateStyle(selector)
    {
        selector = canonicaliseSelector(selector);
        var style = stylesById[selector];
        if (style != null)
            return style;
        else
            return addStyleFromCSS(selector,{});
    }

    function addStyleFromCSS(selector,properties)
    {
        selector = canonicaliseSelector(selector);
        var displayName = displayNameForSelector(selector);
        var rule = new Rule(selector,properties);
        var style = new Style(selector,displayName,{base: rule});
        stylesById[selector] = style;
        return style;
    }

    function defaultStyle(selector,type)
    {
        var style = getOrCreateStyle(selector);
        style.type = type;
        var disp = HTML_DISPLAY_NAMES[selector.toUpperCase()];
        if (disp != null)
            style.displayName = disp;
        style.rules.base.nilTextIfEmpty = true;
    }

    // public
    function discoverStyles()
    {
        stylesById = new Object();

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

                    addStyleFromCSS(rule.selectorText,properties);
                }
            }
        }
    }

    function displayNameForSelector(selector)
    {
        selector = selector.replace(/_/g," ");
        var uppercaseSelector = selector.toUpperCase();
        var name = HTML_DISPLAY_NAMES[uppercaseSelector];
        if (name != null)
            return name;
        else if ((selector.length > 0) && (selector.charAt(0) == "."))
            return selector.substring(1);
        else
            return selector;
    }

    // public
    function init()
    {
        Styles_discoverStyles();

        // Built-in paragraph styles
        defaultStyle("P","paragraph");
        defaultStyle("H1","paragraph");
        defaultStyle("H2","paragraph");
        defaultStyle("H3","paragraph");
        defaultStyle("H4","paragraph");
        defaultStyle("H5","paragraph");
        defaultStyle("H6","paragraph");
        defaultStyle("PRE","paragraph");
        defaultStyle("BLOCKQUOTE","paragraph");

        // Built-in special styles
        defaultStyle("BODY","special");
        defaultStyle("TABLE","special");
        defaultStyle("CAPTION","special");
        defaultStyle("FIGURE","special");
        defaultStyle("FIGCAPTION","special");
    }

    Styles_getAllStyles = trace(getAllStyles);
    Styles_setStyle = trace(setStyle);
    Styles_setStyleSheet = trace(setStyleSheet);
    Styles_addDefaultRule = trace(addDefaultRule);
    Styles_addDefaultRuleCategory = trace(addDefaultRuleCategory);
    Styles_discoverStyles = trace(discoverStyles);
    Styles_init = trace(init);

    condenseProperties = trace(condenseProperties);
    propertyListText = trace(propertyListText);
    applyCSSTextChanges = trace(applyCSSTextChanges);

})();
