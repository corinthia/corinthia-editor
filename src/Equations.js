// Copyright (c) 2012 UX Productivity Pty Ltd. All rights reserved.

var Equations_insertEquation;

(function() {

    Equations_insertEquation = trace(function insertEquation()
    {
        var math = DOM_createElementNS(document,"http://www.w3.org/1998/Math/MathML","math");
        var mrow = DOM_createElementNS(document,"http://www.w3.org/1998/Math/MathML","mrow");
        var msup = DOM_createElementNS(document,"http://www.w3.org/1998/Math/MathML","msup");
        var mi = DOM_createElementNS(document,"http://www.w3.org/1998/Math/MathML","mi");
        var mn = DOM_createElementNS(document,"http://www.w3.org/1998/Math/MathML","mn");
        var mfrac = DOM_createElementNS(document,"http://www.w3.org/1998/Math/MathML","mfrac");
        var mrow1 = DOM_createElementNS(document,"http://www.w3.org/1998/Math/MathML","mrow");
        var mrow2 = DOM_createElementNS(document,"http://www.w3.org/1998/Math/MathML","mrow");
        var mi1 = DOM_createElementNS(document,"http://www.w3.org/1998/Math/MathML","mi");
        var mi2 = DOM_createElementNS(document,"http://www.w3.org/1998/Math/MathML","mi");
        var mo = DOM_createElementNS(document,"http://www.w3.org/1998/Math/MathML","mo");

        DOM_appendChild(mi,DOM_createTextNode(document,"x"));
        DOM_appendChild(mn,DOM_createTextNode(document,"2"));
        DOM_appendChild(mo,DOM_createTextNode(document,"+"));
        DOM_appendChild(mi1,DOM_createTextNode(document,"a"));
        DOM_appendChild(mi2,DOM_createTextNode(document,"b"));
        DOM_appendChild(mrow1,mi1);
        DOM_appendChild(mrow2,mi2);
        DOM_appendChild(mfrac,mrow1);
        DOM_appendChild(mfrac,mrow2);
        DOM_appendChild(msup,mi);
        DOM_appendChild(msup,mn);
        DOM_appendChild(mrow,msup);
        DOM_appendChild(mrow,mo);
        DOM_appendChild(mrow,mfrac);
        DOM_appendChild(math,mrow);

        Clipboard_pasteNodes([math]);
    });

})();
