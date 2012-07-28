function getNodeArrayText(nodes)
{
    var strings = new Array();
    for (var i = 0; i < nodes.length; i++)
        strings.push(getNodeText(nodes[i]));
    return strings.join("");
}

function textBetweenPositions(from,to)
{
    var range = new Range(from.node,from.offset,to.node,to.offset);
    var contents = range.cloneContents();
    return getNodeArrayText(contents);
}

function testCursorMovement(movementFun)
{
    var start = new Position(document.body,0);
    var end = new Position(document.body,document.body.childNodes.length);
    var lines = new Array();


    for (var pos = start; pos != null; pos = pos.next()) {

        var oldBefore = textBetweenPositions(start,pos);
        var oldAfter = textBetweenPositions(pos,end);
        var oldTotal = oldBefore+"|"+oldAfter;


        Selection_set(pos.node,pos.offset,pos.node,pos.offset);
        movementFun();
        var newPos = Selection_get().start;
        
        var newBefore = textBetweenPositions(start,newPos);
        var newAfter = textBetweenPositions(newPos,end);
        var newTotal = newBefore+"|"+newAfter;


        lines.push(JSON.stringify(oldTotal.trim())+
                   " -> "+
                   JSON.stringify(newTotal.trim()));
    }

    return lines.join("\n");
}

function testMovement(direction,count)
{
    Outline_init();
    PostponedActions_perform();
    var posId = Input_addPosition(Selection_get().start);
    for (var i = 0; i < count; i++)
        posId = Input_positionFromPositionInDirectionOffset(posId,direction,1);
    Input_setSelectedTextRange(posId,posId);
    showSelection();
}
