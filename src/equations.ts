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

import Clipboard = require("./clipboard");
import DOM = require("./dom");

export function insertEquation() {
    var math = DOM.createElementNS(document,"http://www.w3.org/1998/Math/MathML","math");
    var mrow = DOM.createElementNS(document,"http://www.w3.org/1998/Math/MathML","mrow");
    var msup = DOM.createElementNS(document,"http://www.w3.org/1998/Math/MathML","msup");
    var mi = DOM.createElementNS(document,"http://www.w3.org/1998/Math/MathML","mi");
    var mn = DOM.createElementNS(document,"http://www.w3.org/1998/Math/MathML","mn");
    var mfrac = DOM.createElementNS(document,"http://www.w3.org/1998/Math/MathML","mfrac");
    var mrow1 = DOM.createElementNS(document,"http://www.w3.org/1998/Math/MathML","mrow");
    var mrow2 = DOM.createElementNS(document,"http://www.w3.org/1998/Math/MathML","mrow");
    var mi1 = DOM.createElementNS(document,"http://www.w3.org/1998/Math/MathML","mi");
    var mi2 = DOM.createElementNS(document,"http://www.w3.org/1998/Math/MathML","mi");
    var mo = DOM.createElementNS(document,"http://www.w3.org/1998/Math/MathML","mo");

    DOM.appendChild(mi,DOM.createTextNode(document,"x"));
    DOM.appendChild(mn,DOM.createTextNode(document,"2"));
    DOM.appendChild(mo,DOM.createTextNode(document,"+"));
    DOM.appendChild(mi1,DOM.createTextNode(document,"a"));
    DOM.appendChild(mi2,DOM.createTextNode(document,"b"));
    DOM.appendChild(mrow1,mi1);
    DOM.appendChild(mrow2,mi2);
    DOM.appendChild(mfrac,mrow1);
    DOM.appendChild(mfrac,mrow2);
    DOM.appendChild(msup,mi);
    DOM.appendChild(msup,mn);
    DOM.appendChild(mrow,msup);
    DOM.appendChild(mrow,mo);
    DOM.appendChild(mrow,mfrac);
    DOM.appendChild(math,mrow);

    Clipboard.pasteNodes([math]);
}
