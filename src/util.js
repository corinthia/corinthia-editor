// Copyright (c) 2011-2012 UX Productivity. All rights reserved.

function isWordChar(c)
{
    return (((c >= "a") && (c <= "z")) ||
            ((c >= "A") && (c <= "Z")) ||
            ((c >= "0") && (c <= "9")));
}

function arrayContains(array,value)
{
    for (var i = 0; i < array.length; i++) {
        if (array[i] == value)
            return true;
    }
    return false;
}

function quoteString(str)
{
    if (str == null)
        return null;

    if (str.indexOf('"') < 0)
        return str;

    var quoted = "";
    for (var i = 0; i < str.length; i++) {
        if (str.charAt(i) == '"')
            quoted += "\\\"";
        else
            quoted += str.charAt(i);
    }
    return quoted;
}
