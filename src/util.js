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

function encodeJSON(obj)
{
    var builder = new StringBuilder();
    encodeJSONRecursive(obj,builder);
    return builder.str;

    function encodeJSONRecursive(obj,builder)
    {
        if (obj instanceof Array) {
            builder.str += "[ ";
            for (var i = 0; i < obj.length; i++) {
                if (i > 0)
                    builder.str += ", ";
                encodeJSONRecursive(obj[i],builder);
            }
            builder.str += " ]";
        }
        else if ((obj instanceof String) || (typeof obj == "string")) {
            builder.str += "\"" + quoteString(obj) + "\"";
        }
        else if (obj instanceof Object) {
            builder.str += "{ ";
            var i = 0;
            for (var name in obj) {
                if (i > 0)
                    builder.str += ", ";
                builder.str += "\"" + quoteString(name) + "\": ";
                encodeJSONRecursive(obj[name],builder);
                i++;
            }
            builder.str += " }";
        }
        else {
            builder.str += obj.toString();
        }
    }
}
