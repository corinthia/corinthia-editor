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

(function(api) {

    var Figures = api.Figures; // export

    var Clipboard = api.Clipboard; // import
    var Cursor = api.Cursor; // import
    var DOM = api.DOM; // import
    var Outline = api.Outline; // import
    var Position = api.Position; // import
    var PostponedActions = api.PostponedActions; // import
    var Selection = api.Selection; // import
    var Traversal = api.Traversal; // import
    var UndoManager = api.UndoManager; // import
    var Util = api.Util; // import

    // public
    Figures.insertFigure = function(filename,width,numbered,caption) {
        UndoManager.newGroup("Insert figure");

        var figure = DOM.createElement(document,"FIGURE");
        var img = DOM.createElement(document,"IMG");
        DOM.setAttribute(img,"src",encodeURI(filename));
        DOM.setStyleProperties(img,{"width": width});
        DOM.appendChild(figure,img);

        if ((caption != null) && (caption != "")) {
            var figcaption = DOM.createElement(document,"FIGCAPTION");
            DOM.appendChild(figcaption,DOM.createTextNode(document,caption));
            DOM.appendChild(figure,figcaption);
        }

        Clipboard.pasteNodes([figure]);

        // Now that the figure has been inserted into the DOM tree, the outline code will
        // have noticed it and added an id attribute, as well as a caption giving the
        // table number.
        Outline.setNumbered(figure.getAttribute("id"),numbered);

        // Place the cursor directly after the figure
        var offset = DOM.nodeOffset(figure);
        var pos = new Position.Position(figure.parentNode,offset);
        pos = Position.closestMatchForwards(pos,Position.okForMovement);
        Selection.set(pos.node,pos.offset,pos.node,pos.offset);

        PostponedActions.add(UndoManager.newGroup);
    }

    Figures.getSelectedFigureId = function() {
        var element = Cursor.getAdjacentNodeWithType(HTML_FIGURE);
        return element ? element.getAttribute("id") : null;
    }

    // public
    Figures.getProperties = function(itemId) {
        var figure = document.getElementById(itemId);
        if (figure == null)
            return null;
        var rect = figure.getBoundingClientRect();
        var result = { width: null, src: null };

        var img = Traversal.firstDescendantOfType(figure,HTML_IMG);
        if (img != null) {
            result.src = decodeURI(img.getAttribute("src"));
            result.width = img.style.width;

            if ((result.width == null) || (result.width == ""))
                result.width = DOM.getAttribute(img,"width");
        }
        return result;
    }

    // public
    Figures.setProperties = function(itemId,width,src) {
        var figure = document.getElementById(itemId);
        if (figure == null)
            return null;
        var img = Traversal.firstDescendantOfType(figure,HTML_IMG);
        if (img != null) {
            if (src == null)
                DOM.removeAttribute(img,"src");
            else
                DOM.setAttribute(img,"src",encodeURI(src));

            DOM.setStyleProperties(img,{"width": width});
            if (img.getAttribute("style") == "")
                DOM.removeAttribute(img,"style");
            Selection.update();
        }
    }

    // public
    Figures.getGeometry = function(itemId) {
        var figure = document.getElementById(itemId);
        if ((figure == null) || (figure.parentNode == null))
            return null;
        var img = Traversal.firstDescendantOfType(figure,HTML_IMG);
        if (img == null)
            return null;

        var figcaption = Traversal.firstChildOfType(figure,HTML_FIGCAPTION);

        var result = new Object();
        result.contentRect = Util.xywhAbsElementRect(img);
        result.fullRect = Util.xywhAbsElementRect(figure);
        result.parentRect = Util.xywhAbsElementRect(figure.parentNode);
        result.hasCaption = (figcaption != null);
        return result;
    }

})(globalAPI);
