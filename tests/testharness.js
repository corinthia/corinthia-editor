var editor = {
    debug: function(str) { console.log(str); },
    getHTMLError: function(message) {},
    getHTMLResponse: function(html) {},
    jsInterfaceInitError: function(error) {alert("js init error: "+error);},
    jsInterfaceInitFinished: function() {},
    setOutline: function(outline) {},
    setStyles2: function(jsonStyles) {},
    setStyles: function(jsonStyles) {}
}

var topArea;
var leftArea;
var rightArea;
var leftLoadedContinuation = null;
var results = new Object();
var allCode = null;

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

function loadCode()
{
    // Sync with Editor.m
    var javascriptFiles = ["nulleditor.js", // must be first
                           "../src/cursor.js",
                           "../src/DOM.js",
//                           "../src/dtd.js",
                           "../src/formatting.js",
                           "../src/init.js",
                           "../src/lists.js",
                           "../src/NodeSet.js",
                           "../src/Position.js",
                           "../src/PostponedActions.js",
                           "../src/Range.js",
                           "../src/StringBuilder.js",
                           "../src/Structure.js",
                           "../src/styles.js",
                           "../src/traversal.js",
                           "../src/types.js",
                           "../src/UndoManager.js",
                           "../src/util.js",
                           "../src/viewport.js",
                           "../src/selection.js",
                           "testlib.js"]; // must be last
    var allCodeArray = new Array();
    for (var i = 0; i < javascriptFiles.length; i++)
        allCodeArray.push(readJSCode(javascriptFiles[i]));
    allCode = allCodeArray.join("\n");
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
        leftArea.contentWindow.performTest();
        leftArea.contentWindow.clearSelection();
        setPanelText(rightArea,PrettyPrinter.getHTML(leftArea.contentDocument.documentElement));
    }
    leftArea.src = dir+"/"+name+"-input.html";
}

function showResult(dirname,filename)
{
    var fullname = dirname+"-"+filename;
    setLeftTitle("Actual result for "+dirname+"/"+filename);
    setRightTitle("Expected result for "+dirname+"/"+filename);
    setPanelText(leftArea,results[fullname].actual);
    setPanelText(rightArea,results[fullname].expected);
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
    var pre = DOM.createElement(panel.contentDocument,"PRE");
    DOM.appendChild(panel.contentDocument.body,pre);
    DOM.appendChild(pre,DOM.createTextNode(rightArea.contentDocument,text));
}



function readJSCode(filename)
{
    var req = new XMLHttpRequest();
    req.open("GET",filename,false);
    req.send();
    return req.responseText;
}

function extractPositionFromCharacter(c)
{
    return recurse(leftArea.contentWindow.document.body);

    function recurse(node)
    {
        if (node.nodeType == Node.TEXT_NODE) {
            var index = node.nodeValue.indexOf(c);
            if (index >= 0) {
                var offsetInParent = leftArea.contentWindow.getOffsetOfNodeInParent(node);
                if (index == 0) {
                    node.nodeValue = node.nodeValue.substring(1);
                    return new leftArea.contentWindow.Position(node.parentNode,offsetInParent);
                }
                else if (index == node.nodeValue.length - 1) {
                    node.nodeValue = node.nodeValue.substring(0,node.nodeValue.length-1);
                    return new leftArea.contentWindow.Position(node.parentNode,offsetInParent+1);
                }
                else {
                    var rest = node.nodeValue.substring(index+1);
                    node.nodeValue = node.nodeValue.substring(0,index);
                    var restNode = DOM.createTextNode(document,rest);
                    DOM.insertBefore(node.parentNode,restNode,node.nextSibling);
                    return new leftArea.contentWindow.Position(node.parentNode,offsetInParent+1);
                }
            }
        }
        else {
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                var result = recurse(child);
                if (result != null)
                    return result;
            }
        }
        return null;
    }
}

function leftLoaded()
{
    if (leftLoadedContinuation == null)
        return;
    var continuation = leftLoadedContinuation;
    leftLoadedContinuation = null;

    leftArea.contentWindow.editor = editor;
    leftArea.contentWindow.debug = editor.debug;

    leftArea.contentWindow.eval(allCode);

    leftArea.contentWindow.DOM.assignNodeIds(leftArea.contentWindow.document);

    var start = extractPositionFromCharacter("[");
    var track = (start == null) ? [] : [start];
    var end;
    leftArea.contentWindow.Position.trackWhileExecuting(track,function() {
        end = extractPositionFromCharacter("]");
    });

    if ((start != null) && (end == null))
        throw new Error("Start of selection specified, but not end");
    if ((start == null) && (end != null))
        throw new Error("End of selection specified, but not start");

    if ((start != null) && (end != null)) {
        var range = new leftArea.contentWindow.Range(start.node,start.offset,end.node,end.offset);

        range.trackWhileExecuting(function() {
            positionMergeWithNeighbours(start);
            positionMergeWithNeighbours(end);
        });

        leftArea.contentWindow.setSelectionRange(range);
    }
    continuation();

    return;

    function positionMergeWithNeighbours(pos)
    {
        var node = pos.node;
        var offset = pos.offset;
        if ((node.nodeType == Node.ELEMENT_NODE) && (offset < node.childNodes.length))
            leftArea.contentWindow.mergeWithNeighbours(node.childNodes[offset]);
        else if ((node.nodeType == Node.ELEMENT_NODE) && (node.lastChild != null))
            leftArea.contentWindow.mergeWithNeighbours(node.lastChild);
        else
            leftArea.contentWindow.mergeWithNeighbours(node);
    }

    function getPosition(node)
    {
        var offset = leftArea.contentWindow.getOffsetOfNodeInParent(node);
        return new leftArea.contentWindow.Position(node.parentNode,offset);
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

    clearPanel(rightArea);
    results = new Object();

    runNextTest();
    return;

    function updateStatistics()
    {
        var statistics = document.getElementById("statistics");
        DOM.deleteAllChildren(statistics);
        var str = "Passes: "+passes+", Failures: "+failures;
        DOM.appendChild(statistics,DOM.createTextNode(document,str));
    }

    function runNextTest()
    {
        if (haveTest) {
            var expected = readFile(dirname+"/"+filename+"-expected.html");

            var actual;
            try {
                leftArea.contentWindow.performTest();
                leftArea.contentWindow.clearSelection();
                actual = PrettyPrinter.getHTML(leftArea.contentDocument.documentElement);
            }
            catch (e) {
                actual = e.toString();
            }

            actual = PrettyPrinter.trim(actual);
            expected = PrettyPrinter.trim(expected);

            var fullname = dirname+"-"+filename;
            var resultElement = document.getElementById("result-"+fullname);
            DOM.deleteAllChildren(resultElement);
            var a = DOM.createElement(document,"a");
            a.href = "javascript:showResult('"+dirname+"','"+filename+"')";
            DOM.appendChild(resultElement,a);
            results[fullname] = new Result(actual,expected);
            if (actual == expected) {
                resultElement.setAttribute("class","pass");
                DOM.appendChild(a,DOM.createTextNode(document,"PASS"));
                passes++;
            }
            else {
                resultElement.setAttribute("class","fail");
                DOM.appendChild(a,DOM.createTextNode(document,"FAIL"));
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
            leftArea.src = dirname+"/"+filename+"-input.html";
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
    DOM.assignNodeIds(document);
    topArea = document.getElementById("topInner");
    leftArea = document.getElementById("leftInner");
    rightArea = document.getElementById("rightInner");
    loadCode();
    loadTestIndex();

    var table = DOM.createElement(document,"table");
    DOM.appendChild(topArea,table);

    for (var dirno = 0; dirno < tests.length; dirno++) {
        var dir = tests[dirno];

        var tr = DOM.createElement(document,"tr");
        DOM.appendChild(table,tr);
        tr.setAttribute("class","dirrow");
        table.setAttribute("width","100%");

        var td = DOM.createElement(document,"td");
        DOM.appendChild(tr,td);
        td.setAttribute("colspan","2");
        DOM.appendChild(td,DOM.createTextNode(document,dir.dir));

        for (var fileno = 0; fileno < dir.files.length; fileno++) {
            var filename = dir.files[fileno];

            tr = DOM.createElement(document,"tr");
            DOM.appendChild(table,tr);
            tr.setAttribute("class","testrow");

            td = DOM.createElement(document,"td");
            DOM.appendChild(tr,td);
            td.setAttribute("width","50%");

            var a = DOM.createElement(document,"a");
            DOM.appendChild(td,a);
            a.href = "javascript:showTest('"+dir.dir+"','"+filename+"')";
            DOM.appendChild(a,DOM.createTextNode(document,filename));

            td = DOM.createElement(document,"td");
            DOM.appendChild(tr,td);
            td.setAttribute("width","50%");
            td.id = "result-"+dir.dir+"-"+filename;
        }
    }
}
