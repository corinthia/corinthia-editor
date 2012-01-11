function clearDocument()
{
    var style = document.getElementById("style");
    while (style.firstChild != null)
        style.removeChild(style.firstChild);
    while (document.body.firstChild != null)
        document.body.removeChild(document.body.firstChild);
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
    
    var style = document.getElementById("style");
    style.appendChild(document.createTextNode(cssText));
    
    var element;
    if (selector.charAt(0) == ".") {
        element = document.createElement("DIV");
        element.setAttribute("class",selector.slice(1));
    }
    else {
        element = document.createElement(selector);
    }
    
    document.body.appendChild(element);
    element.appendChild(document.createTextNode(previewText));
}
