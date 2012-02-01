function insertAtPosition(position,node)
{
    if (position.node.nodeType == Node.ELEMENT_NODE) {
        if (position.offset == position.node.childNodes.length)
            position.node.appendChild(node);
        else
            position.node.insertBefore(node,position.node.childNodes[position.offset]);
    }
}
