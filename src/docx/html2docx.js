(function() {

    var TYPES_NAMESPACE = "http://schemas.openxmlformats.org/package/2006/content-types";

    // [Content_Types].xml
    function ContentTypes()
    {
        this.doc = document.implementation.createDocument(TYPES_NAMESPACE,"Types");
    }

    ContentTypes.prototype.addDefaultExtension = function(name,type)
    {
        var elem = this.doc.createElementNS(TYPES_NAMESPACE,"Default");
        elem.setAttribute("Extension",name);
        elem.setAttribute("ContentType",type);
        this.doc.documentElement.appendChild(elem);
    }

    ContentTypes.prototype.addFile = function(name,type)
    {
        var elem = this.doc.createElementNS(TYPES_NAMESPACE,"Override");
        elem.setAttribute("PartName",name);
        elem.setAttribute("ContentType",type);
        this.doc.documentElement.appendChild(elem);
    }

    ContentTypes.prototype.toString = function()
    {
        return new XMLSerializer().serializeToString(this.doc);
    }


    var RELATIONSHIPS_NAMESPACE = "http://schemas.openxmlformats.org/package/2006/relationships";

    function Relationships()
    {
        this.doc = document.implementation.createDocument(RELATIONSHIPS_NAMESPACE,"Relationships");
        this.nextId = 1;
    }

    Relationships.prototype.add = function(type,target)
    {
        var elem = this.doc.createElementNS(RELATIONSHIPS_NAMESPACE,"Relationship");
        elem.setAttribute("Id","rId"+(this.nextId++));
        elem.setAttribute("Type",type);
        elem.setAttribute("Target",target);
        this.doc.documentElement.appendChild(elem);
    }

    Relationships.prototype.toString = function()
    {
        return new XMLSerializer().serializeToString(this.doc);
    }

    window.html2docx = function(filename)
    {
        filesystem.remove(filename+"/word/document.xml");
        filesystem.remove(filename+"/[Content_Types].xml");
        filesystem.remove(filename+"/_rels/.rels");
        filesystem.remove(filename+".docx");

        filesystem.remove(filename+"/docProps");
        filesystem.remove(filename+"/word/_rels");
        filesystem.remove(filename+"/word");
        filesystem.remove(filename+"/_rels");
        filesystem.remove(filename);


        filesystem.mkdir(filename);
        filesystem.mkdir(filename+"/_rels");
        filesystem.mkdir(filename+"/word");
        filesystem.mkdir(filename+"/word/_rels");
        filesystem.mkdir(filename+"/docProps");



        var wordDoc = document.implementation.createDocument(WORD_NAMESPACE,
                                                             "w:document");

        var wordBody = wordDoc.createElementNS(WORD_NAMESPACE,"w:body");
        wordDoc.documentElement.setAttribute("xmlns:w",WORD_NAMESPACE);
        wordDoc.documentElement.appendChild(wordBody);

        buildContainer(document.body,wordBody);

        var documentXML = new XMLSerializer().serializeToString(wordDoc);
        filesystem.write(filename+"/word/document.xml",documentXML);

        // [Content_Types].xml
        var contentTypes = new ContentTypes();
        contentTypes.addDefaultExtension("xml","application/xml");
        contentTypes.addDefaultExtension("rels","application/vnd.openxmlformats-"+
                                         "package.relationships+xml");
        contentTypes.addDefaultExtension("jpeg","image/jpeg");
        contentTypes.addFile("/word/document.xml","application/vnd.openxmlformats-"+
                             "officedocument.wordprocessingml.document.main+xml");
        filesystem.write(filename+"/[Content_Types].xml",contentTypes.toString());

        // _rels/.rels
        var relationships = new Relationships();
        relationships.add("http://schemas.openxmlformats.org/officeDocument/2006/"+
                          "relationships/officeDocument","word/document.xml");
        filesystem.write(filename+"/_rels/.rels",relationships.toString());

        filesystem.mkdocx(filename);

        // Note: Before doing this conversion, we must ensure that the following constraints on the
        // HTML document hold:
        // - All text is inside a P or TABLE node

        function isWhitespace(str)
        {
            for (var i = 0; i < str.length; i++) {
                var c = str.charAt(i);
                if ((c != " ") && (c != "\t") && (c != "\r") && (c != "\n"))
                    return false;
            }
            return true;
        }

        function buildParagraph(node,p)
        {
            var lastCharWhitespace = true;
            var lastRun = null;

            recurse(node);

            if ((lastCharWhitespace) && (lastRun != null)) {
                var str = lastRun.lastChild.lastChild.nodeValue;
                if (str.length == 1) {
                    p.removeChild(lastRun);
                }
                else {
                    str = str.substring(0,str.length-1);
                    lastRun.lastChild.lastChild.nodeValue = str;
                }
            }

            function recurse(node)
            {
                if (node.nodeType == Node.TEXT_NODE) {
                    var str = node.nodeValue;
                    str = str.replace(/\s+/g," ");

                    if (lastCharWhitespace && (str.length > 0) && (str.charAt(0) == " "))
                        str = str.substring(1);

                    if (str.length > 0) {
                        var text = wordDoc.createTextNode(str);
                        var t = wordDoc.createElementNS(WORD_NAMESPACE,"w:t");
                        var r = wordDoc.createElementNS(WORD_NAMESPACE,"w:r");

                        var runProperties = new DOCXRunProperties();
                        runProperties.fromHTML(node);
                        var rPr = runProperties.toXML(wordDoc);
                        if (rPr != null)
                            r.appendChild(rPr);

                        t.appendChild(text);
                        r.appendChild(t);
                        p.appendChild(r);

                        lastCharWhitespace = (str.charAt(str.length-1) == " ");
                        lastRun = r;

                        if ((str.charAt(0) == " ") || (str.charAt(str.length-1) == " "))
                            t.setAttribute("xml:space","preserve");
                    }
                }

                for (var child = node.firstChild; child != null; child = child.nextSibling)
                    recurse(child,p);
            }
        }

        function buildTable(htmlTable,wordTbl)
        {
            var info = new htmltable.Table(htmlTable);
            for (var row = 0; row < info.numRows; row++) {
                var wordTr = wordDoc.createElementNS(WORD_NAMESPACE,"w:tr");
                wordTbl.appendChild(wordTr);

                var col = 0;
                while (col < info.numCols) {
                    var wordTc = wordDoc.createElementNS(WORD_NAMESPACE,"w:tc");
                    var wordTcPr = wordDoc.createElementNS(WORD_NAMESPACE,"w:tcPr");
                    wordTr.appendChild(wordTc);
                    wordTc.appendChild(wordTcPr);

                    var cell = info.get(row,col);
                    if (cell == null) {
                        col++;
                    }
                    else {
                        if (cell.colspan > 1) {
                            var wordGridSpan = wordDoc.createElementNS(WORD_NAMESPACE,"w:gridSpan");
                            wordGridSpan.setAttributeNS(WORD_NAMESPACE,"w:val",cell.colspan);
                            wordTcPr.appendChild(wordGridSpan);
                        }

                        var buildContents = true;
                        if (cell.rowspan > 1) {
                            var wordVMerge = wordDoc.createElementNS(WORD_NAMESPACE,"w:vMerge");
                            wordTcPr.appendChild(wordVMerge);
                            if (cell.startRow == row) {
                                wordVMerge.setAttributeNS(WORD_NAMESPACE,"w:val","restart");
                            }
                            else {
                                buildContents = false;
                            }
                        }

                        if (buildContents)
                            buildContainer(cell.element,wordTc);


                        var haveP = false;
                        for (var tcp = wordTc.firstChild; tcp != null; tcp = tcp.nextSibling) {
                            if (tcp.localName == "p") {
                                haveP = true;
                                break;
                            }
                        }
                        if (!haveP) {
                            var wordP = wordDoc.createElementNS(WORD_NAMESPACE,"w:p");
                            wordTc.appendChild(wordP);
                        }

                        col += cell.colspan;
                    }
                }
            }
        }

        function buildContainer(node,body)
        {
            var p = null;
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                if ((child.nodeType == Node.TEXT_NODE) && isWhitespace(child.nodeValue))
                    continue;
                if (child.nodeName == "SCRIPT")
                    continue;

                if (child.nodeName == "TABLE") {
                    var tbl = wordDoc.createElementNS(WORD_NAMESPACE,"w:tbl");
                    body.appendChild(tbl);
                    buildTable(child,tbl);
                }

                p = wordDoc.createElementNS(WORD_NAMESPACE,"w:p");
                body.appendChild(p);
                buildParagraph(child,p);

                if (child.nodeName == "P")
                    p = null;
            }
        }

    }
})();
