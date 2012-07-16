// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var Styles_getCSSText;
var Styles_scheduleApplyCSSTextChanges;
var Styles_getAllStyles;
var Styles_setStyle;
var Styles_setStyleSheet;
var Styles_deleteStyleWithId;
var Styles_addDefaultRuleCategory;
var Styles_discoverStyles;
var Styles_init;
var Styles_removeSelectionRule;

(function() {

    var doneInit = false;

    // FIXME: We should have a separate HTML style element for each style, so we only have to
    // update that one style each time we make a change. We should measure the performance benefit
    // of doing so first. If we use multiple style elements, we should consolidate them before
    // saving the file.

    var HTML_DISPLAY_NAMES = {

        // Built-in paragraph styles
        "P": "Normal Paragraph",
        "H1": "Heading 1",
        "H2": "Heading 2",
        "H3": "Heading 3",
        "H4": "Heading 4",
        "H5": "Heading 5",
        "H6": "Heading 6",
        "PRE": "Preformatted Text",
        "BLOCKQUOTE": "Block Quote",

        // Built-in special styles
        "BODY": "Document Defaults",
        "TABLE": "Table",
        "TD": "Table Cell",
        "TH": "Table Header Cell",
        "CAPTION": "Table Caption",
        "FIGURE": "Figure",
        "FIGCAPTION": "Figure Caption",
    };

    var latentStyleGroups = null;

    function Style(styleId,displayName,rules)
    {
        this.styleId = styleId;
        this.displayName = displayName;
        this.rules = rules;
        this.type = "general";
        this.latent = false;
        this.custom = true;
        this.hidden = false;
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

    // private
    var stringsAllEqual = trace(function stringsAllEqual(strings)
    {
        var first = strings[0];
        for (var i = 1; i < strings.length; i++) {
            if (first != strings[i])
                return false;
        }
        return true;
    });

    // private
    var condenseProperties = trace(function condenseProperties(properties)
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
    });

    // private
    var propertyListText = trace(function propertyListText(properties)
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
    });

    Styles_getCSSText = trace(function getCSSText(exclude)
    {
        var excludeSet = new Object();
        if (exclude != null) {
            for (var i = 0; i < exclude.length; i++)
                excludeSet[exclude[i]] = true;
        }

        var cssTextArray = new Array();

        var individualRules = new Array();

        for (var styleId in stylesById) {
            var style = stylesById[styleId];
            if (!style.latent) {
                var ruleIds = Object.getOwnPropertyNames(style.rules).sort();
                for (var ruleIndex = 0; ruleIndex < ruleIds.length; ruleIndex++) {
                    var rule = style.rules[ruleIds[ruleIndex]];
                    var content = propertyListText(rule.properties);
                    if ((content != "") || !rule.nilTextIfEmpty) {
                        individualRules.push({selector: rule.selector,
                                              content: content});
                    }
                }
            }
        }

        var selectorsByContent = new Object();
        for (var i = 0; i < individualRules.length; i++) {
            if (!excludeSet[individualRules[i].selector]) {
                var selectors = selectorsByContent[individualRules[i].content];
                if (selectors == null)
                    selectors = selectorsByContent[individualRules[i].content] = new Array();
                selectors.push(individualRules[i].selector);
            }
        }

        var groupedRules = new Array();
        for (var content in selectorsByContent) {
            groupedRules.push({selectors: selectorsByContent[content].sort().join(", "),
                               content: content});
        }
        groupedRules.sort(compareBySelectors);

        for (var i = 0; i < groupedRules.length; i++)
            cssTextArray.push(groupedRules[i].selectors+" {\n"+groupedRules[i].content+"}\n");

        return cssTextArray.join("");

        function compareBySelectors(a,b)
        {
            if (a.selectors < b.selectors)
                return -1;
            else if (a.selectors > b.selectors)
                return 1;
            else
                return 0;
        }
    });

    // Unfortunately, modifying the CSS stylesheet object associated with a style element
    // does not cause its text content to be updated. Thus, we have to do it ourselves.
    // To avoid doing this multiple times for a single editing operation, call the
    // scheduleApplyCSSTextChanges() function, which will cause the changes to be applied
    // when PostponedActions_perform() is next called.
    // private
    var applyCSSTextChanges = trace(function applyCSSTextChanges()
    {
        if (cssTextDirty) {
            cssTextDirty = false;

            var styleElement = getOrCreateStyleElement();
            var allCSSText = Styles_getCSSText();

            DOM_deleteAllChildren(styleElement);
            DOM_appendChild(styleElement,DOM_createTextNode(document,allCSSText));
        }
    });

    Styles_scheduleApplyCSSTextChanges = trace(function scheduleApplyCSSTextChanges()
    {
        cssTextDirty = true;
        PostponedActions_add(applyCSSTextChanges);
    });

    function canonicaliseSelector(selector)
    {
        // Class names are case sensitive. So we split the string into .-separated components,
        // and convert only the first portion (the element name, if present) to lower case
        selector = selector.replace(/\s+/g," ");
        var parts = selector.split(/\./);
        if (parts.length >= 0)
            parts[0] = parts[0].toLowerCase();
        return parts.join(".");
    }

    // private
    var getOrCreateStyleElement = trace(function getOrCreateStyleElement()
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
        DOM_appendChild(head,documentStyleElement);
        return documentStyleElement;
    });

    // public
    Styles_getAllStyles = trace(function getAllStyles()
    {
        return stylesById;
    });

    // public
    Styles_setStyle = trace(function setStyle(style)
    {
        stylesById[style.styleId] = style;
        Styles_scheduleApplyCSSTextChanges();
    });

    // public
    Styles_setStyleSheet = trace(function setStyleSheet(styles)
    {
        stylesById = styles;
        Styles_scheduleApplyCSSTextChanges();
    });

    // public
    Styles_deleteStyleWithId = trace(function deleteStyleWithId(styleId)
    {
        delete stylesById[styleId];
        Styles_scheduleApplyCSSTextChanges();
    });

    // public
    Styles_addDefaultRuleCategory = trace(function addDefaultRuleCategory(category)
    {
        if (!doneInit) {
            // This function is called by the selection code, but in some of the tests,
            // Styles_init is not called. So we skipp trying to add the style if this is the case.
            return;
        }
        var selectors = latentStyleGroups[category];
        if (selectors == null)
            throw new Error("No default rule category \""+category+"\"");
        var changed = false;
        for (var i = 0; i < selectors.length; i++) {
            var style = styleForId(selectors[i]);
            if (style.latent) {
                style.latent = false;
                changed = true;
            }
        }

        if (changed)
            Styles_scheduleApplyCSSTextChanges();
    });

    // private
    var styleForId = trace(function styleForId(selector,properties)
    {
        selector = canonicaliseSelector(selector);
        var displayName = displayNameForSelector(selector);
        var style = stylesById[selector];
        if (style == null) {
            var rule = new Rule(selector,{});
            style = new Style(selector,displayName,{base: rule});
            stylesById[selector] = style;
        }
        if (properties != null) {
            for (var name in properties)
                style.rules.base.properties[name] = properties[name];
        }
        return style;
    });

    // private
    var defaultStyle = trace(function defaultStyle(selector,type,latent,properties)
    {
        var style = styleForId(selector,properties);
        style.type = type;
        style.custom = false;
        var disp = HTML_DISPLAY_NAMES[selector.toUpperCase()];
        if (disp != null)
            style.displayName = disp;
        style.rules.base.nilTextIfEmpty = true;

        if (typeof(latent) == "boolean")
            style.latent = latent;
        return style;
    });

    // public
    Styles_discoverStyles = trace(function discoverStyles()
    {
        for (var sheetNo = 0; sheetNo < document.styleSheets.length; sheetNo++) {
            var sheet = document.styleSheets[sheetNo];
            var str = "";
            for (name in sheet)
                str += name+"\n";
            for (var ruleNo = 0; ruleNo < sheet.cssRules.length; ruleNo++) {
                var rule = sheet.cssRules[ruleNo];
                if ((rule.type == CSSRule.STYLE_RULE) || (rule.type == CSSRule.PAGE_RULE)) {
                    var properties = new Object();
                    for (var propertyNo = 0; propertyNo < rule.style.length; propertyNo++) {
                        var name = rule.style[propertyNo];
                        var value = rule.style.getPropertyValue(name);
                        value = value.replace(/^['"]/,"");
                        value = value.replace(/['"]$/,"");
                        properties[name] = value;
                    }

                    var individualSelectors = rule.selectorText.split(/\s*,\s*/);
                    for (var selNo = 0; selNo < individualSelectors.length; selNo++) {
                        var selector = individualSelectors[selNo];
                        var style = styleForId(selector,properties);
                        // If there was already a built-in style for this selector, it might be
                        // marked as latent. Set latent to false to make sure it's included in the
                        // output generated by applyCSSTextChanges().
                        style.latent = false;
                    }
                }
            }
        }
    });

    // private
    var displayNameForSelector = trace(function displayNameForSelector(selector)
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
    });

    // public
    Styles_init = trace(function init()
    {
        latentStyleGroups = {
            "td-paragraph-margins": ["td > :first-child", "td > :last-child"],
            "th-paragraph-margins": ["th > :first-child", "th > :last-child"],
            "table-borders": ["table", "td", "th"],
            "table-caption": ["caption"],
            "figure": ["figure"],
            "toc-print": [".toc1-print", ".toc2-print", ".toc3-print", ".toctitle",".tocpageno"],
            "toc": [".toc1", ".toc2", ".toc3"],
            "autocorrect": [".uxwrite-autocorrect"],
            "selection": [".uxwrite-selection"],
        };

        stylesById = new Object();

        // Add the default styles first, because we mark some of them as initially being latent
        // (meaning they contain UX Write-specific defaults that are not yet needed and therefore
        // not included in the stylesheet).

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
        defaultStyle("FIGURE","special",true,{"margin-left": "auto",
                                              "margin-right": "auto",
                                              "text-align": "center"});
        defaultStyle("FIGCAPTION","special");

        // Page properties for printing
        defaultStyle("@page","special",true,null).hidden = true;

        // "td-paragraph-margins"
        defaultStyle("td > :first-child","complex",true,{"margin-top": "0"});
        defaultStyle("td > :last-child","complex",true,{"margin-bottom": "0"});

        // "th-paragraph-margins"
        defaultStyle("th > :first-child","complex",true,{"margin-top": "0"});
        defaultStyle("th > :last-child","complex",true,{"margin-bottom": "0"});

        // "table-borders"
        defaultStyle("table","special",true,{"border-collapse": "collapse",
                                             "margin-left": "auto",
                                             "margin-right": "auto"});
        defaultStyle("td","special",true,{"border": "1px solid black"}).hidden = true;
        defaultStyle("th","special",true,{"border": "1px solid black"}).hidden = true;

        // "table-caption"
        defaultStyle("caption","special",true,{"caption-side": "bottom"});

/*
        defaultStyle("."+Keys.SECTION_TOC+" li","special",true,
                     { "border-bottom": "2px dotted black",
                       "list-style-type": "none",
                       "height": "1em",
                       "clear": "both"}).hidden = true;
*/


        defaultStyle(".toc1","special",true,
                     { "margin-left": "0pt",
                       "margin-top": "12pt",
                       "margin-bottom": "6pt",
                     }).hidden = true;
        defaultStyle(".toc2","special",true,
                     { "margin-left": "24pt",
                       "margin-top": "6pt",
                       "margin-bottom": "6pt",
                     }).hidden = true;
        defaultStyle(".toc3","special",true,
                     { "margin-left": "48pt",
                       "margin-top": "6pt",
                       "margin-bottom": "6pt",
                     }).hidden = true;

        defaultStyle(".toc1-print","special",true,
                     { "margin-left": "0pt",
                       "margin-top": "12pt",
                       "margin-bottom": "6pt",
                       "clear": "both",
                       "height": "1em",
//                       "font-weight": "bold",
                       "border-bottom-width": "2px",
                       "border-bottom-style": "dotted",
                       "border-bottom-color": "black",
                     }).hidden = true;
        defaultStyle(".toc2-print","special",true,
                     { "margin-left": "24pt",
                       "margin-top": "6pt",
                       "margin-bottom": "6pt",
                       "clear": "both",
                       "height": "1em",
                       "border-bottom-width": "2px",
                       "border-bottom-style": "dotted",
                       "border-bottom-color": "black",
                     }).hidden = true;
        defaultStyle(".toc3-print","special",true,
                     { "margin-left": "48pt",
                       "margin-top": "6pt",
                       "margin-bottom": "6pt",
                       "clear": "both",
                       "height": "1em",
                       "border-bottom-width": "2px",
                       "border-bottom-style": "dotted",
                       "border-bottom-color": "black",
                     }).hidden = true;
        defaultStyle(".toctitle","special",true,
                     { "float": "left",
                       "background-color": "white",
                       "padding-right": "12pt" }).hidden = true;
        defaultStyle(".tocpageno","special",true,
                     { "float": "right",
                       "background-color": "white",
                       "text-align": "right",
                       "width": "36pt",}).hidden = true;
        defaultStyle(".uxwrite-autocorrect","special",true,
                     {"background-color": "#c0ffc0"}).hidden = true;
        defaultStyle(".uxwrite-selection","special",true,
                     {"background-color": "rgb(201,221,238)"}).hidden = true;

        // Now that we've added the built-in styles, discover any styles explicitly defined
        // in the document. Any that are found will be marked as non-latent, because we want
        // to preserve them when re-generating the stylesheet text.

        Styles_discoverStyles();
        doneInit = true;
    });

    // Used only for tests - avoids .uxwrite-selection showing up in results
    Styles_removeSelectionRule = trace(function removeSelectionRule()
    {
        if (doneInit) {
            var selectionStyle = styleForId(".uxwrite-selection");
            if (!selectionStyle.latent) {
                selectionStyle.latent = true;
                cssTextDirty = true;
                applyCSSTextChanges();
            }
        }
    });

})();
