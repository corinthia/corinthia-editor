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
    var javascriptFiles = ["../src/first.js", // must be first
                           "../src/Clipboard.js",
                           "../src/Cursor.js",
                           "../src/DOM.js",
                           "../src/Editor.js",
                           "../src/Equations.js",
                           "../src/Figures.js",
                           "../src/Formatting.js",
                           "../src/Hierarchy.js",
                           "../src/Lists.js",
                           "../src/Main.js",
                           "../src/NodeSet.js",
                           "../src/Outline.js",
                           "../src/Position.js",
                           "../src/PostponedActions.js",
                           "../src/Range.js",
                           "../src/Selection.js",
                           "../src/3rdparty/showdown/showdown.js",
                           "../src/StringBuilder.js",
                           "../src/Styles.js",
                           "../src/Tables.js",
                           "../src/traversal.js",
                           "../src/types.js",
                           "../src/UndoManager.js",
                           "../src/util.js",
                           "../src/Viewport.js",
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
        var resultText = leftArea.contentWindow.performTest();
        leftArea.contentWindow.Selection_clearSelection();
        if (resultText != null)
            setPanelText(rightArea,resultText);
        else
            setPanelText(rightArea,PrettyPrinter.getHTML(leftArea.contentDocument.documentElement));
    }
    leftArea.src = dir+"/"+name+"-input.html";
}

function showResult(dirname,filename)
{
    var fullname = dirname+"-"+filename;
    setLeftTitle("Actual result for "+dirname+"/"+filename);
    setRightTitle("Expected result for "+dirname+"/"+filename);
    leftLoadedContinuation = null;
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
    DOM_assignNodeIds(panel.contentDocument.body);
}

function setPanelText(panel,text)
{
    clearPanel(panel);
    var pre = DOM_createElement(panel.contentDocument,"PRE");
    DOM_appendChild(panel.contentDocument.body,pre);
    DOM_appendChild(pre,DOM_createTextNode(panel.contentDocument,text));
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
                var offsetInParent = leftArea.contentWindow.DOM_nodeOffset(node);
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
                    var restNode = DOM_createTextNode(document,rest);
                    DOM_insertBefore(node.parentNode,restNode,node.nextSibling);
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

    leftArea.contentWindow.eval(allCode);
    leftArea.contentWindow.debug = function(str) { console.log(str); };
    leftArea.contentWindow.PrettyPrinter = PrettyPrinter;

    leftArea.contentWindow.DOM_assignNodeIds(leftArea.contentWindow.document);

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

        leftArea.contentWindow.Selection_setSelectionRange(range);
    }
    continuation();

    return;

    function positionMergeWithNeighbours(pos)
    {
        var node = pos.node;
        var offset = pos.offset;
        var w = leftArea.contentWindow;
        if ((node.nodeType == Node.ELEMENT_NODE) && (offset < node.childNodes.length))
            w.Formatting_mergeWithNeighbours(node.childNodes[offset],w.Formatting_MERGEABLE_INLINE);
        else if ((node.nodeType == Node.ELEMENT_NODE) && (node.lastChild != null))
            w.Formatting_mergeWithNeighbours(node.lastChild,w.Formatting_MERGEABLE_INLINE);
        else
            w.Formatting_mergeWithNeighbours(node,w.Formatting_MERGEABLE_INLINE);
    }

    function getPosition(node)
    {
        var offset = leftArea.contentWindow.DOM_nodeOffset(node);
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
        DOM_deleteAllChildren(statistics);
        var str = "Passes: "+passes+", Failures: "+failures;
        DOM_appendChild(statistics,DOM_createTextNode(document,str));
    }

    function runNextTest()
    {
        if (haveTest) {
            var expected = readFile(dirname+"/"+filename+"-expected.html");

            var actual;
            try {
                var resultText = leftArea.contentWindow.performTest();
                leftArea.contentWindow.Selection_clearSelection();
                if (resultText != null)
                    actual = resultText;
                else
                    actual = PrettyPrinter.getHTML(leftArea.contentDocument.documentElement);
            }
            catch (e) {
                actual = e.toString();
            }

            actual = PrettyPrinter.trim(actual);
            expected = PrettyPrinter.trim(expected);

            var fullname = dirname+"-"+filename;
            var resultElement = document.getElementById("result-"+fullname);
            DOM_deleteAllChildren(resultElement);
            var a = DOM_createElement(document,"a");
            a.href = "javascript:showResult('"+dirname+"','"+filename+"')";
            DOM_appendChild(resultElement,a);
            results[fullname] = new Result(actual,expected);
            if (actual == expected) {
                DOM_setAttribute(resultElement,"class","pass");
                DOM_appendChild(a,DOM_createTextNode(document,"PASS"));
                passes++;
            }
            else {
                DOM_setAttribute(resultElement,"class","fail");
                DOM_appendChild(a,DOM_createTextNode(document,"FAIL"));
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
    DOM_assignNodeIds(document);
    topArea = document.getElementById("topInner");
    leftArea = document.getElementById("leftInner");
    rightArea = document.getElementById("rightInner");
    loadCode();
    loadTestIndex();

    var table = DOM_createElement(document,"table");
    DOM_appendChild(topArea,table);

    for (var dirno = 0; dirno < tests.length; dirno++) {
        var dir = tests[dirno];

        var tr = DOM_createElement(document,"tr");
        DOM_appendChild(table,tr);
        DOM_setAttribute(tr,"class","dirrow");
        DOM_setAttribute(table,"width","100%");

        var td = DOM_createElement(document,"td");
        DOM_appendChild(tr,td);
        DOM_setAttribute(td,"colspan","2");
        DOM_appendChild(td,DOM_createTextNode(document,dir.dir));

        for (var fileno = 0; fileno < dir.files.length; fileno++) {
            var filename = dir.files[fileno];

            tr = DOM_createElement(document,"tr");
            DOM_appendChild(table,tr);
            DOM_setAttribute(tr,"class","testrow");

            td = DOM_createElement(document,"td");
            DOM_appendChild(tr,td);
            DOM_setAttribute(td,"width","50%");

            var a = DOM_createElement(document,"a");
            DOM_appendChild(td,a);
            a.href = "javascript:showTest('"+dir.dir+"','"+filename+"')";
            DOM_appendChild(a,DOM_createTextNode(document,filename));

            td = DOM_createElement(document,"td");
            DOM_appendChild(tr,td);
            DOM_setAttribute(td,"width","50%");
            td.id = "result-"+dir.dir+"-"+filename;
        }
    }
}
