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

import DOM = require("./dom");
import ElementTypes = require("./elementTypes");
import Figures = require("./figures");
import Selection = require("./selection");
import Tables = require("./tables");
import Types = require("./types");

let previewText =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec in diam \n"+
    "mauris. Integer in lorem sit amet dolor lacinia aliquet. Cras vehicula odio \n"+
    "non enim euismod nec congue lorem varius. Sed eu libero arcu, eget tempus \n"+
    "augue. Vivamus varius risus ac libero sagittis eu ultricies lectus \n"+
    "consequat. Integer gravida accumsan fermentum. Morbi erat ligula, volutpat \n"+
    "non accumsan sed, pellentesque quis purus. Vestibulum vestibulum tincidunt \n"+
    "lectus non pellentesque. Quisque porttitor sollicitudin tellus, id porta \n"+
    "velit interdum sit amet. Cras quis sem orci, vel convallis magna. \n"+
    "Pellentesque congue, libero et iaculis volutpat, enim turpis sodales dui, \n"+
    "lobortis pharetra lectus dolor at sem. Nullam aliquam, odio ac laoreet \n"+
    "vulputate, ligula nunc euismod leo, vel bibendum magna leo ut orci. In \n"+
    "tortor turpis, pellentesque nec cursus ut, consequat non ipsum. Praesent \n"+
    "venenatis, leo in pulvinar pharetra, eros nisi convallis elit, vitae luctus \n"+
    "magna velit ut lorem."

function setTableCellContents(node: Node): void {
    if (Types.isTableCell(node)) {
        DOM.deleteAllChildren(node);
        DOM.appendChild(node,DOM.createTextNode(document,"Cell contents"));
    }
    else {
        for (let child = node.firstChild; child != null; child = child.nextSibling)
            setTableCellContents(child);
    }
}

export function showForStyle(styleId: string, uiName: string, titleText: string): void {
    let elementName: string = null;
    let className: string = null;

    let dotPos = styleId.indexOf(".");
    if (dotPos >= 0) {
        elementName = styleId.substring(0,dotPos);
        className = styleId.substring(dotPos+1);
    }
    else {
        elementName = styleId;
        className = null;
    }

    let title = DOM.createTextNode(document,titleText);
    let text = DOM.createTextNode(document,previewText);

    Selection.clear();
    DOM.deleteAllChildren(document.body);

    if (Types.PARAGRAPH_ELEMENTS[ElementTypes.fromString[elementName]]) {
        let paragraph1 = createParagraphElement(elementName,className);
        let paragraph2 = createParagraphElement(elementName,className);
        DOM.appendChild(paragraph1,title);
        DOM.appendChild(paragraph2,text);
        DOM.appendChild(document.body,paragraph1);
        DOM.appendChild(document.body,paragraph2);

        if (className != null) {
            DOM.setAttribute(paragraph1,"class",className);
            DOM.setAttribute(paragraph2,"class",className);
        }
    }
    else if (elementName == "span") {
        let p1 = DOM.createElement(document,"P");
        let p2 = DOM.createElement(document,"P");
        let span1 = DOM.createElement(document,"SPAN");
        let span2 = DOM.createElement(document,"SPAN");

        if (className != null) {
            DOM.setAttribute(span1,"class",className);
            DOM.setAttribute(span2,"class",className);
        }

        DOM.appendChild(span1,title);
        DOM.appendChild(span2,text);

        DOM.appendChild(p1,span1);
        DOM.appendChild(p2,span2);

        DOM.appendChild(document.body,p1);
        DOM.appendChild(document.body,p2);
    }
    else if ((elementName == "table") || (elementName == "caption")) {
        // FIXME: cater for different table styles
        Selection.selectAll();
        Tables.insertTable(3,3,"66%",true,"Table caption");
        Selection.clear();
        let table = document.getElementsByTagName("TABLE")[0];
        setTableCellContents(table);
        if ((elementName == "table") && (className != null))
            DOM.setAttribute(table,"class",className);
    }
    else if ((elementName == "figure") || (elementName == "figcaption")) {
        Selection.selectAll();
        Figures.insertFigure("SampleFigure.svg","75%",true,"TCP 3-way handshake");
        Selection.clear();
    }
    else if (elementName == "body") {
        // We use BR here instead of separate paragraphs, since we don't want the properties
        // for the P element to be applied
        DOM.appendChild(document.body,title);
        DOM.appendChild(document.body,DOM.createElement(document,"BR"));
        DOM.appendChild(document.body,DOM.createElement(document,"BR"));
        DOM.appendChild(document.body,text);
    }

    function createParagraphElement(elementName: string, className: string): HTMLElement {
        let element = DOM.createElement(document,elementName);
        if (className != null)
            DOM.setAttribute(element,"class",className);
        return element;
    }
}
