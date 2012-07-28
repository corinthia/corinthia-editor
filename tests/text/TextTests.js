function showRuns()
{
    var range = Selection_get();
    var paragraph = Text_analyseParagraph(range.start);
    var runs = paragraph.runs;
    var lines = new Array();
    for (var i = 0; i < runs.length; i++) {

        var elementNames = new Array();
        for (var anc = runs[i].node.parentNode; anc != paragraph.node; anc = anc.parentNode) {
            elementNames.push(DOM_upperName(anc)+" ");
        }

        lines.push("Run "+i+" ("+runs[i].start+"): "+
                   elementNames.reverse().join("")+
                   JSON.stringify(runs[i].node.nodeValue));
    }
    lines.push("");
    lines.push("Text: "+JSON.stringify(paragraph.text));
    return lines.join("\n");
}
