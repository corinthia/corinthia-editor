function findBody(html)
{
    var body = html.firstChild;
    while ((body != null) && (DOM_upperName(body) != "BODY"))
        body = body.nextSibling;
    return body;
}

function updateDisplayedContent(html)
{
    DOM_deleteAllChildren(document.body);
    var body = findBody(html);
    while (body.firstChild != null)
        DOM_appendChild(document.body,body.firstChild);
}

function wordTest(filename,transformFun)
{
    Word_initWord("extracted/"+filename);
    var html = Word_getHTML();
    var result = new Array();

    result.push(serializeHTML(html));

    var body = findBody(html);
    if (body == null)
        throw new Error("Can't find body");
    transformFun(html,body);
    var htmlText2 = serializeHTML(html);
    result.push(htmlText2);

    Word_putHTML(html);

    html = Word_getHTML();
    var htmlText3 = serializeHTML(html);
    result.push("reconstructed HTML same? "+(htmlText2 == htmlText3)+"\n");

    updateDisplayedContent(html);
//    result.push(htmlText3);

    var wordDocument = Word_document();
    result.push(PrettyPrinter.getHTML(wordDocument.documentElement,
                                      { preserveCase: true, separateLines: true }));

    return result.join("\n");

    function serializeHTML(node)
    {
        return PrettyPrinter.getHTML(node,{ separateLines: true });
    }
}
