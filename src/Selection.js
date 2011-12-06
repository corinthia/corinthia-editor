var captured = null;

function updateSelection(x,y)
{
    var range = document.caretRangeFromPoint(x,y);
    if (range == null) // Can happen if pointer is outside of WebView
        return;

    captured.end = new Position(range.endContainer,range.endOffset);

    captured.selectWholeWords();

    captured.setSelection();
}

function newSelection(x,y)
{
    window.getSelection().empty();
    var range = document.caretRangeFromPoint(x,y);

    captured = new Range(new Position(range.startContainer,range.startOffset),
                         new Position(range.startContainer,range.startOffset));

    captured.start.moveToStartOfWord();
    captured.end.moveToEndOfWord();

    captured.setSelection();
}

function finishSelection()
{
    reportSelectionFormatting();
}

function emptySelection()
{
    window.getSelection().empty();
}

function disableEditing()
{
    document.body.contentEditable = false;
}

function enableEditing()
{
    document.body.contentEditable = true;
}

function scrollToCursor()
{
    var node = window.getSelection().focusNode;
    if (node != null) {
        var position = getAbsolutePosition(node);
        window.scrollTo(0,position.y);
    }

    function getAbsolutePosition(node)
    {
        var x = 0;
        var y = 0;
        for (; node != null; node = node.parentNode) {
            if ((node.offsetLeft != null) && (node.offsetTop != null)) {
                x += node.offsetLeft;
                y += node.offsetTop;
            }
        }
        return { x: x, y: y };
    }
}
