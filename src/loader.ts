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
let loadAllModules: (mainScriptURL?: string) => void;

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

    // This function assumes that all / characters in a path will be separated by at least one
    // other character. We used to collapse multiple adjacent / characters into one, but this
    // breaks the scheme separator in URLs.

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

function determineModuleFilename(): string {
    // This function is called if there is no module id parameter supplied to define(). We try to
    // determine the filename of the module based on the <script> element that loaded the code
    // containing the define() call.
    //
    // On all modern browsers except IE, there is a currentScript property on the document we can
    // use to find this element. To cater for IE, we also check for the last <script> element in
    // document order. In doing so, we make the assumption (regardless of browser) that scripts
    // are being loaded synchronously (that is, the "async" attribute is missing or set to "false").
    //
    // If we're running in a browser that supports currentScript, we do a sanity check to verify
    // that it's the same as the last <script> element, to help identify cases where this loader
    // is being used with <script> elements that are either asynchronous or inserted into the
    // document somewhere before the last such element.

    let currentScriptElement = document.currentScript;
    let scripts = document.getElementsByTagName("script");
    let scriptsLength = scripts.length;
    let lastScriptElement = (scriptsLength > 0) ? scripts[scriptsLength-1] : null;

    let currentScriptSrc: string = null;
    let lastScriptSrc: string = null;

    // Note: The instanceof expressions below are type guards only; they will always be true if
    // the non-null check in the first part of the if statement is true.
    if ((currentScriptElement != null) && (currentScriptElement instanceof HTMLScriptElement))
        currentScriptSrc = currentScriptElement.src;

    if ((lastScriptElement != null) && (lastScriptElement instanceof HTMLScriptElement))
        lastScriptSrc = lastScriptElement.src;

    if ((currentScriptSrc != null) && (currentScriptSrc != lastScriptSrc)) {
        let currentQuoted = JSON.stringify(currentScriptSrc);
        let lastQuoted = JSON.stringify(lastScriptSrc);
        throw new Error("document.currentScript ("+currentQuoted+") differs from the last "+
                        "script element in the document ("+lastQuoted+"). This may be caused "+
                        "by asynchronous loading; the current module definition logic assumes "+
                        "that all scripts are loaded synchronously");
    }

    // If, at this point, currentScriptSrc is null - that's ok. We're probably running in IE.
    // All we wanted it for was as a sanity check that it doesn't differ from the last script
    // element.
    if (lastScriptSrc == null)
        throw new Error("Cannot find <script> element associated with current module definition");

    return lastScriptSrc;
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

    let moduleFilename: string = null;
    if (id == null) {
        moduleFilename = determineModuleFilename();
        if (moduleFilename == null)
            throw new Error("Cannot determine modile filename");
        id = moduleFilename.replace(/\.js$/,"");
    }
    else {
        moduleFilename = id+".js";
    }

    if (factory == null)
        throw new Error("No factory specified");

    if (dependencies == null)
        dependencies = ["require","exports","module"];

    modules[id] = new Module(id,dependencies,factory,moduleFilename);
}

let builtinNames: { [id: string]: boolean } = {
    "require": true,
    "exports": true,
    "module": true,
}

// This function is made available as a global function called require() after loadAllModules()
// has completed. The reason why it is not made available before then is that our loader, unlike
// require.js, does not support asynchronous loading. Assuming however that all of the required
// modules have been defined (e.g. via <script> element insertion), and loadAllModules() has been
// called, then require() can be used in the same way as in require.js and other AMD-based module
// loaders.
function postLoadRequire(mainScriptURL: string, names: string[], fun: () => any) {
    let baseDir: string = null;
    if (mainScriptURL != null) {
        let absScriptURL = resolvePath(window.location.href,mainScriptURL);
        baseDir = absScriptURL.replace(/[^/]*$/,"");
    }

    let args: string[] = [];
    for (let i = 0; i < names.length; i++) {
        let moduleName = (baseDir != null) ? resolvePath(baseDir,names[i]) : names[i];
        let importedModule = modules[moduleName];
        if (importedModule == null)
            throw new Error("No such module: "+moduleName);
        else
            args.push(importedModule.value);
    }

    fun.apply(null,args);
}

loadAllModules = function(mainScriptURL?: string): void {

    Object.keys(modules).sort().forEach(function(key) {
        let module = modules[key];
        module.dependencies.forEach(function(dep) {
            if (!builtinNames[dep]) {
                let resolved = resolvePath(module.filename,dep);
                let reference = modules[resolved];
                if (reference == null)
                    throw new Error("Module not found (from "+JSON.stringify(module.filename)+"): "+dep);
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

    // Now that we have loaded all of the modules, make require() available as a global function,
    // with the intention that it be used by JavaScript code embedded directly within the HTML
    // file. See demo-customloader.html for an example use case of this.
    let w: any = window;
    if (w.require != null)
        throw new Error("window.require is already defined");
    w.require = (names: string[], fun: () => any) => {
        postLoadRequire(mainScriptURL,names,fun);
    };
}

})();
