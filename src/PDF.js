// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var PDF_addMarkers;
var PDF_removeMarkers;

(function() {

    var markers = new Array();

    function addMarkers()
    {
        debug("PDF: add markers");

        var h1s = document.getElementsByTagName("H1");
        var h2s = document.getElementsByTagName("H2");
        var headings = new Array();
        Array.prototype.push.apply(headings,arrayCopy(h1s));
        Array.prototype.push.apply(headings,arrayCopy(h2s));
        debug("headings.length = "+headings.length);
        for (var i = 0; i < headings.length; i++) {
            debug("heading "+headings[i]);
            var id = headings[i].getAttribute("id");
            var marker = DOM_createElement(document,"SPAN");
            var text = DOM_createTextNode(document,"$$uxwrite:"+id+"$$");
            DOM_appendChild(marker,text);
            DOM_appendChild(headings[i],marker);
            markers.push(marker);
//            DOM_insertBefore(headings[i].parentNode,text,headings[i].nextSibling);


            marker.style.position = "absolute";
            marker.style.left = "0px";
            marker.style.top = "0px";
            marker.style.color = "red";
            marker.style.fontSize = "1px";
            //        marker.style.fontSize = "1px";
            headings[i].style.position = "relative";

        }
    }

    function removeMarkers()
    {
        debug("PDF: remove markers");
        for (var i = 0; i < markers.length; i++)
            DOM_deleteNode(markers[i]);
        markers.length = 0;
    }

    PDF_addMarkers = trace(addMarkers);
    PDF_removeMarkers = trace(removeMarkers);

})();
