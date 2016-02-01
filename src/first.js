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

function getOrCreateModule(name) {
    if (typeof(name) !== "string")
        throw new Error("name is not a string: "+(typeof name));

    var path = name.split(".");
    // console.log("path = "+JSON.stringify(path));
    var mod = globalAPI;
    for (var i = 0; i < path.length; i++) {
        if (mod[path[i]] === undefined)
            mod[path[i]] = {};
        mod = mod[path[i]];
        // console.log("path[i] = "+path[i]);
        // console.log("mod = ",mod);
    }
    return mod;
}

function require(name) {
    return getOrCreateModule(name);
}

define = function(name,fn) {
    if (!(fn instanceof Function))
        throw new Error("fn is not a function: "+(typeof fn));

    var mod = getOrCreateModule(name);
    fn(require,mod,null);
}

})();
