var editor = {
    debug: function(str) { console.log(str); },
    getHTMLError: function(message) {},
    getHTMLResponse: function(html) {},
    jsInterfaceInitError: function(error) {alert("js init error: "+error);},
    jsInterfaceInitFinished: function() {},
    reportStyle: function(style) {},
    reportFormatting: function(str) {},
    sectionAdded: function(name,id,level,prevId) {},
    sectionRemoved: function(id) {},
    updateSectionName: function(id,name) {},
    setOutline: function(jsonOutline) {},
    setStyles2: function(jsonStyles) {},
    setStyles: function(jsonStyles) {}
}

var left;
var right;
var leftLoadedContinuation = null;
var results = new Object();

function Result(actual,expected)
{
    this.actual = actual;
    this.expected = expected;
}

function readFile(filename)
{
    var req = new XMLHttpRequest();
    req.open("GET",filename,false);
    req.send();
    return req.responseText;
}

function loadTestIndex()
{
    window.eval(readFile("index.js"));
}

function showTest(dir,name)
{
    leftLoadedContinuation = function() {
        setLeftTitle("Working area");
        setRightTitle("Result");
        left.contentWindow.performTest();
        left.contentWindow.clearSelection();
        setPanelText(right,getHTML(left.contentDocument.documentElement));
    }
    left.src = dir+"/"+name+"-input.html";
}

function showResult(dirname,filename)
{
    var fullname = dirname+"-"+filename;
    setLeftTitle("Actual result for "+dirname+"/"+filename);
    setRightTitle("Expected result for "+dirname+"/"+filename);
    setPanelText(left,results[fullname].actual);
    setPanelText(right,results[fullname].expected);
}

function setLeftTitle(title)
{
    document.getElementById("leftTitle").firstChild.nodeValue = title;
}

function setRightTitle(title)
{
    document.getElementById("rightTitle").firstChild.nodeValue = title;
}

function clearPanel(panel)
{
    panel.contentDocument.open();
    panel.contentDocument.close();
}

function setPanelText(panel,text)
{
    clearPanel(panel);
    var pre = panel.contentDocument.createElement("PRE");
    panel.contentDocument.body.appendChild(pre);
    pre.appendChild(right.contentDocument.createTextNode(text));
}

function getHTML(root)
{
    var copy = root.cloneNode(true);
    for (var body = copy.firstChild; body != null; body = body.nextSibling) {
        if (body.nodeName == "BODY") {
            body.removeAttribute("style");
            body.removeAttribute("contentEditable");
        }
    }

    var builder = new left.contentWindow.StringBuilder();
    prettyPrint(builder,copy,"");
    return builder.str;
}

function trim(str)
{
    var start = 0;
    var end = str.length;

    while ((start < str.length) &&
           ((str.charAt(start) == " ") ||
            (str.charAt(start) == "\t") ||
            (str.charAt(start) == "\r") ||
            (str.charAt(start) == "\n")))
        start++;

    while ((end > start) &&
           ((str.charAt(end-1) == " ") ||
            (str.charAt(end-1) == "\t") ||
            (str.charAt(end-1) == "\r") ||
            (str.charAt(end-1) == "\n")))
        end--;

    return str.slice(start,end);
}

function singleDescendents(node)
{
    var count = 0;
    for (var child = node.firstChild; child != null; child = child.nextSibling) {
        if ((child.nodeType == Node.TEXT_NODE) && (trim(child.nodeValue).length == 0))
            continue;
        count++;
        if (count > 1)
            return false;
        if (!singleDescendents(child))
            return false;
    }
    return true;
}

function attributeString(node)
{
    var names = new Array();
    for (var i = 0; i < node.attributes.length; i++) {
        names.push(node.attributes[i].nodeName);
    }
    names.sort();
    var str = "";
    for (var i = 0; i < names.length; i++) {
        str += " "+names[i]+"=\""+node.getAttribute(names[i])+"\"";
    }
    return str;
}

function prettyPrintOneLine(builder,node)
{
    if ((node.nodeType == Node.ELEMENT_NODE) && (node.nodeName != "SCRIPT")) {
        var name = node.nodeName.toLowerCase();
        if (node.firstChild == null) {
            builder.str += "<" + name + attributeString(node) + "/>";
        }
        else {
            builder.str += "<" + name + attributeString(node) + ">";
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                prettyPrintOneLine(builder,child);
            builder.str += "</" + name + ">";
        }
    }
    else if (node.nodeType == Node.TEXT_NODE) {
        var value = trim(node.nodeValue);
        if (value.length > 0)
            builder.str += value;
    }
    else if (node.nodeType == Node.COMMENT_NODE) {
        builder.str += "<!--" + node.nodeValue + "-->\n";
    }
}

function prettyPrint(builder,node,indent)
{
    if ((node.nodeType == Node.ELEMENT_NODE) && (node.nodeName != "SCRIPT")) {
        var name = node.nodeName.toLowerCase();
        if (node.firstChild == null) {
            builder.str += indent + "<" + name + attributeString(node) + "/>\n";
        }
        else {
            if (singleDescendents(node)) {
                builder.str += indent;
                prettyPrintOneLine(builder,node);
                builder.str += "\n";
            }
            else {
                builder.str += indent + "<" + name + attributeString(node) + ">\n";
                for (var child = node.firstChild; child != null; child = child.nextSibling)
                    prettyPrint(builder,child,indent+"  ");
                builder.str += indent + "</" + name + ">\n";
            }

        }
    }
    else if (node.nodeType == Node.TEXT_NODE) {
        var value = trim(node.nodeValue);
        if (value.length > 0)
            builder.str += indent + value + "\n";
    }
    else if (node.nodeType == Node.COMMENT_NODE) {
        builder.str += indent + "<!--" + node.nodeValue + "-->\n";
    }
}

function readJSCode(filename)
{
    var req = new XMLHttpRequest();
    req.open("GET",filename,false);
    req.send();
    return req.responseText;
}

function leftLoaded()
{
    if (leftLoadedContinuation == null)
        return;
    var continuation = leftLoadedContinuation;
    leftLoadedContinuation = null;

    left.contentWindow.editor = editor;
    left.contentWindow.debug = editor.debug;

    // Sync with Editor.m
    var javascriptFiles = ["nulleditor.js", // must be first
                           "../src/Cursor.js",
                           "../src/dtd.js",
                           "../src/ElementProxy.js",
                           "../src/ElementProxyMap.js",
                           "../src/Formatting.js",
                           "../src/Lists.js",
                           "../src/mutation.js",
                           "../src/Outline.js",
                           "../src/Position.js",
                           "../src/Range.js",
                           "../src/StringBuilder.js",
                           "../src/Structure.js",
                           "../src/Styles.js",
                           "../src/traversal.js",
                           "../src/types.js",
                           "../src/util.js",
                           "../src/Viewport.js",
                           "../src/Selection.js",
                           "../src/init.js"]; // must be last
    for (var i = 0; i < javascriptFiles.length; i++)
        left.contentWindow.eval(readJSCode(javascriptFiles[i]));

    left.contentWindow.eval(readJSCode("testlib.js"));

    var selStart = left.contentDocument.getElementById("selStart");
    var selEnd = left.contentDocument.getElementById("selEnd");
    var cursor = left.contentDocument.getElementById("cursor");

    if ((selStart != null) && (selEnd == null))
        throw new Error("selStart specified, but not selEnd");
    if ((selStart == null) && (selEnd != null))
        throw new Error("selEnd specified, but not selStart");

    if ((selStart != null) && (selEnd != null)) {
        var start = getPosition(selStart);
        var end = getPosition(selEnd);
        if (start == null)
            throw new Error("Could not find text node for selStart");
        if (end == null)
            throw new Error("Could not find text node for selEnd");

        var range = new left.contentWindow.Range(start.node,start.offset,end.node,end.offset);

        range.trackWhileExecuting(function() {
            selStart.parentNode.removeChild(selStart);
            selEnd.parentNode.removeChild(selEnd);
            positionMergeWithNeighbours(start);
            positionMergeWithNeighbours(end);
        });

        left.contentWindow.setSelectionRange(range);
    }
    continuation();

    return;

    function positionMergeWithNeighbours(pos)
    {
        var node = pos.node;
        var offset = pos.offset;
        if ((node.nodeType == Node.ELEMENT_NODE) && (offset < node.childNodes.length))
            left.contentWindow.mergeWithNeighbours(node.childNodes[offset]);
        else if ((node.nodeType == Node.ELEMENT_NODE) && (node.lastChild != null))
            left.contentWindow.mergeWithNeighbours(node.lastChild);
        else
            left.contentWindow.mergeWithNeighbours(node);
    }

    function getPosition(node)
    {
        var offset = left.contentWindow.getOffsetOfNodeInParent(node);
        return new left.contentWindow.Position(node.parentNode,offset);
    }
}

function runAllTests()
{
    var dirno = 0;
    var fileno = 0;
    var haveTest = false;
    var dirname;
    var filename;

    var passes = 0;
    var failures = 0;

    setLeftTitle("Working area");
    setRightTitle("");

    clearPanel(right);
    results = new Object();

    runNextTest();
    return;

    function updateStatistics()
    {
        var statistics = document.getElementById("statistics");
        while (statistics.firstChild != null)
            statistics.removeChild(statistics.firstChild);
        var str = "Passes: "+passes+", Failures: "+failures;
        statistics.appendChild(document.createTextNode(str));
    }

    function runNextTest()
    {
        if (haveTest) {
            var expected = readFile(dirname+"/"+filename+"-expected.html");

            var actual;
            try {
                left.contentWindow.performTest();
                left.contentWindow.clearSelection();
                actual = getHTML(left.contentDocument.documentElement);
            }
            catch (e) {
                actual = e.toString();
            }

            actual = trim(actual);
            expected = trim(expected);

            var fullname = dirname+"-"+filename;
            var resultElement = document.getElementById("result-"+fullname);
            while (resultElement.firstChild != null)
                resultElement.removeChild(resultElement.firstChild);
            var a = document.createElement("a");
            a.href = "javascript:showResult('"+dirname+"','"+filename+"')";
            resultElement.appendChild(a);
            results[fullname] = new Result(actual,expected);
            if (actual == expected) {
                resultElement.setAttribute("class","pass");
                a.appendChild(document.createTextNode("PASS"));
                passes++;
            }
            else {
                resultElement.setAttribute("class","fail");
                a.appendChild(document.createTextNode("FAIL"));
                failures++;
            }
            updateStatistics();
        }
        if (dirno < tests.length) {
            var dir = tests[dirno];
            dirname = dir.dir;
            filename = dir.files[fileno];
            incrementPosition();
            leftLoadedContinuation = runNextTest;
            haveTest = true;
            left.src = dirname+"/"+filename+"-input.html";
        }
    }

    function incrementPosition()
    {
        fileno++;
        if (fileno == tests[dirno].files.length) {
            dirno++;
            fileno = 0;
        }
    }
}

function loaded()
{
    var top = document.getElementById("topInner");
    left = document.getElementById("leftInner");
    right = document.getElementById("rightInner");
    loadTestIndex();

    var table = document.createElement("table");
    top.appendChild(table);

    for (var dirno = 0; dirno < tests.length; dirno++) {
        var dir = tests[dirno];

        var tr = document.createElement("tr");
        table.appendChild(tr);
        tr.setAttribute("class","dirrow");
        table.setAttribute("width","100%");

        var td = document.createElement("td");
        tr.appendChild(td);
        td.setAttribute("colspan","2");
        td.appendChild(document.createTextNode(dir.dir));

        for (var fileno = 0; fileno < dir.files.length; fileno++) {
            var filename = dir.files[fileno];

            tr = document.createElement("tr");
            table.appendChild(tr);
            tr.setAttribute("class","testrow");

            td = document.createElement("td");
            tr.appendChild(td);
            td.setAttribute("width","50%");

            var a = document.createElement("a");
            td.appendChild(a);
            a.href = "javascript:showTest('"+dir.dir+"','"+filename+"')";
            a.appendChild(document.createTextNode(filename));

            td = document.createElement("td");
            tr.appendChild(td);
            td.setAttribute("width","50%");
            td.id = "result-"+dir.dir+"-"+filename;
        }
    }
}
