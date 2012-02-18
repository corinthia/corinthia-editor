// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

function getStyleElement()
{
    var style = document.getElementById("style");
    if (style == null) {
        style = DOM.createElement(document,"STYLE");
        style.setAttribute("id","style");
        var head = document.getElementsByTagName("HEAD")[0];
        DOM.appendChild(head,style);
    }
    return style;
}

function clearDocument()
{
    var style = getStyleElement();
    DOM.deleteAllChildren(style);
    DOM.deleteAllChildren(document.body);
}

function setStyleSheet(selector,cssText)
{
    var previewText =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec in diam \n"+
    "mauris. Integer in lorem sit amet dolor lacinia aliquet. Cras vehicula odio \n"+
    "non enim euismod nec congue lorem varius. Sed eu libero arcu, eget tempus \n"+
    "augue. Vivamus varius risus ac libero sagittis eu ultricies lectus \n"+
    "consequat. Integer gravida accumsan fermentum. Morbi erat ligula, volutpat \n"+
    "non accumsan sed, pellentesque quis purus. Vestibulum vestibulum tincidunt \n"+
    "lectus non pellentesque. Quisque porttitor sollicitudin tellus, id porta \n"+
    "velit interdum sit amet. Cras quis sem orci, vel convallis magna. \n"+
    "Pellentesque congue, libero et iaculis volutpat, enim turpis sodales dui, \n"+
    "lobortis pharetra lectus dolor at sem. Nullam aliquam, odio ac laoreet \n"+
    "vulputate, ligula nunc euismod leo, vel bibendum magna leo ut orci. In \n"+
    "tortor turpis, pellentesque nec cursus ut, consequat non ipsum. Praesent \n"+
    "venenatis, leo in pulvinar pharetra, eros nisi convallis elit, vitae luctus \n"+
    "magna velit ut lorem."

    clearDocument();
    
    var style = getStyleElement();
    DOM.appendChild(style,DOM.createTextNode(document,cssText));
    
    var element;
    if (selector.charAt(0) == ".") {
        element = DOM.createElement(document,"DIV");
        element.setAttribute("class",selector.slice(1));
    }
    else {
        element = DOM.createElement(document,selector);
    }
    
    DOM.appendChild(document.body,element);
    DOM.appendChild(element,DOM.createTextNode(document,previewText));
}
