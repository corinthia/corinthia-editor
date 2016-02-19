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

import ElementTypes = require("./elementTypes");
import Traversal = require("./traversal");
import Types = require("./types");
import Util = require("./util");

// private
function blockToText(md: MarkdownBuilder, node: Node, indent: string, nextIndent: string,
                     listType: string, listNo: { value: number }): void {
    let linesBetweenChildren = 1;
    let childIndent = indent;
    switch (node._type) {
    case ElementTypes.HTML_LI:
        if (listType == "OL") {
            let listMarker: string;
            if (listNo.value < 10)
                listMarker = listNo.value+".  ";
            else
                listMarker = listNo.value+". ";
            beginParagraph(md,0,indent,nextIndent,listMarker);
            nextIndent += "    ";
        }
        else {
            beginParagraph(md,0,indent,nextIndent,"  - ");
            nextIndent += "    ";
        }
        listNo.value++;
        break;
    case ElementTypes.HTML_UL:
        listType = "UL";
        listNo = { value: 1 };
        beginParagraph(md,1,indent,nextIndent);
        linesBetweenChildren = 0;
        break;
    case ElementTypes.HTML_OL:
        listType = "OL";
        listNo = { value: 1 };
        beginParagraph(md,1,indent,nextIndent);
        linesBetweenChildren = 0;
        break;
    case ElementTypes.HTML_H1:
        beginParagraph(md,1,indent,nextIndent,"# "," #");
        break;
    case ElementTypes.HTML_H2:
        beginParagraph(md,1,indent,nextIndent,"## "," ##");
        break;
    case ElementTypes.HTML_H3:
        beginParagraph(md,1,indent,nextIndent,"### "," ###");
        break;
    case ElementTypes.HTML_H4:
        beginParagraph(md,1,indent,nextIndent,"#### "," ####");
        break;
    case ElementTypes.HTML_H5:
        beginParagraph(md,1,indent,nextIndent,"##### "," #####");
        break;
    case ElementTypes.HTML_H6:
        beginParagraph(md,1,indent,nextIndent,"###### "," ######");
        break;
    case ElementTypes.HTML_BLOCKQUOTE:
        beginParagraph(md,1,indent,nextIndent,"> ");
        nextIndent += "> ";
        break;
    case ElementTypes.HTML_PRE:
        md.preDepth++;
        break;
    }

    let foundNonWhitespaceChild = false;
    for (let child = node.firstChild; child != null; child = child.nextSibling) {
        if (Types.isContainerNode(child) || Types.isParagraphNode(child)) {
            beginParagraph(md,linesBetweenChildren,indent,nextIndent);
            blockToText(md,child,indent,nextIndent,listType,listNo);
            beginParagraph(md,linesBetweenChildren);
            indent = nextIndent;
            foundNonWhitespaceChild = false;
        }
        else {
            if (!foundNonWhitespaceChild) {
                if (Traversal.isWhitespaceTextNode(child))
                    continue;
                beginParagraph(md,0,indent,nextIndent);
                indent = nextIndent;
                foundNonWhitespaceChild = true;
            }

            inlineToText(md,child);
        }
    }

    if (node._type == ElementTypes.HTML_PRE)
        md.preDepth--;
}

// private
function shipOutParagraph(md: MarkdownBuilder): void {
    let text = md.buildParagraph.join("");
    if (md.buildPre) {
        text = text.replace(/\n$/,"");
        text = "    "+text.replace(/\n/g,"\n"+md.nextIndent+"    ");
    }
    else {
        text = Util.normalizeWhitespace(text);
    }
    if (md.allText.length > 0) {
        for (let i = 0; i < md.buildLines; i++)
            md.allText.push("\n");
    }
    md.allText.push(md.indent+md.buildPrefix+text+md.buildSuffix+"\n");
    resetBuild(md);
}

// private
function beginParagraph(md: MarkdownBuilder, blankLines?: number, indent?: string,
                        nextIndent?: string, paraPrefix?: string, paraSuffix?: string): void {
    if (blankLines == null)
        blankLines = 1;
    if (indent == null)
        indent = "";
    if (nextIndent == null)
        nextIndent = "";
    if (paraPrefix == null)
        paraPrefix = "";
    if (paraSuffix == null)
        paraSuffix = "";

    if (md == null)
        throw new Error("beginParagraph: md is null");
    if (md.buildParagraph == null)
        throw new Error("beginParagraph: md.buildParagraph is null");

    if (md.buildParagraph.length > 0) {
        shipOutParagraph(md);
    }

    if (md.buildLines < blankLines)
        md.buildLines = blankLines;
    if (md.indent.length < indent.length)
        md.indent = indent;
    if (md.nextIndent.length < nextIndent.length)
        md.nextIndent = nextIndent;
    md.buildPrefix += paraPrefix;
    md.buildSuffix = paraSuffix + md.buildSuffix;
    if (md.preDepth > 0)
        md.buildPre = true;
}

// private
function inlineToText(md: MarkdownBuilder, node: Node): void {
    switch (node._type) {
    case ElementTypes.HTML_TEXT: {
        let text = node.nodeValue;
        if (md.preDepth == 0) {
            text = text.replace(/\\/g,"\\\\");
            text = text.replace(/\*/g,"\\*");
            text = text.replace(/\[/g,"\\[");
            text = text.replace(/\]/g,"\\]");
        }
        md.buildParagraph.push(text);
        break;
    }
    case ElementTypes.HTML_I:
    case ElementTypes.HTML_EM:
        md.buildParagraph.push("*");
        processChildren();
        md.buildParagraph.push("*");
        break;
    case ElementTypes.HTML_B:
    case ElementTypes.HTML_STRONG:
        md.buildParagraph.push("**");
        processChildren();
        md.buildParagraph.push("**");
        break;
    case ElementTypes.HTML_A:
        if ((node instanceof HTMLElement) && node.hasAttribute("href")) {
            md.buildParagraph.push("[");
            processChildren();
            md.buildParagraph.push("]("+node.getAttribute("href")+")");
        }
        break;
    default:
        processChildren();
        break;
    }

    function processChildren(): void {
        for (let child = node.firstChild; child != null; child = child.nextSibling) {
            inlineToText(md,child);
        }
    }
}

// private
function resetBuild(md: MarkdownBuilder): void {
    md.buildParagraph = new Array();
    md.buildLines = 0;
    md.buildPrefix = "";
    md.buildSuffix = "";
    md.buildPre = false;
    md.indent = "";
    md.nextIndent = "";
}

// private
class MarkdownBuilder {

    public allText: string[];
    public preDepth: number;

    public buildParagraph: string[];
    public buildLines: number;
    public buildPrefix: string;
    public buildSuffix: string;
    public buildPre: boolean;
    public indent: string;
    public nextIndent: string;

}

// public
export function htmlToMarkdown(node: Node): string {
    let md = new MarkdownBuilder();
    md.allText = new Array();
    md.preDepth = 0;
    resetBuild(md);

    if (Types.isContainerNode(node) || Types.isParagraphNode(node)) {
        blockToText(md,node,"","","UL",{value: 1});
        beginParagraph(md);
        return md.allText.join("");
    }
    else {
        inlineToText(md,node);
        return Util.normalizeWhitespace(md.buildParagraph.join(""));
    }
}
