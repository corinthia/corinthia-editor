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

let globalAPI = {};

let define;

(function() {

function resolvePath(base: string, path: string): string {

    // Replace adjacent / characters with a single one
    base = base.replace(/\/+/g,"/");
    path = path.replace(/\/+/g,"/");

    let baseParts = base.split("/");
    let pathParts = path.split("/");

    if (baseParts.length == 0)
        throw new Error("Base filename has no parts");
    baseParts.pop();

    for (let i = 0; i < pathParts.length; i++) {
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

function mapToLegacyModuleName(name: string): string {
    if (name == "tests.testlib") {
        name = "tests.TestLib";
    }
    else if (name == "src.undo") {
        name = "UndoManager";
    }
    else if (name == "src.dom") {
        name = "DOM";
    }
    else if (name.match(/^src\./)) {
        name = name.substring(4);
        name = name[0].toUpperCase()+name.substring(1);
    }
    else if (name.match(/^tests\./)) {
        name = name.substring(6);
        name = name[0].toUpperCase()+name.substring(1);
        name = "tests."+name;
    }
    return name;
}

function getOrCreateModule(name: string): Object {
    // This function may be called (indirectly) from regular JavaScript, hence the sanity
    // check here; we can't rely on the TypeScript compiler for untyped code.
    if (typeof(name) !== "string")
        throw new Error("name is not a string: "+(typeof name));

    name = mapToLegacyModuleName(name);

    let path = name.split(".");
    let mod = globalAPI;
    for (let i = 0; i < path.length; i++) {
        if (mod[path[i]] === undefined)
            mod[path[i]] = {};
        mod = mod[path[i]];
    }
    return mod;
}

function reqmodule(name: string): Object {
    return getOrCreateModule(name);
}

define = function(...args) {
    let index = 0;
    let id = null;
    let dependencies = null;
    let factory = null;
    if ((index < args.length) && (args[index] != null) && (typeof(args[index]) == "string"))
        id = args[index++];
    if ((index < args.length) && (args[index] != null) && (args[index] instanceof Array))
        dependencies = args[index++];
    if ((index < args.length) && (args[index] != null) && (args[index] instanceof Function))
        factory = args[index++];

    let moduleFilename = "";
    let filePrefix = "";
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

    let mod = getOrCreateModule(id);

    let factoryArgs = [];
    dependencies.forEach(function(dep) {
        if (dep == "require")
            factoryArgs.push(reqmodule);
        else if (dep == "exports")
            factoryArgs.push(mod);
        else if (dep == "module")
            factoryArgs.push(null);
        else {
            let resolved = resolvePath(moduleFilename,dep);
            let resolved2 = resolved.replace(/\//g,".");
            factoryArgs.push(getOrCreateModule(resolved2));
        }
    });

    factory.apply(null,factoryArgs);
}

})();
