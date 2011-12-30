function load()
{
    req = new XMLHttpRequest("http://localhost");
    req.open("get","/uxwrite/javascript/latex/in/Tutorial.tex",false);
    req.send();
    return req.responseText;
}

function save()
{
    req = new XMLHttpRequest("http://localhost");
    req.open("PUT","/uxwrite/javascript/latex/out/output.tex",false);
    req.send("test123\n");
    alert("req = "+req.readyState);
}

function LatexToken(type,offset,length)
{
    this.type = type;
    this.offset = offset;
    this.length = length;
}

LatexToken.prototype.TEXT = 0;
LatexToken.prototype.COMMENT = 0;

function LatexSource(code)
{
    this.pos = -1;
    this.code = code;
    this.char = this.nextChar();
}

LatexSource.prototype.specialChars = {
    "#": true,
    "$": true,
    "%": true,
    "&": true,
    "~": true,
    "_": true,
    "^": true,
    "\"": true,
    "{": true,
    "}": true,
    "[": true,
    "]": true };

LatexSource.prototype.isSpecialChar = function(c)
{
    return (c == null) ? false : LatexSource.prototype.specialChars[c];
}

LatexSource.prototype.isMacroChar = function(c)
{
    return (((c >= 'a') && (c <= 'z')) ||
            ((c >= 'A') && (c <= 'Z')) ||
            ((c >= '0') && (c <= '9')));
}

LatexSource.prototype.nextChar = function()
{
    if (this.pos+1 < this.code.length) {
        this.char = this.code.charAt(this.pos+1);
        this.pos++;
    }
    else {
        this.char = null;
    }
    return this.char;
}

LatexSource.prototype.matchChar = function(c)
{
    if (this.char == c) {
        this.nextChar();
        return true;
    }
    else {
        return false;
    }
}

LatexSource.prototype.next = function()
{
    if (this.char == null)
        return null;
    
    var start = this.pos;
    if (this.char == '%') {
        while ((this.char != null) && (this.char != '\n'))
            this.nextChar();
        var token = new LatexToken(LatexToken.COMMENT,start,this.pos-start);
        var tokenText = this.code.slice(token.offset,token.offset+token.length);
        if (this.char == '\n')
            this.nextChar();
        return token;
    }
    else if (this.isSpecialChar(this.char)) {
        this.nextChar();
        return new LatexToken(this.char,start,1);
    }
    else {
        while ((this.char != null) && !this.isSpecialChar(this.char))
            this.nextChar();
        return new LatexToken(LatexToken.TEXT,start,this.pos-start);
    }
}

LatexSource.prototype.parse = function()
{
    var token;
    while ((token = this.next()) != null) {
        var tokenText = this.code.slice(token.offset,token.offset+token.length);
//        var tokenText = this.code.slice(0,token.length);
//        debug("start = "+token.offset+", end = "+(token.offset+token.length));
        if (token.type == LatexToken.COMMENT) {
            debug("Comment: \""+tokenText+"\"");
        }
        else if (token.type == LatexToken.TEXT) {
            debug("Text: \""+tokenText+"\"");
        }
        else {
            debug("Character: "+tokenText);
        }
    }
    debug("token = null");
}

function main()
{
    var texCode = load();
//    var pre = document.createElement("PRE");
//    var text = document.createTextNode(texCode);
//    pre.appendChild(text);
//    document.body.appendChild(pre);
    
    var source = new LatexSource(texCode);
    source.parse();
}
