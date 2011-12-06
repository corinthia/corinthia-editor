var nextOutlineSectionId = 0;

function getOutline()
{
    var found = 0;
    var list = new Array();
    for (var child = document.body.firstChild; child != null; child = child.nextSibling) {
        var name = child.nodeName;
        if (isHeadingElement(child)) {
            list.push({"sectionId": "section"+nextOutlineSectionId,
                       "level": parseInt(name.slice(1)),
                       "name": getNodeText(child) });

            child.setAttribute("id","section"+nextOutlineSectionId);
            nextOutlineSectionId++;
            found++;
        }
    }
    editor.setOutline(list);
}
