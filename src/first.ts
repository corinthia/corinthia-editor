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

let globalAPI = {};

let define: (...args: any[]) => void;
let loadAllModules: () => void;

class Module {
    public imports: Module[] = [];
    public factoryArgs: any[] = [];
    public filename: string;
    public exports: any;
    public value: any;
    public firstImportedFrom: string;
    public changed: boolean = false;
    constructor(public id: string, public dependencies: string[], public factory: Function) {
    }
}

(function() {

let modules: { [id: string]: Module } = {};

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

function updateModuleValue(name: string, value: any): void {
    name = mapToLegacyModuleName(name);

    let path = name.split(".");
    let mod = globalAPI;
    for (let i = 0; i < path.length-1; i++) {
        mod = mod[path[i]];
    }
    mod[path[path.length-1]] = value;
}

let currentModuleId: string = null;

function reqmodule(name: string): Object {
    if (modules[name] == null)
        throw new Error("No such module: "+name);
    if ((modules[name].firstImportedFrom != null) && modules[name].changed)
        throw new Error("Attempt to load module "+name+", whose value has changed (from "+currentModuleId+
                        "; first import was from "+modules[name].firstImportedFrom+")");
    if (currentModuleId == null)
        modules[name].firstImportedFrom = "(unknown)";
    else
        modules[name].firstImportedFrom = currentModuleId;
    return modules[name].value;
}

define = function(...args: any[]): void {
    let index = 0;
    let id: string = null;
    let dependencies: string[] = null;
    let factory: Function = null;
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

    currentModuleId = id;

    if (factory == null)
        throw new Error("No factory specified");
    if (id == null)
        throw new Error("No id specified");

    if (dependencies == null)
        dependencies = ["require","exports","module"];

    modules[id] = new Module(id,dependencies,factory);
    modules[id].filename = moduleFilename;
    modules[id].exports = getOrCreateModule(id);
    modules[id].value = modules[id].exports;
}

let builtinNames: { [id: string]: boolean } = {
    "require": true,
    "exports": true,
    "module": true,
}

function getModule(filename: string, dep: string) {
    let resolved = resolvePath(filename,dep);
    let resolved2 = resolved.replace(/\//g,".");
    return modules[resolved2];
}

loadAllModules = function() {

    Object.keys(modules).sort().forEach(function(key) {
        let module = modules[key];
        module.dependencies.forEach(function(dep) {
            if (!builtinNames[dep]) {
                let reference = getModule(module.filename,dep);
                if (reference == null)
                    throw new Error("Module not found (from "+module.filename+"): "+dep);
                module.imports.push(reference);
            }
        });
    })

    let remaining: { [id: string]: Module } = {};
    for (let id in modules) {
        let module = modules[id];
        remaining[id] = module;
    }

    let loadOrder: Module[] = [];

    let allIds: string[] = Object.keys(remaining).sort();
    let allModules: Module[] = allIds.map(function(id) { return remaining[id]; });
    let recurseCount = 0;
    allModules.forEach(function(topModule) {
        let stack: string[] = [];
        recurse(topModule);
        return;

        function recurse(module: Module): void {
            if (!remaining[module.id])
                return;
            let index = stack.indexOf(module.id);
            if (index >= 0)
                return; // Circular reference; ignore

            stack.push(module.id);
            module.imports.forEach(recurse);
            stack.pop();

            delete remaining[module.id];
            loadOrder.push(module);
            recurseCount++;
        }
    });

    loadOrder.forEach(function(module) {
        currentModuleId = module.id;
        module.dependencies.forEach(function(dep) {
            if (dep == "require")
                module.factoryArgs.push(reqmodule);
            else if (dep == "exports")
                module.factoryArgs.push(module.exports);
            else if (dep == "module")
                module.factoryArgs.push(null);
            else {
                let resolved = resolvePath(module.filename,dep);
                let resolved2 = resolved.replace(/\//g,".");
                let importedModule = modules[resolved2];
                if (importedModule == null)
                    throw new Error("No such module: "+resolved2+" (while loading "+module.id+")");
                module.factoryArgs.push(reqmodule(resolved2));
            }
        });

        let result = module.factory.apply(null,module.factoryArgs);
        if (result != null) {
            module.value = result;
            if (module.firstImportedFrom != null)
                module.changed = true;
            updateModuleValue(module.id,result);
        }
    });
}

})();
