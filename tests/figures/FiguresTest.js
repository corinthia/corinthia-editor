function figurePropertiesString(index)
{
    var figure = document.getElementsByTagName("FIGURE")[0];
    var parent = figure.parentNode;
    var offset = DOM_nodeOffset(figure);
    Selection_hideWhileExecuting(function() {
        Selection_set(parent,offset,parent,offset+1);
    });
    var properties = Figures_getProperties(Figures_getSelectedFigureId());
    var strings = new Array();
    var names = Object.getOwnPropertyNames(properties).sort();
    for (var i = 0; i < names.length; i++) {
        var name = names[i];
        if (properties[name] == null)
            strings.push(name+" = null");
        else
            strings.push(name+" = "+properties[name]);
    }
    return strings.join("\n");
}
