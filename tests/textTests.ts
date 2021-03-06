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

import Selection = require("../src/selection");
import Txt = require("../src/text");

export function showRuns(): string {
    let range = Selection.get();
    let paragraph = Txt.analyseParagraph(range.start);
    let runs = paragraph.runs;
    let lines = new Array();
    for (let i = 0; i < runs.length; i++) {

        let elementNames = new Array();
        for (let anc = runs[i].node.parentNode; anc != paragraph.node; anc = anc.parentNode) {
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
