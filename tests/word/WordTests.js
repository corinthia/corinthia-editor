function wordTest(filename,transformFun)
{
    Word_initWord("extracted/"+filename);
    var html = Word_getHTML();
    var result = new Array();

    var html1 = serializeHTML(html);
    result.push(html1);

    transformFun(html);
    var html2 = serializeHTML(html);
    result.push(html2);

    Word_putHTML(html);

    html = Word_getHTML();
    var html3 = serializeHTML(html);
    result.push("reconstructed HTML same? "+(html2 == html3)+"\n");

    var wordDocument = Word_document();
    result.push(PrettyPrinter.getHTML(wordDocument.documentElement,
                                      { preserveCase: true, separateLines: true }));

    return result.join("\n");

    function serializeHTML(node)
    {
        return PrettyPrinter.getHTML(node,{ separateLines: true });
    }
}
