DOCXHTMLColor = function(docxColor)
{
    if (docxColor == "auto")
        return "black";
    else if (docxColor != null)
        return "#"+docxColor;
    else
        return null;
}
