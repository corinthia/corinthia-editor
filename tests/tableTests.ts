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

import DOM = require("../src/dom");
import PrettyPrinter = require("./prettyPrinter");
import Selection = require("../src/selection");
import Tables = require("../src/tables");
import Traversal = require("../src/traversal");

export function showSelectedTableRegion() {
    let region = Tables.regionFromRange(Selection.get());
    for (let row = region.top; row <= region.bottom; row++) {
        for (let col = region.left; col <= region.right; col++) {
            let cell = Tables.Table_get(region.structure,row,col);
            DOM.setStyleProperties(cell.element,{"background-color": "silver"});
        }
    }
}

export function getSelectedTableRegion() {
    return Tables.regionFromRange(Selection.get());
}

export function showTableStructure() {
    let tableElement = document.getElementsByTagName("TABLE")[0];
    let table = Tables.analyseStructure(tableElement);
    let lines = new Array();
    lines.push(PrettyPrinter.getHTML(document.documentElement));

    for (let row = 0; row < table.numRows; row++) {
        for (let col = 0; col < table.numCols; col++) {
            let cell = Tables.Table_get(table,row,col);
            if (cell == null) {
                lines.push("Cell at ("+row+","+col+") = "+null);
            }
            else {
                lines.push("Cell at ("+row+","+col+") = "+
                           cell.rowspan+"x"+cell.colspan+" "+
                           JSON.stringify(Traversal.getNodeText(cell.element)));
            }
        }
    }

    return lines.join("\n");
}
