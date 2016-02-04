// This file is part of the Corinthia project (http://corinthia.io).
//
// See the COPYRIGHT.txt file distributed with this work for
// information regarding copyright ownership.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// FIXME: The _PREFIX variables below must be replaced with functions that return the
// appropriate namespace prefix for the document in question (since we can't rely on the
// values that LibreOffice/MS Word happen to use by default)

var XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";

// ODF

var OFFICE_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:office:1.0";
var STYLE_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:style:1.0";
var TEXT_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
var TABLE_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:table:1.0";
var FO_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0";
var SVG_NAMESPACE = "urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0";
var XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";

var OFFICE_PREFIX = "office:";
var STYLE_PREFIX = "style:";
var TEXT_PREFIX = "text:";
var TABLE_PREFIX = "table:";
var FO_PREFIX = "fo:";
var SVG_PREFIX = "svg:";
var XLINK_PREFIX = "xlink:";

// OOXML

var WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
var WORD_PREFIX = "w:";

var globalAPI = {};

var define;

(function() {

function resolvePath(base,path) {

    // Replace adjacent / characters with a single one
    base = base.replace(/\/+/g,"/");
    path = path.replace(/\/+/g,"/");

    var baseParts = base.split("/");
    var pathParts = path.split("/");

    if (baseParts.length == 0)
        throw new Error("Base filename has no parts");
    baseParts.pop();

    for (var i = 0; i < pathParts.length; i++) {
        if (pathParts[i] == ".") {
            // do nothing
        }
        else if (pathParts[i] == "..") {
            if (baseParts.length > 0)
                baseParts.pop();
            else
                baseParts.push("..");
        }
        else {
            baseParts.push(pathParts[i]);
        }
    }
    return baseParts.join("/");
}

function mapToLegacyModuleName(name) {
    if (name == "tests.testlib") {
        name = "tests.TestLib";
    }
    else if (name == "src.undo") {
        name = "UndoManager";
    }
    else if (name == "src.dom") {
        name = "DOM";
    }
    else if (name.startsWith("src.")) {
        name = name.substring(4);
        name = name[0].toUpperCase()+name.substring(1);
    }
    else if (name.startsWith("tests.")) {
        name = name.substring(6);
        name = name[0].toUpperCase()+name.substring(1);
        name = "tests."+name;
    }
    return name;
}

function getOrCreateModule(name) {
    if (typeof(name) !== "string")
        throw new Error("name is not a string: "+(typeof name));

    name = mapToLegacyModuleName(name);

    var path = name.split(".");
    var mod = globalAPI;
    for (var i = 0; i < path.length; i++) {
        if (mod[path[i]] === undefined)
            mod[path[i]] = {};
        mod = mod[path[i]];
    }
    return mod;
}

function reqmodule(name) {
    return getOrCreateModule(name);
}

define = function(...args) {
    var index = 0;
    var id = null;
    var dependencies = null;
    var factory = null;
    if ((index < args.length) && (args[index] != null) && (typeof(args[index]) == "string"))
        id = args[index++];
    if ((index < args.length) && (args[index] != null) && (args[index] instanceof Array))
        dependencies = args[index++];
    if ((index < args.length) && (args[index] != null) && (args[index] instanceof Function))
        factory = args[index++];

    var moduleFilename = "";
    var filePrefix = "";
    if (id == null) {
        if (window._nextDefineFilename == null)
            throw new Error("_nextDefineFilename is not set");
        moduleFilename = window._nextDefineFilename;
        filePrefix = moduleFilename.replace(/\/[^\/]+$/,"/");
        id = moduleFilename.replace(/\.js$/,"").replace(/\//g,".");
        window._nextDefineFilename = null;
    }

    if (factory == null)
        throw new Error("No factory specified");
    if (id == null)
        throw new Error("No id specified");

    if (dependencies == null)
        dependencies = ["require","exports","module"];

    var mod = getOrCreateModule(id);

    var factoryArgs = [];
    dependencies.forEach(function(dep) {
        if (dep == "require")
            factoryArgs.push(reqmodule);
        else if (dep == "exports")
            factoryArgs.push(mod);
        else if (dep == "module")
            factoryArgs.push(null);
        else {
            var resolved = resolvePath(moduleFilename,dep);
            var resolved2 = resolved.replace(/\//g,".");
            factoryArgs.push(getOrCreateModule(resolved2));
        }
    });

    factory.apply(null,factoryArgs);
}

})();
