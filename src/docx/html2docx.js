// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

(function() {

    var TYPES_NAMESPACE = "http://schemas.openxmlformats.org/package/2006/content-types";

    // [Content_Types].xml
    function ContentTypes()
    {
        this.doc = document.implementation.createDocument(TYPES_NAMESPACE,"Types");
    }

    ContentTypes.prototype.addDefaultExtension = function(name,type)
    {
        var elem = DOM_createElementNS(this.doc,TYPES_NAMESPACE,"Default");
        elem.setAttribute("Extension",name);
        elem.setAttribute("ContentType",type);
        DOM_appendChild(this.doc.documentElement,elem);
    }

    ContentTypes.prototype.addFile = function(name,type)
    {
        var elem = DOM_createElementNS(this.doc,TYPES_NAMESPACE,"Override");
        elem.setAttribute("PartName",name);
        elem.setAttribute("ContentType",type);
        DOM_appendChild(this.doc.documentElement,elem);
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
        var elem = DOM_createElementNS(this.doc,RELATIONSHIPS_NAMESPACE,"Relationship");
        elem.setAttribute("Id","rId"+(this.nextId++));
        elem.setAttribute("Type",type);
        elem.setAttribute("Target",target);
        DOM_appendChild(this.doc.documentElement,elem);
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

        var wordBody = DOM_createElementNS(wordDoc,WORD_NAMESPACE,"w:body");
        wordDoc.documentElement.setAttribute("xmlns:w",WORD_NAMESPACE);
        DOM_appendChild(wordDoc.documentElement,wordBody);

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
                    DOM_deleteNode(lastRun);
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
                        var text = DOM_createTextNode(wordDoc,str);
                        var t = DOM_createElementNS(wordDoc,WORD_NAMESPACE,"w:t");
                        var r = DOM_createElementNS(wordDoc,WORD_NAMESPACE,"w:r");

                        var runProperties = new DocxRunProperties();
                        runProperties.fromHTML(node);
                        var rPr = runProperties.toXML(wordDoc);
                        if (rPr != null)
                            DOM_appendChild(r,rPr);

                        DOM_appendChild(t,text);
                        DOM_appendChild(r,t);
                        DOM_appendChild(p,r);

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
                var wordTr = DOM_createElementNS(wordDoc,WORD_NAMESPACE,"w:tr");
                DOM_appendChild(wordTbl,wordTr);

                var col = 0;
                while (col < info.numCols) {
                    var wordTc = DOM_createElementNS(wordDoc,WORD_NAMESPACE,"w:tc");
                    var wordTcPr = DOM_createElementNS(wordDoc,WORD_NAMESPACE,"w:tcPr");
                    DOM_appendChild(wordTr,wordTc);
                    DOM_appendChild(wordTc,wordTcPr);

                    var cell = info.get(row,col);
                    if (cell == null) {
                        col++;
                    }
                    else {
                        if (cell.colspan > 1) {
                            var wordGridSpan = DOM_createElementNS(wordDoc,WORD_NAMESPACE,
                                                                   "w:gridSpan");
                            wordGridSpan.setAttributeNS(WORD_NAMESPACE,"w:val",cell.colspan);
                            DOM_appendChild(wordTcPr,wordGridSpan);
                        }

                        var buildContents = true;
                        if (cell.rowspan > 1) {
                            var wordVMerge = DOM_createElementNS(wordDoc,WORD_NAMESPACE,"w:vMerge");
                            DOM_appendChild(wordTcPr,wordVMerge);
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
                            var wordP = DOM_createElementNS(wordDoc,WORD_NAMESPACE,"w:p");
                            DOM_appendChild(wordTc,wordP);
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
                if (DOM_upperName(child) == "SCRIPT")
                    continue;

                if (DOM_upperName(child) == "TABLE") {
                    var tbl = DOM_createElementNS(wordDoc,WORD_NAMESPACE,"w:tbl");
                    DOM_appendChild(body,tbl);
                    buildTable(child,tbl);
                }

                p = DOM_createElementNS(wordDoc,WORD_NAMESPACE,"w:p");
                DOM_appendChild(body,p);
                buildParagraph(child,p);

                if (DOM_upperName(child) == "P")
                    p = null;
            }
        }

    }
})();
