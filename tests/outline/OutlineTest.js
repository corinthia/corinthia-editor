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

var OutlineTests_createTestSections;
var OutlineTests_setupOutline;
var OutlineTests_createTestFigures;
var OutlineTests_createTestTables;
var OutlineTests_cleanupOutline;

(function() {

    OutlineTests_createTestSections = function(topChildren) {
        var index = 1;

        processChildren(1,topChildren);

        PostponedActions_perform();

        TestLib_setNumbering(true);

        function processChildren(level,children) {
            if (typeof children == "number") {
                for (var i = 0; i < children; i++)
                    recurse(level,null);
            }
            else if (children instanceof Array) {
                for (var i = 0; i < children.length; i++)
                    recurse(level,children[i]);
            }
        }

        function recurse(level,children) {
            var heading = DOM_createElement(document,"H"+level);

            DOM_appendChild(heading,DOM_createTextNode(document,"Section "+index));

            var p1 = DOM_createElement(document,"P");
            var p2 = DOM_createElement(document,"P");

            DOM_appendChild(p1,DOM_createTextNode(document,"Content "+index+" A"));
            DOM_appendChild(p2,DOM_createTextNode(document,"Content "+index+" B"));


            DOM_appendChild(document.body,heading);
            DOM_appendChild(document.body,p1);
            DOM_appendChild(document.body,p2);
            index++;

            processChildren(level+1,children);
        }
    }

    OutlineTests_setupOutline = function(topChildren) {
        Outline_init();
        PostponedActions_perform();
        OutlineTests_createTestSections(topChildren);
    }

    OutlineTests_createTestFigures = function(count) {
        for (var i = 0; i < count; i++) {
            var figure = DOM_createElement(document,"FIGURE");
            var figcaption = DOM_createElement(document,"FIGCAPTION");
            var content = DOM_createTextNode(document,"(figure content)");
            var text = DOM_createTextNode(document,"Test figure "+String.fromCharCode(65+i));
            DOM_appendChild(figcaption,text);
            DOM_appendChild(figure,content);
            DOM_appendChild(figure,figcaption);
            DOM_appendChild(document.body,figure);
        }
    }

    OutlineTests_createTestTables = function(count) {
        for (var i = 0; i < count; i++) {
            var offset = document.body.childNodes.length;
            Selection_set(document.body,offset,document.body,offset);
            Tables_insertTable(1,1,"100%",true,"Test table "+String.fromCharCode(65+i));
        }
        PostponedActions_perform();
    }

    function removeOutlineHTML(node) {
        if ((node.nodeName == "SPAN") &&
            (node.getAttribute("class") == "uxwrite-heading-number")) {
            DOM_removeNodeButKeepChildren(node);
        }
        else {
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                removeOutlineHTML(child);
            for (var child = node.firstChild; child != null; child = child.nextSibling)
                Formatting_mergeWithNeighbours(child,Formatting_MERGEABLE_INLINE);
        }
    }

    OutlineTests_cleanupOutline = function() {
        PostponedActions_perform();
        removeOutlineHTML(document.body);
    }

})();
