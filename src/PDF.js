// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

var PDF_addMarkers;
var PDF_removeMarkers;

(function() {

    function addMarkers()
    {
        debug("PDF: add markers");
    }

    function removeMarkers()
    {
        debug("PDF: remove markers");
    }

    PDF_addMarkers = trace(addMarkers);
    PDF_removeMarkers = trace(removeMarkers);

})();
