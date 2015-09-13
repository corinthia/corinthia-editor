# Corinthia editing library

Part of the [Corinthia](http://corinthia.io) project.

This library implements the back-end parts of a WYSIWYG HTML editor. It is
intended to be used as part of web or native applications that wish to provide
HTML editing functionality.

No user interface is present in the library; this is the responsibility of the
containing application. Web applications should provide the necessary user
interface elements using HTML buttons and the like, loading the document to be
edited and the library's JS code in an IFRAME. Native apps should embed a web
view control in which they do the same.
