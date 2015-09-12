function debug(str)
{
    console.log("%s",str);
}

var http = require("http");
var fs = require("fs");

var mimeTypes = {
    "html": "text/html",
    "js": "text/javascript",
    "css": "text/css",
    "xml": "test/xml",
    "txt": "text/plain",
    "png": "image/png",
    "gif": "image/gif",
    "jpg": "image/jpg",
};

function handler(request,response)
{
    var dotpos = request.url.lastIndexOf(".");
    var extension = null;
    var mimeType = "text/plain";
    if (dotpos != -1) {
        extension = request.url.substring(dotpos+1);
        if (mimeTypes[extension] != null)
            mimeType = mimeTypes[extension];
    }

    var path = decodeURI(request.url);

    if (path != "/") {
        path = path.substring(1);
        debug("read "+path);
        fs.readFile(path,function (err,data) {
            if (err) {
                response.writeHead(500,{"Content-Type": "text/plain"});
                response.end("Could not read "+path);
            }
            else {
                response.writeHead(200,{"Content-Type": mimeType});
                response.end(data);
            }
        });
    }
    else {
        response.writeHead(200,{"Content-Type": "text/html"});
        response.write("<html><body>");
        response.write("<b>Test</b> page: "+mimeType+"<br>");
        response.write("url = "+request.url+"<br>");
        response.write("path = "+path+"<br>");
        response.write("</body></html>");
        response.end();
    }
}


http.createServer(handler).listen(8080,"localhost");
