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

function loadDemo(mainScriptURL: string, continuation?: () => any): void {
    let moduleNames = [
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
        "src/inputref",
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

        "src/externalapi",
        "demo/demo",
    ];
    let base: string = window.location.href.replace(/\/demo\/[^\/]+$/,"/build/");
    let urls: string[] = moduleNames.map((name) => base+name+".js");

    let urlIndex = 0;
    next();
    return;

    function next(): void {
        if (urlIndex == urls.length) {
            loadAllModules(mainScriptURL);
            if (continuation != null)
                continuation();
            else
                throw new Error("loadApp: no continuation supplied");
            return;
        }

        let url = urls[urlIndex++];
        let script = document.createElement("script");
        script.setAttribute("src",url);
        script.addEventListener("load",() => {
            next();
        });
        document.body.appendChild(script);
    }
}
