// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var AutoCorrect_addEntry;
var AutoCorrect_changeEntry;
var AutoCorrect_startRemovingEntry;
var AutoCorrect_endRemovingEntry;

(function() {

    var nextId = 0;
    var entries = new Object();

    function AutoCorrectEntry(span)
    {
        this.span = span;
        this.entryId = nextId++;
    }

    // public
    function addEntry(word)
    {
        var span = DOM_createElement(document,"SPAN");
        span.setAttribute("class",Keys.AUTOCORRECT_ENTRY);
        span.style.backgroundColor = "#c0c0c0";
        DOM_appendChild(span,DOM_createTextNode(document,word));
        var entry = new AutoCorrectEntry(span);
        entries[entry.entryId] = entry;
        return entry.entryId;
    }

    // public
    function changeEntry(entryId,word)
    {
        var entry = entries[entryId];
        entry.span.firstChild.nodeValue = word;
    }

    // public
    function startRemovingEntry(entryId)
    {
        var entry = entries[entryId];
        entry.span.style.backgroundColor = "#f0f0f0";
    }

    // public
    function endRemovingEntry(entryId)
    {
        var entry = entries[entryId];
        DOM_removeNodeButKeepChildren(entry.span);
        delete entries[entryId];
    }

    AutoCorrect_addEntry = trace(addEntry);
    AutoCorrect_changeEntry = trace(changeEntry);
    AutoCorrect_startRemovingEntry = trace(startRemovingEntry);
    AutoCorrect_endRemovingEntry = trace(endRemovingEntry);

})();
