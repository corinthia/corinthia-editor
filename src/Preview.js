function setStylesheet(selector,cssText)
{
    var previewText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec in diam mauris. Integer in lorem sit amet dolor lacinia aliquet. Cras vehicula odio non enim euismod nec congue lorem varius. Sed eu libero arcu, eget tempus augue. Vivamus varius risus ac libero sagittis eu ultricies lectus consequat. Integer gravida accumsan fermentum. Morbi erat ligula, volutpat non accumsan sed, pellentesque quis purus. Vestibulum vestibulum tincidunt lectus non pellentesque. Quisque porttitor sollicitudin tellus, id porta velit interdum sit amet. Cras quis sem orci, vel convallis magna. Pellentesque congue, libero et iaculis volutpat, enim turpis sodales dui, lobortis pharetra lectus dolor at sem. Nullam aliquam, odio ac laoreet vulputate, ligula nunc euismod leo, vel bibendum magna leo ut orci. In tortor turpis, pellentesque nec cursus ut, consequat non ipsum. Praesent venenatis, leo in pulvinar pharetra, eros nisi convallis elit, vitae luctus magna velit ut lorem."

    var style = document.getElementById("style");
//    alert("js: setStyleSheet");
//    alert("style = "+style);
//    alert("selector = "+selector);
//    alert("cssText = "+cssText);

    while (style.firstChild != null)
        style.removeChild(style.firstChild);
    while (document.body.firstChild != null)
        document.body.removeChild(document.body.firstChild);
    
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
