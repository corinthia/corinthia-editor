function sectionTitleMaybeChanged(node)
{
    for (var p = node; p != null; p = p.parentNode) {
        if (isHeadingNode(p)) {
            var name = quoteString(getNodeText(p));
            editor.updateSectionName(p.getAttribute("id"),name);
            return;
        }
    }
}

function characterDataModified(e)
{
//    debug("characterDataModified");
    sectionTitleMaybeChanged(e.target);
    ensureValidHierarchy(e.target,true);
}

function isHeadingElement(node)
{
    var name = node.nodeName;
    return ((name.charAt(0) == "H") && (name.length == 2) &&
            (name.charAt(1) >= "1") && (name.charAt(1) <= "6"));
}

function nodeInserted(e)
{
//    if (e.target.nodeType == Node.TEXT_NODE) {
//        debug("nodeInserted "+e.target.nodeName+" \""+e.target.nodeValue+"\""+
//                     " (parent "+e.target.parentNode.nodeName+")");
//    }
//    else {
//        debug("nodeInserted "+e.target.nodeName+
//                     " (parent "+e.target.parentNode.nodeName+")");
//    }

    if (isHeadingElement(e.target)) {
        var name = e.target.nodeName;

        var sectionName = getNodeText(e.target);
        debug("new Section: "+sectionName);

        var level = parseInt(name.slice(1));

        var sectionId = "section"+nextOutlineSectionId;
        e.target.setAttribute("id",sectionId);
        nextOutlineSectionId++;

        var prevSection = findPreviousHeading(e.target);

        if (prevSection != null) {
            var prevSectionId = prevSection.getAttribute("id");
            editor.sectionAdded(quoteString(sectionName),sectionId,level,prevSectionId);
        }
        else {
            editor.sectionAdded(quoteString(sectionName),sectionId,level,"");
        }
    }
    else {
        if (e.target.nodeName == "#text")
            e.target.addEventListener("DOMCharacterDataModified",characterDataModified);

        sectionTitleMaybeChanged(e.target);
        ensureValidHierarchy(e.target,true);
    }

    function findPreviousHeading(node)
    {
        var prevHeading = node.previousSibling;
        while ((prevHeading != null) &&
               !isHeadingElement(prevHeading)) {
            prevHeading = prevHeading.previousSibling;
        }
        return prevHeading;
    }
}

function nodeRemoved(e)
{
//    debug("nodeRemoved "+e.target.nodeName);

    var name = e.target.nodeName;
    if (isHeadingElement(e.target)) {
        editor.sectionRemoved(e.target.getAttribute("id"));
    }
    else {
        sectionTitleMaybeChanged(e.target);
    }
}

function addMutationListeners(node)
{
    if ((node.nodeType == Node.ELEMENT_NODE) && (node.getAttribute("id") == "debug2"))
        return;
    var i;
    for (i = node.firstChild; i != null; i = i.nextSibling)
        addMutationListeners(i);
    if (node.nodeName == "#text") {
        node.addEventListener("DOMCharacterDataModified",characterDataModified);
    }
}

function setupMutation()
{
    addMutationListeners(document.body);
    document.addEventListener("DOMNodeInserted",nodeInserted);
    document.addEventListener("DOMNodeRemoved",nodeRemoved);
}
