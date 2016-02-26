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

let define: (...args: any[]) => void;
let loadAllModules: () => void;

class Module {
    public imports: Module[] = [];
    public factoryArgs: any[] = [];
    public exports: any;
    public value: any;
    public firstImportedFrom: string;
    public changed: boolean = false;
    constructor(public id: string, public dependencies: string[],
                public factory: Function, public filename: string) {
        this.value = this.exports = {};
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

function reqmodule(currentModuleId: string, name: string): Object {
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
        id = moduleFilename.replace(/\.js$/,"");
        window._nextDefineFilename = null;
    }

    if (factory == null)
        throw new Error("No factory specified");
    if (id == null)
        throw new Error("No id specified");

    if (dependencies == null)
        dependencies = ["require","exports","module"];

    modules[id] = new Module(id,dependencies,factory,moduleFilename);
}

let builtinNames: { [id: string]: boolean } = {
    "require": true,
    "exports": true,
    "module": true,
}

loadAllModules = function() {

    Object.keys(modules).sort().forEach(function(key) {
        let module = modules[key];
        module.dependencies.forEach(function(dep) {
            if (!builtinNames[dep]) {
                let resolved = resolvePath(module.filename,dep);
                let reference = modules[resolved];
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
        module.dependencies.forEach(function(dep) {
            if (dep == "require")
                module.factoryArgs.push(localRequire);
            else if (dep == "exports")
                module.factoryArgs.push(module.exports);
            else if (dep == "module")
                module.factoryArgs.push(null);
            else {
                module.factoryArgs.push(localRequire(dep));
            }

            function localRequire(relativeName: string) {
                let absoluteName = resolvePath(module.filename,relativeName);
                let importedModule = modules[absoluteName];
                if (importedModule == null)
                    throw new Error("No such module: "+absoluteName+" (while loading "+module.id+")");
                return importedModule.value;
            }
        });

        let result = module.factory.apply(null,module.factoryArgs);
        if (result != null) {
            module.value = result;
            if (module.firstImportedFrom != null)
                module.changed = true;
        }
    });
}

})();
