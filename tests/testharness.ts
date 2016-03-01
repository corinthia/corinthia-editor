// This file is part of the Corinthia project (http://corinthia.io).
//
// See the COPYRIGHT.txt file distributed with this work for
// information regarding copyright ownership.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

let topArea: any;
let leftArea: any;
let rightArea: any;
let leftLoadedContinuation: () => void = null;
let results = new Object();
let allCode: string = null;
let tests: any = null;

class Result {

    constructor(public actual: string, public expected: string) {
    }

}

function readFile(filename: string): string {
    let req = new XMLHttpRequest();
    req.open("GET",filename,false);
    req.send();
    return req.responseText;
}

function loadCode(): void {
    // Sync with Editor.m
    let modules = [
        "src/autoCorrect",
        "src/changeTracking",
        "src/callbacks",
        "src/clipboard",
        "src/collections",
        "src/cursor",
        "src/dom",
        "src/elementTypes",
        "src/equations",
        "src/externalapi",
        "src/figures",
        "src/formatting",
        "src/geometry",
        "src/hierarchy",
        "src/input",
        "src/lists",
        "src/main",
        "src/markdown",
        "src/metadata",
        "src/outline",
        "src/paragraph",
        "src/position",
        "src/postponedActions",
        "src/preview",
        "src/range",
        "src/scan",
        "src/selection",
        "src/styles",
        "src/tables",
        "src/text",
        "src/traversal",
        "src/types",
        "src/undo",
        "src/util",
        "src/viewport",
        "tests/autoCorrectTests",
        "tests/figuresTests",
        "tests/inputTests",
        "tests/outlineTests",
        "tests/positionTests",
        "tests/prettyPrinter",
        "tests/rangeTests",
        "tests/scanTests",
        "tests/tableTests",
        "tests/testlib",
        "tests/testrun",
        "tests/textTests",
        "tests/undoTests",
        "tests/validPositions"
    ];
    let allCodeArray = new Array();
    allCodeArray.push(readJSCode("../src/3rdparty/showdown/showdown.js"));
    allCodeArray.push(readJSCode("../build/src/loader.js"));
    for (let i = 0; i < modules.length; i++)
        allCodeArray.push(readModule("../build",modules[i]+".js"));
    allCode = allCodeArray.join("\n");
}

function loadTestIndex(): void {
    tests = JSON.parse(readFile("index.json"));
}

function doPerformTest(): string {
    return leftArea.contentWindow.run();
}

function showTest(dir: string, name: string): void {
    leftLoadedContinuation = function() {
        setLeftTitle("Working area");
        setRightTitle("Result");
        let resultText = doPerformTest();
        setPanelText(rightArea,resultText);
    }
    leftArea.src = dir+"/"+name+"-input.html";
}

function showResult(dirname: string, filename: string): void {
    let fullname = dirname+"-"+filename;
    setLeftTitle("Actual result for "+dirname+"/"+filename);
    setRightTitle("Expected result for "+dirname+"/"+filename);
    leftLoadedContinuation = null;
    setPanelText(leftArea,results[fullname].actual);
    setPanelText(rightArea,results[fullname].expected);
}

function setLeftTitle(title: string): void {
    document.getElementById("leftTitle").firstChild.nodeValue = title;
}

function setRightTitle(title: string): void {
    document.getElementById("rightTitle").firstChild.nodeValue = title;
}

function clearPanel(panel: any): void {
    panel.contentDocument.open();
    panel.contentDocument.close();
}

function setPanelText(panel: any, text: string): void {
    clearPanel(panel);
    let pre = panel.contentDocument.createElement("PRE");
    panel.contentDocument.body.appendChild(pre);
    pre.appendChild(panel.contentDocument.createTextNode(text));
}



function readJSCode(filename: string): string {
    let req = new XMLHttpRequest();
    req.open("GET",filename,false);
    req.send();
    return req.responseText;
}

function readModule(baseDir: string, filename: string): string {
    // The .js files produced by the TypeScript compiler have define() calls which do not supply
    // the module name as a parameter. Because we are using eval() to execute the code, rather than
    // inserting a <script> element into the DOM, the loader has no way of determining the module
    // name based on the filename. So after reading the file we have to modify the call to insert
    // an extra parameter to define() which specifies the name.
    let code = readJSCode(baseDir+"/"+filename);
    let defineIndex = code.indexOf("define");
    if (defineIndex == -1) {
        throw new Error("Module "+filename+" does not contain a define() call");
    }
    else {
        let moduleName = filename.replace(/\.js$/,"");
        let before = code.substring(0,defineIndex);
        let after = code.substring(defineIndex+7);
        code = before+"define("+JSON.stringify(moduleName)+","+after;
    }
    return code;
}

function leftLoaded(): void {
    if (leftLoadedContinuation == null)
        return;
    let continuation = leftLoadedContinuation;
    leftLoadedContinuation = null;

    let w = leftArea.contentWindow;
    w.eval(allCode);
    w.eval("loadAllModules()");
    continuation();

    return;
}

function runAllTests(): void {
    let dirno = 0;
    let fileno = 0;
    let haveTest = false;
    let dirname: string;
    let filename: string;

    let passes = 0;
    let failures = 0;
    let startTime = new Date();

    setLeftTitle("Working area");
    setRightTitle("");

    clearPanel(rightArea);
    results = new Object();

    runNextTest();
    return;

    function updateStatistics(): void {
        let statistics = document.getElementById("statistics");
        while (statistics.firstChild != null)
            statistics.removeChild(statistics.firstChild);
        let now = new Date();
        let elapsed = now.getTime() - startTime.getTime();
        let str = "Passes: "+passes+", Failures: "+failures+
            ", Elapsed time "+(elapsed/1000)+" seconds";
        statistics.appendChild(document.createTextNode(str));
    }

    function runNextTest(): void {
        if (haveTest) {
            let expected = readFile(dirname+"/"+filename+"-expected.html");

            let actual: string;
            try {
                actual = doPerformTest();
            }
            catch (e) {
                actual = e.toString();
            }

            actual = actual.trim();
            expected = expected.trim();

            let fullname = dirname+"-"+filename;
            let resultElement = document.getElementById("result-"+fullname);
            while (resultElement.firstChild != null)
                resultElement.removeChild(resultElement);
            let a = document.createElement("a");
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
            let dir = tests[dirno];
            dirname = dir.dir;
            filename = dir.files[fileno];
            incrementPosition();
            leftLoadedContinuation = runNextTest;
            haveTest = true;
            leftArea.src = dirname+"/"+filename+"-input.html";
        }
    }

    function incrementPosition(): void {
        fileno++;
        if (fileno == tests[dirno].files.length) {
            dirno++;
            fileno = 0;
        }
    }
}

function loaded(): void {
    topArea = document.getElementById("topInner");
    leftArea = document.getElementById("leftInner");
    rightArea = document.getElementById("rightInner");
    loadCode();
    loadTestIndex();

    let table = document.createElement("table");
    topArea.appendChild(table);

    for (let dirno = 0; dirno < tests.length; dirno++) {
        let dir = tests[dirno];

        let tr = document.createElement("tr");
        table.appendChild(tr);
        tr.setAttribute("class","dirrow");
        table.setAttribute("width","100%");

        let td = document.createElement("td");
        tr.appendChild(td);
        td.setAttribute("colspan","2");
        td.appendChild(document.createTextNode(dir.dir));

        for (let fileno = 0; fileno < dir.files.length; fileno++) {
            let filename = dir.files[fileno];

            tr = document.createElement("tr");
            table.appendChild(tr);
            tr.setAttribute("class","testrow");

            td = document.createElement("td");
            tr.appendChild(td);
            td.setAttribute("width","50%");

            let a = document.createElement("a");
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
