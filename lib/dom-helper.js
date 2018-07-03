import util from 'ffd-util';

export default {
    getRect(node) {
        let rect = node.getBoundingClientRect();
        if (!rect.width) {
            let left = rect.left,
                top = rect.top,
                right = rect.right,
                bottom = rect.bottom;
            return {
                left: left,
                top: top,
                right: right,
                bottom: bottom,
                width: right - left,
                height: bottom - top
            };
        } else {
            return rect;
        }
    },
    isAncestor(pnode, cnode, same) {
        this.isAncestor = document.body.contains ?
            function(pnode, cnode, same) {
                if (!pnode || !cnode) return false;
                return pnode.contains(cnode) && (same === true || pnode !== cnode);
            } :
            (document.compareDocumentPosition ?
                function(pnode, cnode, same) {
                    if (!pnode || !cnode) return false;
                    var tag = pnode.compareDocumentPosition(cnode);
                    return tag === 16 || (same === true && tag === 0);
                } :
                function(pnode, cnode, same) {
                    if (!pnode || !cnode) return false;
                    if (pnode === cnode) return !!same;
                    do {
                        cnode = cnode.parentNode;
                        if (cnode === pnode) return true;
                    } while (cnode);
                    return false;
                });
        return this.isAncestor.apply(this, arguments);
    },
    firstElement(node) {
        if (!node) return null;
        node = node.firstChild;
        return !node || node.nodeType === 1 ? node : this.nextElement(node);
    },
    lastElement(node) {
        if (!node) return null;
        node = node.lastChild;
        return !node || node.nodeType === 1 ? node : this.prevElement(node);
    },
    nextElement(node) {
        if (!node) return null;
        do {
            node = node.nextSibling;
        } while (node && node.nodeType !== 1);
        return node;
    },
    prevElement(node) {
        if (!node) return null;
        do {
            node = node.previousSibling;
        } while (node && node.nodeType !== 1);
        return node;
    },
    addClass(node, className) {
        if (!node || node.nodeType !== 1 || !className || !util.isString(className)) return;
        var clsNames = node.className;
        if (arguments[2] !== false) {
            if (clsNames) {
                if (clsNames.split(' ').indexOf(className) !== -1) return;
                className = clsNames + ' ' + className;
            }
            node.className = className;
        } else {
            var clsNames = node.className,
                classNames = className.split(' ');
            clsNames = clsNames ? clsNames.split(' ') : [];
            for (var i = 0, len = classNames.length; i < len; i++) {
                className = classNames[i];
                if (className && clsNames.indexOf(className) === -1) clsNames.push(className);
            }
            node.className = clsNames.join(' ');
        }
    },
    removeClass(node, className) {
        if (!node || node.nodeType !== 1 || !className) return;
        var clsNames = node.className;
        if (!clsNames) return;
        clsNames = clsNames.split(' ');
        if (arguments[2] !== false) {
            if (!util.isString(className)) return;
            var index = clsNames.indexOf(className);
            if (index === -1) return;
            clsNames.splice(index, 1);
        } else {
            var classNames, newClsNames = [];
            if (util.isString(className)) {
                classNames = className.split(' ');
            } else if (util.isArray(className)) {
                classNames = className;
            } else {
                return;
            }
            for (var i = 0, len = clsNames.length; i < len; i++) {
                className = clsNames[i];
                if (className && classNames.indexOf(className) === -1) newClsNames.push(className);
            }
            clsNames = newClsNames;
        }
        node.className = clsNames.join(' ');
    }
}