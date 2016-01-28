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

(function(api) {

    var TableTests = api.tests.TableTests; // export

    var DOM = api.DOM; // import
    var Selection = api.Selection; // import
    var Tables = api.Tables; // import
    var Traversal = api.Traversal; // import

    TableTests.showSelectedTableRegion = function() {
        var region = Tables.regionFromRange(Selection.get());
        for (var row = region.top; row <= region.bottom; row++) {
            for (var col = region.left; col <= region.right; col++) {
                var cell = Tables.Table_get(region.structure,row,col);
                DOM.setStyleProperties(cell.element,{"background-color": "silver"});
            }
        }
    }

    TableTests.getSelectedTableRegion = function() {
        return Tables.regionFromRange(Selection.get());
    }

    TableTests.showTableStructure = function() {
        var tableElement = document.getElementsByTagName("TABLE")[0];
        var table = Tables.analyseStructure(tableElement);
        var lines = new Array();
        lines.push(PrettyPrinter.getHTML(document.documentElement));

        for (var row = 0; row < table.numRows; row++) {
            for (var col = 0; col < table.numCols; col++) {
                var cell = Tables.Table_get(table,row,col);
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

})(globalAPI);
