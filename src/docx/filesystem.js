var filesystem = new Object();

filesystem.mkdir = function(filename,content)
{
    var req = new XMLHttpRequest("http://localhost:8080/");
    req.open("POST","/mkdir/"+encodeURI(filename),false);
    req.send();
    if (req.status != 200)
        throw new Error(req.responseText);
}

filesystem.readXML = function(filename)
{
    var req = new XMLHttpRequest("http://localhost:8080/");
    req.open("POST","/read/"+encodeURI(filename),false);
    req.send();
    if (req.status == 404)
        return null; // file not found
    else if ((req.status != 200) && (req.status != 0))
        throw new Error(req.status+": "+req.responseText);
    return req.responseXML;
}

filesystem.write = function(filename,content)
{
    var req = new XMLHttpRequest("http://localhost:8080/");
    req.open("POST","/write/"+encodeURI(filename),false);
    req.send(content);
    if ((req.status != 200) && (req.status != 0))
        throw new Error(req.responseText);
}

filesystem.remove = function(filename,content)
{
    var req = new XMLHttpRequest("http://localhost:8080/");
    req.open("POST","/remove/"+encodeURI(filename),false);
    req.send();
    if ((req.status != 200) && (req.status != 0))
        throw new Error(req.responseText);
}

filesystem.mkdocx = function(filename,content)
{
    var req = new XMLHttpRequest("http://localhost:8080/");
    req.open("POST","/mkdocx/"+encodeURI(filename),false);
    req.send();
    if ((req.status != 200) && (req.status != 0))
        throw new Error(req.responseText);
}
