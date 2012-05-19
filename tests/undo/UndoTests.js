function testUndo(versions,node)
{
    var numSteps = UndoManager_getLength();

    var backwards1 = new Array();
    var forwards2 = new Array();
    var backwards2 = new Array();

    var expected = new Array();
    for (var i = 0; i < versions.length; i++)
        expected.push(PrettyPrinter.getHTML(versions[i]));

    for (var i = 0; i < numSteps; i++) {
        UndoManager_undo();
        if (PrettyPrinter.getHTML(node) == expected[versions.length-2-i])
            backwards1.push(DOM_createTextNode(document,"OK"));
        else
            backwards1.push(DOM_createTextNode(document,"INVALID"));
        backwards1.push(DOM_cloneNode(node,true));
    }

    for (var i = 0; i < numSteps; i++) {
        UndoManager_redo();
        if (PrettyPrinter.getHTML(node) == expected[i+1])
            forwards2.push(DOM_createTextNode(document,"OK"));
        else
            forwards2.push(DOM_createTextNode(document,"INVALID"));
        forwards2.push(DOM_cloneNode(node,true));
    }

    for (var i = 0; i < numSteps; i++) {
        UndoManager_undo();
        if (PrettyPrinter.getHTML(node) == expected[versions.length-2-i])
            backwards2.push(DOM_createTextNode(document,"OK"));
        else
            backwards2.push(DOM_createTextNode(document,"INVALID"));
        backwards2.push(DOM_cloneNode(node,true));
    }

    Array.prototype.push.apply(versions,backwards1);
    Array.prototype.push.apply(versions,forwards2);
    Array.prototype.push.apply(versions,backwards2);

    Outline_removeListeners(); // prevent it from adding number spans etc.
    DOM_deleteAllChildren(document.body);
    for (var i = 0; i < versions.length; i++)
        DOM_appendChild(document.body,versions[i]);
}
