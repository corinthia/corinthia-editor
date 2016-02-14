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

class NodeSetMembers {
    [key: number]: Node;
}

export class NodeSet {

    private members: NodeSetMembers;

    constructor() {
        this.members = new NodeSetMembers();
    }

    public add(node: Node): void {
        if (node._nodeId == null)
            throw new Error("NodeSet.add: node "+node.nodeName+" has no _nodeId property");
        this.members[node._nodeId] = node;
    }

    public remove(node: Node): void {
        if (node._nodeId == null)
            throw new Error("NodeSet.remove: node "+node.nodeName+" has no _nodeId property");
        delete this.members[node._nodeId];
    }

    public contains(node: Node): boolean {
        if (node._nodeId == null)
            throw new Error("NodeSet.contains: node "+node.nodeName+" has no _nodeId property");
        return (this.members[node._nodeId] != null);
    }

    public toArray(): Node[] {
        let result = new Array();
        for (let id in this.members)
            result.push(this.members[id]);
        return result;
    }

    public forEach(fun: (key: Node) => void): void {
        let ids = Object.getOwnPropertyNames(this.members);
        let set = this;
        ids.forEach(function(id) { fun(set.members[id]); });
    }

    public ancestor(): NodeSet {
        let result = new NodeSet();
        this.forEach(function (node) {
            for (let p = node.parentNode; p != null; p = p.parentNode)
                result.add(p);
        });
        return result;
    }

    public ancestorOrSelf(): NodeSet {
        let result = new NodeSet();
        this.forEach(function (node) {
            for (let p = node; p != null; p = p.parentNode)
                result.add(p);
        });
        return result;
    }

    public descendant(): NodeSet {
        let result = new NodeSet();
        this.forEach(function (node) {
            recurse(node);
        });
        return result;

        function recurse(node: Node): void {
            for (let child = node.firstChild; child != null; child = child.nextSibling) {
                result.add(child);
                recurse(child);
            }
        }
    }

    public descendantOrSelf(): NodeSet {
        let result = new NodeSet();
        this.forEach(function (node) {
            recurse(node);
        });
        return result;

        function recurse(node: Node): void {
            result.add(node);
            for (let child = node.firstChild; child != null; child = child.nextSibling)
                recurse(child);
        }
    }

    public union(other): NodeSet {
        let result = new NodeSet();
        this.forEach(function (node) { result.add(node); });
        other.forEach(function (node) { result.add(node); });
        return result;
    }

    public intersection(other): NodeSet {
        let result = new NodeSet();
        this.forEach(function (node) { if (other.contains(node)) { result.add(node); } });
        return result;
    }

    // FIXME: This should be a static method. Is it actually used?
    public fromArray(array): NodeSet {
        let set = new NodeSet();
        array.forEach(function(node) { set.add(node); });
        return set;
    }

}

class NodeMapKeys {
    [key: number]: Node;
}

class NodeMapValues<T> {
    [key: number]: T;
}

export class NodeMap<T> {

    private keys: NodeMapKeys;
    private values: NodeMapValues<T>;

    constructor() {
        this.keys = new NodeMapKeys();
        this.values = new NodeMapValues<T>();
    }

    public clear(): void {
        this.keys = new NodeMapKeys();
        this.values = new NodeMapValues<T>();
    }

    public get(key: Node): T {
        if (key._nodeId == null)
            throw new Error("NodeMap.get: key has no _nodeId property");
        return this.values[key._nodeId];
    }

    public put(key: Node, value: T): void {
        if (key._nodeId == null)
            throw new Error("NodeMap.add: key has no _nodeId property");
        this.keys[key._nodeId] = key;
        this.values[key._nodeId] = value;
    }

    public remove(key: Node): void {
        if (key._nodeId == null)
            throw new Error("NodeMap.remove: key has no _nodeId property");
        delete this.keys[key._nodeId];
        delete this.values[key._nodeId];
    }

    public containsKey(key: Node): boolean {
        if (key._nodeId == null)
            throw new Error("NodeMap.contains: key has no _nodeId property");
        return (this.values[key._nodeId] != null);
    }

    public getKeys(): Node[] {
        let ids = Object.getOwnPropertyNames(this.values);
        let result = new Array<Node>(ids.length);
        for (let i = 0; i < ids.length; i++)
            result[i] = this.keys[ids[i]];
        return result;
    }

    public forEach(fun: (key: Node, value: T) => void): void {
        let ids = Object.getOwnPropertyNames(this.values);
        let map = this;
        ids.forEach(function(id) { fun(map.keys[id],map.values[id]); });
    }

    // FIXME: This should be a static method. Is it actually used?
    public fromArray(array: Node[], fun: (key: Node) => T): NodeMap<T> {
        let map = new NodeMap<T>();
        if (fun != null)
            array.forEach(function(node) { map.put(node,fun(node)); });
        else
            array.forEach(function(node) { map.put(node,null); });
        return map;
    };

}
