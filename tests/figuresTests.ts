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
import Figures = require("../src/figures");
import Selection = require("../src/selection");

// FIXME: index is not actually used
export function figurePropertiesString(index: number): string {
    let figure = document.getElementsByTagName("FIGURE")[0];
    let parent = figure.parentNode;
    let offset = DOM.nodeOffset(figure);
    Selection.set(parent,offset,parent,offset+1);
    let properties = Figures.getProperties(Figures.getSelectedFigureId());
    let strings = new Array();
    let names = Object.getOwnPropertyNames(properties).sort();
    for (let i = 0; i < names.length; i++) {
        let name = names[i];
        if (properties[name] == null)
            strings.push(name+" = null");
        else
            strings.push(name+" = "+properties[name]);
    }
    return strings.join("\n");
}
