var allPositions;
var allPositionsIndexMap;

function positionKey(pos)
{
    return pos.node._nodeId+","+pos.offset;
}

function removeWhitespaceTextNodes(parent)
{
    var next;
    for (var child = parent.firstChild; child != null; child = next) {
        next = child.nextSibling;
        if (isWhitespaceTextNode(child) || (child.nodeType == Node.COMMENT_NODE))
            DOM.removeChild(parent,child);
        else
            removeWhitespaceTextNodes(child);
    }
}

function setup(root)
{
    DOM.assignNodeIds(document);
    allPositions = getAllPositions(root);

    allPositionsIndexMap = new Object();
    for (var i = 0; i < allPositions.length; i++) {
        var pos = allPositions[i];
        allPositionsIndexMap[positionKey(pos)] = i;
    }
}

function getAllPositions(root)
{
    var includeEmptyElements = true;

    var positions = new Array();
    var rootOffset = getOffsetOfNodeInParent(root);
    var sig = 0;
    positions.push(new Position(root.parentNode,rootOffset));
    recurse(root);
    positions.push(new Position(root.parentNode,rootOffset+1));
    return positions;

    function recurse(node)
    {
        if (node.nodeType == Node.TEXT_NODE) {
            for (var offset = 0; offset <= node.nodeValue.length; offset++)
                positions.push(new Position(node,offset));
        }
        else if ((node.nodeType == Node.ELEMENT_NODE) &&
                 (node.firstChild != null) || includeEmptyElements) {
            var offset = 0;
            for (var child = node.firstChild; child != null; child = child.nextSibling) {
                positions.push(new Position(node,offset));
                recurse(child);
                offset++;
                sig++;
            }
            positions.push(new Position(node,offset));
        }
    }
}

function getPositionIndex(pos)
{
    var result = allPositionsIndexMap[pos.node._nodeId+","+pos.offset];
    if (result == null)
        throw new Error(pos+": no index for position");
    return result;
}

function isForwardsSimple(range)
{
    var startIndex = getPositionIndex(range.start);
    var endIndex = getPositionIndex(range.end);
//    debug("startIndex = "+indices.startIndex+", endIndex = "+indices.endIndex);
    return (endIndex >= startIndex);
}

function getOutermostNodesSimple(range)
{
    if (!isForwardsSimple(range)) {
        var reverse = new Range(range.end.node,range.end.offset,
                                range.start.node,range.start.offset);
        if (!reverse.isForwards()) {
            var startIndex = getPositionIndex(range.start);
            var endIndex = getPositionIndex(range.end);
            debug("startIndex = "+startIndex+", endIndex = "+endIndex);
            throw new Error("Both range "+range+" and its reverse are not forwards");
        }
        return getOutermostNodesSimple(reverse);
    }

    var startIndex = getPositionIndex(range.start);
    var endIndex = getPositionIndex(range.end);
    var havePositions = new Object();

    var allArray = new Array();
    var allSet = new NodeSet();

    for (var i = startIndex; i <= endIndex; i++) {
        var pos = allPositions[i];

        if ((pos.node.nodeType == Node.TEXT_NODE) && (i < endIndex)) {
            var add = true;

            if ((i == startIndex) && (pos.node.nodeValue.length > 0) &&
                (pos.offset == pos.node.nodeValue.length))
                add = false;

            if (add) {
                allArray.push(pos.node);
                allSet.add(pos.node);
            }
        }
        else if (pos.node.nodeType == Node.ELEMENT_NODE) {
            var prev = new Position(pos.node,pos.offset-1);
            if (havePositions[positionKey(prev)]) {
                var target = pos.node.childNodes[pos.offset-1];
                allArray.push(target);
                allSet.add(target);
            }
            havePositions[positionKey(pos)] = true;
        }

    }

    var outermostArray = new Array();
    var outermostSet = new NodeSet();

    allArray.forEach(function (node) {
        if (!outermostSet.contains(node) && !setContainsAncestor(allSet,node)) {
            outermostArray.push(node);
            outermostSet.add(node);
        }
    });

    return outermostArray;

    function setContainsAncestor(set,node)
    {
        for (var ancestor = node.parentNode; ancestor != null; ancestor = ancestor.parentNode) {
            if (set.contains(ancestor))
                return true;
        }
        return false;
    }
}
