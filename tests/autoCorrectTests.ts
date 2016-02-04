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

import AutoCorrect = require("../src/autoCorrect");
import PrettyPrinter = require("./prettyPrinter");

export function findTextMatching(re) {
    return recurse(document.body);

    function recurse(node) {
        if (node.nodeType == Node.TEXT_NODE) {
            if (node.nodeValue.match(re))
                return node;
            else
                return null;
        }
        else {
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                var result = recurse(child);
                if (result != null)
                    return result;
            }
            return null;
        }
    }
}

export function showCorrections() {
    var corrections = AutoCorrect.getCorrections();
    var lines = new Array();
    lines.push("Corrections:\n");
    for (var i = 0; i < corrections.length; i++) {
        lines.push("    "+corrections[i].original+" -> "+corrections[i].replacement+"\n");
    }
    return PrettyPrinter.getHTML(document.documentElement)+"\n"+lines.join("");
}
