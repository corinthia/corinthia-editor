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

define("tests.TextTests",function(require,exports) {
"use strict";

var Selection = require("Selection");
var Text = require("Text");

function showRuns() {
    var range = Selection.get();
    var paragraph = Text.analyseParagraph(range.start);
    var runs = paragraph.runs;
    var lines = new Array();
    for (var i = 0; i < runs.length; i++) {

        var elementNames = new Array();
        for (var anc = runs[i].node.parentNode; anc != paragraph.node; anc = anc.parentNode) {
            elementNames.push(anc.nodeName+" ");
        }

        lines.push("Run "+i+" ("+runs[i].start+"): "+
                   elementNames.reverse().join("")+
                   JSON.stringify(runs[i].node.nodeValue));
    }
    lines.push("");
    lines.push("Text: "+JSON.stringify(paragraph.text));
    return lines.join("\n");
}

exports.showRuns = showRuns;

});
