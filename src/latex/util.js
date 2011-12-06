function debug(str)
{
    console.log(str);
}

function StringBuilder()
{
    this.strings = new Array();
}

StringBuilder.prototype.append = function(str)
{
    this.strings.push(str);
}

StringBuilder.prototype.toString = function()
{
    return this.strings.join("");
}

