// FIXME: in some places we use the w: prefix when creating elements. Need to make sure we use
// whatever prefix is in the XML file instead

var WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function print(str)
{
    var pre = DOM_createElement(document,"PRE");
    var text = DOM_createTextNode(document,str);
    DOM_appendChild(pre,text);
    DOM_appendChild(document.body,pre);
}

function debug(str)
{
    console.log(str);
}

function transform(abs)
{
    var body = firstChildNamed(abs,"BODY");
//    DOM_insertBefore(body,body.childNodes[4],body.childNodes[0]);


/*
    body.childNodes[0].style.textAlign = "left";
    body.childNodes[1].style.textAlign = "right";
    body.childNodes[2].style.textAlign = "left";
    body.childNodes[3].style.textAlign = "justify";
    body.childNodes[4].style.textAlign = "right";

    body.childNodes[0].style.textAlign = null;
    body.childNodes[1].style.textAlign = null;
    body.childNodes[2].style.textAlign = null;
    body.childNodes[3].style.textAlign = null;
    body.childNodes[4].style.textAlign = null;
*/


    var value = null;

    DOM_setStyleProperties(body.childNodes[0],{"text-align": value});
    DOM_setStyleProperties(body.childNodes[1],{"text-align": value});
    DOM_setStyleProperties(body.childNodes[2],{"text-align": value});
    DOM_setStyleProperties(body.childNodes[3],{"text-align": value});
    DOM_setStyleProperties(body.childNodes[4],{"text-align": value});

}


/*
function main()
{
    DOM_assignNodeIds(document.documentElement);
    print("Conversion");

    var baseFilename = "test1";
    var printOptions = { preserveCase: true };

    var wordDocument = readXML(baseFilename+"/word/document.xml");
    assignShorthandProperties(wordDocument.documentElement);
    var documentLens = new DocumentLens();

    var abs = documentLens.get(wordDocument.documentElement);
    print(PrettyPrinter.getHTML(abs,printOptions));

    transform(abs);
    print(PrettyPrinter.getHTML(abs));

    documentLens.put(abs,wordDocument.documentElement);

    removeAttributes(wordDocument.documentElement,
                     ["w14:paraId","w14:textId","w:rsidP","w:rsidR","w:rsidRDefault",
                      "mc:Ignorable","w:rsidRPr","w:rsidSect"]);
    print(PrettyPrinter.getHTML(wordDocument.documentElement,printOptions));
}
*/

function main()
{
    DOM_assignNodeIds(document.documentElement);
    Word_initWord("test1/word");
    var html = Word_getHTML();
    print(PrettyPrinter.getHTML(html));
    var body = html.firstChild;
//    print(nodeString(body));
    DOM_insertBefore(body,body.childNodes[4],body.childNodes[1]);
    print(PrettyPrinter.getHTML(html));
    Word_putHTML(html);

    var wordDocument = Word_document();
    print(PrettyPrinter.getHTML(wordDocument.documentElement));
}
