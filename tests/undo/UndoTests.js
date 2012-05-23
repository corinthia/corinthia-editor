function testUndo(versions,node)
{
    var numSteps = UndoManager_getLength();

    var back1 = new Array();
    var forwards2 = new Array();
    var back2 = new Array();

    var expected = new Array();
    for (var i = 0; i < versions.length; i++)
        expected.push(PrettyPrinter.getHTML(versions[i]));

    for (var i = 0; i < numSteps; i++) {
        UndoManager_undo();
        PostponedActions_perform();
        var version = versions.length-2-i;
        if (PrettyPrinter.getHTML(node) == expected[version])
            back1.push(DOM_createTextNode(document,"First undo to version "+version+": OK"));
        else
            back1.push(DOM_createTextNode(document,"First undo to version "+version+": INVALID"));
    }

    for (var i = 0; i < numSteps; i++) {
        UndoManager_redo();
        PostponedActions_perform();
        var version = i+1;
        if (PrettyPrinter.getHTML(node) == expected[version])
            forwards2.push(DOM_createTextNode(document,"Redo to version "+version+": OK"));
        else
            forwards2.push(DOM_createTextNode(document,"Redo to version "+version+": INVALID"));
    }

    for (var i = 0; i < numSteps; i++) {
        UndoManager_undo();
        PostponedActions_perform();
        var version = versions.length-2-i;
        if (PrettyPrinter.getHTML(node) == expected[version])
            back2.push(DOM_createTextNode(document,"Second undo to version "+version+": OK"));
        else
            back2.push(DOM_createTextNode(document,"Second undo to version "+version+": INVALID"));
    }

    var initialLength = versions.length;

    Array.prototype.push.apply(versions,back1);
    Array.prototype.push.apply(versions,forwards2);
    Array.prototype.push.apply(versions,back2);

    Outline_removeListeners(); // prevent it from adding number spans etc.
    DOM_deleteAllChildren(document.body);
    for (var i = 0; i < versions.length; i++) {
        if (i < initialLength) {
            var str = "==================== Version "+i+" ====================";
            DOM_appendChild(document.body,DOM_createTextNode(document,str));
        }
        else if (i == initialLength) {
            var str = "===================================================";
            DOM_appendChild(document.body,DOM_createTextNode(document,str));
        }
        DOM_appendChild(document.body,versions[i]);
    }
}
