// Copyright (c) 2011-2012 UX Productivity Pty Ltd. All rights reserved.

function extend(base)
{
    function inheritance() {}
    inheritance.prototype = base.prototype;
    return new inheritance();
}

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

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                         LatexNode                                              //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

function LatexNode()
{
    this.firstChild = null;
    this.lastChild = null;
    this.parentNode = null;
    this.previousSibling = null;
    this.nextSibling = null;
}

LatexNode.prototype.appendChild = function(child)
{
    if (this.firstChild == null) {
        this.firstChild = child;
        this.lastChild = child;
    }
    else {
        this.lastChild.nextSibling == child;
        child.previousSibling == this.lastChild;
        this.lastChild = child;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                        LatexElement                                            //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

LatexElement.prototype = extend(LatexNode);

function LatexElement()
{
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                        LatexComment                                            //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

LatexComment.prototype = extend(LatexNode);

function LatexComment(text)
{
    this.text = text;
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                          LatexText                                             //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

LatexText.prototype = extend(LatexNode);

function LatexText(text)
{
    this.text = text;
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                         LatexArgument                                          //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

LatexArgument.prototype = extend(LatexNode);

function LatexArgument(type,children)
{
    this.type = type;
    for (var i = 0; i < children.length; i++)
        this.appendChild(children[i]);
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                          LatexArgRef                                           //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

LatexArgRef.prototype = extend(LatexNode);

function LatexArgRef(num)
{
    this.num = num;
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                          LatexMacro                                            //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

LatexMacro.prototype = extend(LatexNode);

function LatexMacro(name,args)
{
    this.name = name;
    for (var i = 0; i < args.length; i++)
        this.appendChild(args[i]);
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                           LatexMath                                            //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

LatexMath.prototype = extend(LatexNode);

function LatexMath(children)
{
    for (var i = 0; i < children.length; i++)
        this.appendChild(children[i]);
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                           LatexNbsp                                            //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

LatexNbsp.prototype = extend(LatexNode);

function LatexNbsp()
{
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                         LatexSuperscript                                       //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

LatexSuperscript.prototype = extend(LatexNode);

function LatexSuperscript()
{
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                          LatexSubscript                                        //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

LatexSubscript.prototype = extend(LatexNode);

function LatexSubscript()
{
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                          LatexAmpersand                                        //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

LatexAmpersand.prototype = extend(LatexNode);

function LatexAmpersand()
{
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                          LatexToken                                            //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

function LatexToken(type,offset,length)
{
    this.type = type;
    this.offset = offset;
    this.length = length;
}

LatexToken.END = 0;
LatexToken.TEXT = 1;
LatexToken.COMMENT = 2;
LatexToken.MACRO = 3;
LatexToken.ARG_REF = 4;

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                         LatexSource                                            //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

function LatexSource(code)
{
    this.pos = -1;
    this.code = code;
    this.char = this.nextChar();
    this.token = this.nextToken();
}

LatexSource.prototype.specialChars = {
    "#": true,
    "$": true,
    "%": true,
    "&": true,
    "~": true,
    "_": true,
    "^": true,
    "\\": true,
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
//    var charCode = c.charCodeAt(0);
//    return (((c >= 97) && (c <= 122)) ||
//            ((c >= 65) && (c <= 90)) ||
//            ((c >= 48) && (c <= 57)));
    return false;
}

LatexSource.prototype.isDigit = function(c)
{
    return ((c >= '0') && (c <= '9'));
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

LatexSource.prototype.nextToken = function()
{
    if (this.char == null) {
        this.token = null;
        return this.token;
    }
    
    var start = this.pos;
    if (this.char == '%') {
        while ((this.char != null) && (this.char != '\n'))
            this.nextChar();
        this.token = new LatexToken(LatexToken.COMMENT,start,this.pos-start);
        if (this.char == '\n')
            this.nextChar();
    }
    else if (this.char == '\\') {
        this.nextChar();
        // FIXME: is whitespace allowed before/after the macro name?
        while ((this.char != null) && this.isMacroChar(this.char))
            this.nextChar();
        this.token = new LatexToken(LatexToken.MACRO,start+1,this.pos-start-1);
    }
    else if (this.char == '#') {
        this.nextChar();
        while ((this.char != null) && this.isDigit(this.char))
            this.nextChar();
        this.token = new LatexToken(LatexToken.ARG_REF,start+1,this.pos-start-1);
    }
    else if (this.isSpecialChar(this.char)) {
        this.token = new LatexToken(this.char,start,1);
        this.nextChar();
    }
    else {
        // FIXME: handle characters quoted with backslash
        while ((this.char != null) && !this.isSpecialChar(this.char))
            this.nextChar();
        this.token = new LatexToken(LatexToken.TEXT,start,this.pos-start);
    }
    return this.token;
}

LatexSource.prototype.parseSingle = function(indent)
{
    if (this.token == null)
        return null;

    var tokenText = this.code.slice(this.token.offset,this.token.offset+this.token.length);
    if (this.token.type == LatexToken.COMMENT) {
        this.nextToken();
        debug(indent+"Comment: "+tokenText);
        return new LatexComment(tokenText);
    }
    else if (this.token.type == LatexToken.TEXT) {
        this.nextToken();
        debug(indent+"Text: "+tokenText);
        return new LatexText(tokenText);
    }
    else if (this.token.type == LatexToken.MACRO) {
        this.nextToken();
        debug(indent+"Macro: "+tokenText);
        var name = tokenText;
        var args = new Array();
        while ((this.token != null) && ((this.token.type == '[') || (this.token.type == '{')))
            args.push(this.parseSingle(indent+"    "));
        return new LatexMacro(name,args);
    }
    else if (this.token.type == '[') {
        this.nextToken();
        debug(indent+"[] arg");
        var type = '[';
        var children = new Array();
        while ((this.token != null) && (this.token.type != ']'))
            children.push(this.parseSingle(indent+"    "));
        this.nextToken();
        return new LatexArgument(type,children);
    }
    else if (this.token.type == '{') {
        this.nextToken();
        debug(indent+"{} arg");
        var type = '{';
        var children = new Array();
        while ((this.token != null) && (this.token.type != '}'))
            children.push(this.parseSingle(indent+"    "));
        this.nextToken();
        return new LatexArgument(type,children);
    }
    else if (this.token.type == LatexToken.ARG_REF) {
        this.nextToken();
        debug(indent+"arg ref "+tokenText);
        return new LatexArgRef(parseInt(tokenText));
    }
    else if (this.token.type == '$') {
        this.nextToken();
        debug(indent+"math mode");
        var children = new Array();
        while ((this.token != null) && (this.token.type != '$'))
            children.push(this.parseSingle(indent+"    "));
        this.nextToken();
        return new LatexMath(children);
    }
    else if (this.token.type == '~') {
        this.nextToken();
        debug(indent+"Non-breaking space");
        return new LatexNbsp();
    }
    else if (this.token.type == '^') {
        this.nextToken();
        debug(indent+"Superscript");
        return new LatexSuperscript();
    }
    else if (this.token.type == '_') {
        this.nextToken();
        debug(indent+"Subscript");
        return new LatexSubscript();
    }
    else if (this.token.type == '&') {
        this.nextToken();
        debug(indent+"Ampersand");
        return new LatexAmpersand();
    }
    else {
        throw new Error("Parse error: Unexpected token "+this.token.type);
    }
}

LatexSource.prototype.parseDocument = function()
{
    var root = new LatexElement();
    var element;
    while ((element = this.parseSingle("")) != null)
        root.appendChild(element);
    return root;
}

LatexSource.prototype.parse = function()
{
//    var token;
//    for (; this.token != null; this.nextToken()) {
//        var tokenText = this.code.slice(this.token.offset,this.token.offset+this.token.length);
//        if (this.token.type == LatexToken.COMMENT) {
//            debug("Comment: \""+tokenText+"\"");
//        }
//        else if (this.token.type == LatexToken.TEXT) {
//            debug("Text: \""+tokenText+"\"");
//        }
//        else if (this.token.type == LatexToken.MACRO) {
//            debug("Macro: "+tokenText+"");
//        }
//        else {
//            debug("Character: "+tokenText);
//        }
//    }
//    debug("token = null");
    this.parseDocument();
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                //
//                                            main                                                //
//                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////

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
