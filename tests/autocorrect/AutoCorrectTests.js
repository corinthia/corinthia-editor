function findTextMatching(re)
{
    return recurse(document.body);

    function recurse(node)
    {
        if (node.nodeType == Node.TEXT_NODE) {
            if (node.nodeValue.match(re))
                return node;
            else
                return null;
        }
        else {
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                var result = recurse(child);
                if (result != null)
                    return result;
            }
            return null;
        }
    }
}

function showCorrections()
{
    var corrections = AutoCorrect_getCorrections();
    var lines = new Array();
    lines.push("Corrections:\n");
    for (var i = 0; i < corrections.length; i++) {
        lines.push("    "+corrections[i].original+" -> "+corrections[i].replacement+"\n");
    }
    return PrettyPrinter.getHTML(document.documentElement)+"\n"+lines.join("");
}
