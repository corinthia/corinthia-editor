function testNext()
{
    var result = new Array();
    Scan_reset();
    var index = 0;
    while (true) {
        var paragraph = Scan_next();
        if (paragraph == null)
            break;
        if (paragraph.sectionId != null)
            result.push(index+" ("+paragraph.sectionId+"): "+JSON.stringify(paragraph.text));
        else
            result.push(index+": "+JSON.stringify(paragraph.text));
        index++;
    }
    return result.join("\n");
}
