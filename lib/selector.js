import './selector.scss';

import util from 'ffd-util';
import { Timeout } from 'ffd-util';
import DomHelper from './dom-helper';

export default {
    mousedown(evt) {
        resetParentRect();
        let target = evt.target;
        if (target.className === CLS_SELECT_RESIZE_BUTTON) {
            mode = MODE_RESIZE;
        } else if (util.isFunction(Config.onselect)) {
            mode = MODE_SELECT;
            Timeout.add({
                handler: setDragMode,
                args: evt
            });
        } else {
            this.dragstart(evt);
        }
        startEvent = { pageX: evt.pageX, pageY: evt.pageY, target: target };
        evt.preventDefault();
    },
    dragstart(evt) {
        if (!evt) return false;
        resetParentRect();
        mode = MODE_DRAG;
        startEvent = evt;
    },
    mousemove(evt) {
        switch (mode) {
            case MODE_NONE:
                break;
            case MODE_SELECT:
                if (parsePosition(evt, readySelectElem, initSelectElem)) {
                    mode |= MODE_READY;
                    Timeout.remove(setDragMode);
                }
                break;
            case MODE_DRAG:
                if (readyDragLines(evt)) {
                    mode |= MODE_READY;
                }
                break;
            case MODE_RESIZE:
                if (readyResizeElem(evt)) {
                    mode |= MODE_READY;
                }
                break;
            default:
                switch (mode % MODE_READY) {
                    case MODE_SELECT:
                        parsePosition(evt, positionElem, selectPanel);
                        break;
                    case MODE_DRAG:
                        positionDragLines(evt);
                        break;
                    case MODE_RESIZE:
                        positionResizeElem(evt, positionElem);
                        break;
                }
        }
    },
    mouseup(evt) {
        switch (mode) {
            case MODE_NONE:
                break;
            case MODE_SELECT:
                Timeout.remove(setDragMode);
                util.call(Config.onselect, this, evt);
                break;
            case MODE_DRAG:
                break;
            case MODE_RESIZE:
                break;
            default:
                switch (mode % MODE_READY) {
                    case MODE_SELECT:
                        hideElem(selectPanel);
                        mouse_select.call(this, evt);
                        break;
                    case MODE_DRAG:
                        mouse_drag_end.call(this, evt);
                        break;
                    case MODE_RESIZE:
                        hideElem(resizePanel);
                        positionResizeElem(evt, mouse_resize);
                        break;
                }
        }
        mode = MODE_NONE;
    },
    select: doSelect,
    /**
     * @param config 配置回掉事件
     *  {
     *      onreadydrag: Function(),
     *      ondragstart: Function(),
     *      ondragout: Function(widget, dragInfo.info),
     *      ondragover: Function(target, dragInfo.info),
     *      ondrop: Function(widget, info, evt),
     *      ondragend: Function(evt, dragInfo),
     *      onselect: Function(evt, elems),
     *      onresize: Function(rateWidth, rateHeight, rateLeft, rateTop)
     *      owner: Element
     *  }
     */
    config(config) {
        if (!Config.owner) {
            Object.assign(Config, config);
            Config.owner = Config.owner || document.body;
            doc = Config.owner.ownerDocument;
        }
    }
}

const Config = {};

let resizeLines, //选中组件后活动组件可改变大小时用于包围该组件的线框
    unresizeLines, //选中组件后活动组件不可改变大小时用于包围该组件的线框
    areaLines, //选中多个组件后用于包围所有组件的线框
    dragLines, //拖拽组件时用于模拟被拖拽组件区域的线框
    selectPanel, //框选过程中的半透膜遮罩元素，结束框选时会选中该遮罩覆盖的组件
    resizePanel; //调整大小过程中的模拟选中组件区域的元素，会直观的看到所有选中组件改变大小的效果

const MODE_NONE = 0, //初始模式
    MODE_SELECT = 1, //鼠标开始按下进入框选组件模式
    MODE_DRAG = 2, //鼠标长按后进入拖拽组件模式
    MODE_RESIZE = 4, //鼠标按在更改大小感应按钮上进入更改大小模式
    MODE_READY = 8, //鼠标开始对应模式响应
    MIN_POS = 5; //鼠标开始对应模式需要移动的最小距离

const DIR_NONE = 0,
    DIR_T_L = 1,
    DIR_T = 2,
    DIR_T_R = 3,
    DIR_R = 4,
    DIR_B_R = 5,
    DIR_B = 6,
    DIR_B_L = 7,
    DIR_L = 8;

const CLS_SELECT_PANEL = "selector-shadow-panel", //框选的遮罩的样式
    CLS_RESIZE_PANEL = "selector-resize-panel", //更改大小遮罩的样式
    CLS_SELECT_LINE = "selector-line", //活动框选线条的样式
    CLS_SELECT_RESIZE = CLS_SELECT_LINE + " selector-resize-line", //可更改大小的活动框选线条的样式
    CLS_AREA_LINE = "selector-area-line", //非活动框选线条的样式
    CLS_SELECT_RESIZE_BUTTON = "selector-resize-button", //可更改大小的感应按钮的样式
    CLS_DRAG_LINE = "selector-drag-line"; //拖拽模拟线条样式

let mode = MODE_NONE, //当前所处模式
    direction = DIR_NONE, //更改大小的方向
    parentRect, //父元素的坐标
    areaRect, //包围线框所处位置
    resizeRect, //活动组件所处位置
    startEvent, //鼠标按下时的事件对象状态值
    selectInfo,
    dragInfo,
    doc;

function doSelect(elems, resizable) {
    resetParentRect();
    let idLen = !elems ? -1 : elems.length - 1;
    if (idLen === -1) {
        if (areaRect) {
            hideLines(areaLines);
            areaRect = null;
        }
        if (resizeRect) {
            hideLines(selectInfo.resizable ? resizeLines : unresizeLines);
            resizeRect = null;
        }
        selectInfo = null;
    } else {
        let pos_left = [],
            pos_top = [],
            pos_right = [],
            pos_bottom = [];
        for (let i = idLen; i >= 0; i--) {
            let rect = DomHelper.getRect(elems[i]);
            pos_left.push(rect.left);
            pos_top.push(rect.top);
            pos_right.push(rect.right);
            pos_bottom.push(rect.bottom);
        }
        let left = pos_left[idLen],
            top = pos_top[idLen],
            right = pos_right[idLen],
            bottom = pos_bottom[idLen];
        if (resizeRect) {
            hideLines(resizable ? unresizeLines : resizeLines);
        }
        positionLines(initResizeLines(resizable), left, top, right, bottom);
        resizeRect = { left: left, top: top, right: right, bottom: bottom };
        if (idLen > 0) {
            left = Math.min.apply(Math, pos_left);
            top = Math.min.apply(Math, pos_top);
            right = Math.max.apply(Math, pos_right);
            bottom = Math.max.apply(Math, pos_bottom);
            positionLines(initAreaLines(), left, top, right, bottom);
            areaRect = { left: left, top: top, right: right, bottom: bottom };
        } else if (areaRect) {
            areaRect = null;
            hideLines(areaLines);
        }
        selectInfo = { elems: elems, resizable: resizable };
    }
}

function createLines(className) {
    let ownerElem = Config.owner,
        line = ownerElem.appendChild(doc.createElement("div"));
    line.setAttribute('selector-ignore', true);
    line.className = className;
    return [line, ownerElem.appendChild(line.cloneNode(true)), ownerElem.appendChild(line.cloneNode(true)), ownerElem.appendChild(line.cloneNode(true))];
}

function createElem(className) {
    let elem = Config.owner.appendChild(doc.createElement("div"));
    elem.setAttribute('selector-ignore', true);
    elem.className = className;
    return elem;
}

function mouse_drag_over(evt) {
    let target = evt.target,
        oDragOver = dragInfo.over,
        dragOver = util.call(Config.ondragover, this, target, oDragOver, dragInfo.start);
    if (oDragOver && dragOver !== oDragOver) {
        util.call(Config.ondragout, this, oDragOver, dragInfo.start);
    }
    dragInfo.over = dragOver;
}

function mouse_drag_end(evt) {
    let start = dragInfo.start,
        helper = start.helper;
    if (helper) {
        helper.parentNode.removeChild(helper);
    } else {
        hideLines(dragLines);
    }
    let dragOver = dragInfo.over;
    if (dragOver) {
        util.call(Config.ondrop, this, dragOver, start, evt);
        util.call(Config.ondragout, this, dragOver, start);
    } else {
        let elems = start.elems;
        if (elems) {
            let left = evt.pageX + dragInfo.x - dragInfo.l,
                top = evt.pageY + dragInfo.y - dragInfo.t;
            for (let i = 0, len = elems.length; i < len; i++) {
                let elem = elems[i],
                    rect = DomHelper.getRect(elem);
                elem.style.cssText += '; left: ' + (rect.left + left) + 'px; top: ' + (rect.top + top) + 'px;';
            }
            doSelect(elems, start.resizable);
        }
    }
    util.call(Config.ondragend, this, evt, dragInfo);
    dragInfo = null;
}

function positionElem(left, top, width, height, elem) {
    elem.style.cssText += '; left: ' + (left - parentRect.left + parentRect.scrollLeft) + 'px; top: ' + (top - parentRect.top + parentRect.scrollTop) + 'px; width: ' + width + 'px; height: ' + height + 'px;';
}

function hideElem(elem) {
    elem.style.cssText += '; left: -5px; top: -5px; width: 0px; height: 0px;';
}

function positionLines(lines, left, top, right, bottom) {
    let k = 0,
        width = right - left,
        height = bottom - top;
    left = left - parentRect.left + parentRect.scrollLeft;
    top = top - parentRect.top + parentRect.scrollTop;
    lines[k++].style.cssText += '; left: ' + left + 'px; top: ' + top + 'px; width: ' + width + 'px;';
    lines[k++].style.cssText += '; left: ' + (left + width - 1) + 'px; top: ' + top + 'px; height: ' + height + 'px;';
    lines[k++].style.cssText += '; left: ' + left + 'px; top: ' + (top + height - 1) + 'px; width: ' + width + 'px;';
    lines[k].style.cssText += '; left: ' + left + 'px; top: ' + top + 'px; height: ' + height + 'px;';
}

function positionDragLines(evt) {
    let k = 0,
        helper = dragInfo.start.helper,
        left = evt.pageX + dragInfo.x,
        top = evt.pageY + dragInfo.y;
    if (helper) {
        helper.style.cssText += '; left: ' + left + 'px; top: ' + top + 'px;';
    } else {
        dragLines[k++].style.cssText += '; left: ' + left + 'px; top: ' + top + 'px;';
        dragLines[k++].style.cssText += '; left: ' + (left + dragInfo.w - 1) + 'px; top: ' + top + 'px;';
        dragLines[k++].style.cssText += '; left: ' + left + 'px; top: ' + (top + dragInfo.h - 1) + 'px;';
        dragLines[k].style.cssText += '; left: ' + left + 'px; top: ' + top + 'px;';
    }
    mouse_drag_over(evt);
}

function positionResizeElem(evt, callback) {
    let left, top, right, bottom;
    switch (direction) {
        case DIR_B_R:
            left = resizeRect.left;
            top = resizeRect.top;
            right = Math.max(left, evt.pageX);
            bottom = Math.max(top, evt.pageY);
            break;
        case DIR_R:
            left = resizeRect.left;
            top = resizeRect.top;
            bottom = resizeRect.bottom;
            right = Math.max(left, evt.pageX);
            break;
        case DIR_B:
            left = resizeRect.left;
            top = resizeRect.top;
            right = resizeRect.right;
            bottom = Math.max(top, evt.pageY);
            break;
        case DIR_B_L:
            top = resizeRect.top;
            right = resizeRect.right;
            left = Math.min(right, evt.pageX);
            bottom = Math.max(top, evt.pageY);
            break;
        case DIR_T_R:
            left = resizeRect.left;
            bottom = resizeRect.bottom;
            top = Math.min(bottom, evt.pageY);
            right = Math.max(left, evt.pageX);
            break;
        case DIR_T:
            left = resizeRect.left;
            right = resizeRect.right;
            bottom = resizeRect.bottom;
            top = Math.min(bottom, evt.pageY);
            break;
        case DIR_L:
            top = resizeRect.top;
            right = resizeRect.right;
            bottom = resizeRect.bottom;
            left = Math.min(right, evt.pageX);
            break;
        case DIR_T_L:
            right = resizeRect.right;
            bottom = resizeRect.bottom;
            left = Math.min(right, evt.pageX);
            top = Math.min(bottom, evt.pageY);
            break;
    }
    util.call(callback, this, left, top, right - left, bottom - top, resizePanel);
}

function hideLines(lines) {
    if (lines) {
        hideElem(lines[0]);
        hideElem(lines[1]);
        hideElem(lines[2]);
        hideElem(lines[3]);
    }
}

function setDragMode(evt) {
    let selectRect = areaRect || resizeRect;
    if (selectRect) {
        let left = evt.pageX,
            top = evt.pageY;
        if (left < selectRect.left || left > selectRect.right || top < selectRect.top || top > selectRect.bottom) {
            doSelect();
            util.call(Config.onselect, this, evt);
        }
    } else {
        util.call(Config.onselect, this, evt);
    }
    mode = MODE_DRAG;
    util.call(Config.onreadydrag, this, evt);
}

function checkLines(lines) {
    let ownerElem = Config.owner;
    if (lines[0].parentNode !== ownerElem) {
        ownerElem.appendChild(lines[3]);
        ownerElem.appendChild(lines[1]);
        ownerElem.appendChild(lines[0]);
        ownerElem.appendChild(lines[2]);
    }
}

function initResizeLines(resizable) {
    if (resizable) {
        if (resizeLines) {
            checkLines(resizeLines);
        } else {
            let ownerElem = Config.owner,
                lineLeft = ownerElem.appendChild(doc.createElement("div"));
            lineLeft.className = CLS_SELECT_RESIZE;
            lineLeft.innerHTML = `<div class="${CLS_SELECT_RESIZE_BUTTON}" style="left: 0; top: 50%; cursor: e-resize;"></div>`;
            let lineRight = ownerElem.appendChild(lineLeft.cloneNode(true));
            let lineTop = ownerElem.appendChild(doc.createElement("div"));
            lineTop.className = CLS_SELECT_RESIZE;
            lineTop.innerHTML = `<div class="${CLS_SELECT_RESIZE_BUTTON}" style="left: 0; top: 0; cursor: nw-resize;"></div>
                <div class="${CLS_SELECT_RESIZE_BUTTON}" style="left: 50%; top: 0; cursor: n-resize;"></div>
                <div class="${CLS_SELECT_RESIZE_BUTTON}" style="left: 100%; top: 0; cursor: ne-resize;"></div>`;
            let lineBottom = ownerElem.appendChild(lineTop.cloneNode(true));
            lineBottom.firstChild.style.cursor = 'sw-resize';
            lineBottom.lastChild.style.cursor = 'se-resize';
            resizeLines = [lineTop, lineRight, lineBottom, lineLeft];
        }
        return resizeLines;
    } else {
        if (unresizeLines) {
            checkLines(unresizeLines);
        } else {
            unresizeLines = createLines(CLS_SELECT_LINE);
        }
        return unresizeLines;
    }
}

function initAreaLines() {
    if (areaLines) {
        checkLines(areaLines);
    } else {
        areaLines = createLines(CLS_AREA_LINE);
    }
    return areaLines;
}

function initDragLines() {
    if (dragLines) {
        checkLines(dragLines);
    } else {
        dragLines = createLines(CLS_DRAG_LINE);
    }
    return dragLines;
}

function initSelectElem() {
    if (selectPanel) {
        let ownerElem = Config.owner;
        if (selectPanel.parentNode !== ownerElem) ownerElem.appendChild(selectPanel);
    } else {
        selectPanel = createElem(CLS_SELECT_PANEL);
    }
    return selectPanel;
}

function initResizeElem() {
    if (resizePanel) {
        let ownerElem = Config.owner;
        if (resizePanel.parentNode !== ownerElem) ownerElem.appendChild(resizePanel);
    } else {
        resizePanel = createElem(CLS_RESIZE_PANEL);
    }
    return resizePanel;
}

function readyResizeElem(evt) {
    let button = startEvent.target,
        idx = resizeLines.indexOf(button.parentNode),
        left, top, right, bottom, rt;
    switch (idx) {
        case 0: //上
            if (!button.nextSibling) { //右上
                top = evt.pageY;
                right = evt.pageX;
                if (rt = (Math.abs(right - startEvent.pageX) > MIN_POS || Math.abs(top - startEvent.pageY) > MIN_POS)) {
                    direction = DIR_T_R;
                    left = resizeRect.left;
                    bottom = resizeRect.bottom;
                    positionElem(left, top, right - left, bottom - top, initResizeElem());
                }
            } else if (!button.previousSibling) { //左上
                left = evt.pageX;
                top = evt.pageY;
                if (rt = (Math.abs(left - startEvent.pageX) > MIN_POS || Math.abs(top - startEvent.pageY) > MIN_POS)) {
                    direction = DIR_T_L;
                    right = resizeRect.right;
                    bottom = resizeRect.bottom;
                    positionElem(left, top, right - left, bottom - top, initResizeElem());
                }
            } else {
                top = evt.pageY;
                if (rt = (Math.abs(top - startEvent.pageY) > MIN_POS)) {
                    direction = DIR_T;
                    left = resizeRect.left;
                    right = resizeRect.right;
                    bottom = resizeRect.bottom;
                    positionElem(left, top, right - left, bottom - top, initResizeElem());
                }
            }
            break;
        case 1: //右
            right = evt.pageX;
            if (rt = (Math.abs(right - startEvent.pageX) > MIN_POS)) {
                direction = DIR_R;
                left = resizeRect.left;
                top = resizeRect.top;
                bottom = resizeRect.bottom;
                positionElem(left, top, right - left, bottom - top, initResizeElem());
            }
            break;
        case 2: //下
            if (!button.nextSibling) { //右下
                right = evt.pageX;
                bottom = evt.pageY;
                if (rt = (Math.abs(right - startEvent.pageX) > MIN_POS || Math.abs(bottom - startEvent.pageY) > MIN_POS)) {
                    direction = DIR_B_R;
                    left = resizeRect.left;
                    top = resizeRect.top;
                    positionElem(left, top, right - left, bottom - top, initResizeElem());
                }
            } else if (!button.previousSibling) { //左下
                left = evt.pageX;
                bottom = evt.pageY;
                if (rt = (Math.abs(left - startEvent.pageX) > MIN_POS || Math.abs(bottom - startEvent.pageY) > MIN_POS)) {
                    direction = DIR_B_L;
                    top = resizeRect.top;
                    right = resizeRect.right;
                    positionElem(left, top, right - left, bottom - top, initResizeElem());
                }
            } else {
                bottom = evt.pageY;
                if (rt = (Math.abs(bottom - startEvent.pageY) > MIN_POS)) {
                    direction = DIR_B;
                    left = resizeRect.left;
                    top = resizeRect.top;
                    right = resizeRect.right;
                    positionElem(left, top, right - left, bottom - top, initResizeElem());
                }
            }
            break;
        case 3: //左
            left = evt.pageX;
            if (rt = (Math.abs(left - startEvent.pageX) > MIN_POS)) {
                direction = DIR_L;
                top = resizeRect.top;
                right = resizeRect.right;
                bottom = resizeRect.bottom;
                positionElem(left, top, right - left, bottom - top, initResizeElem());
            }
            break;
        default:
            rt = false;
            break;
    }
    return rt;
}

function readyDragLines(evt) {
    let x = evt.pageX,
        y = evt.pageY,
        pageX = startEvent.pageX,
        pageY = startEvent.pageY;
    if (Math.abs(pageX - x) > MIN_POS || Math.abs(pageY - y) > MIN_POS) {
        let selectRect = areaRect || resizeRect || {},
            left = selectRect.left,
            top = selectRect.top,
            right = selectRect.right,
            bottom = selectRect.bottom;
        pageX = left - pageX;
        pageY = top - pageY;
        let posX = pageX - parentRect.left + parentRect.scrollLeft,
            posY = pageY - parentRect.top + parentRect.scrollTop;
        let dragStart = util.call(Config.ondragstart, this, startEvent.target, evt) || selectInfo;
        if (!dragStart) return false;
        let helper = dragStart.helper;
        if (helper && helper.nodeType === 1) {
            let cursorAt = dragStart.cursorAt;
            if (cursorAt) {
                posX = cursorAt.x || posX || 0;
                posY = cursorAt.y || posY || 0;
            }
            Config.owner.appendChild(helper).style.cssText += '; cursor: move; position: absolute; left: ' + (posX + x) + 'px; top: ' + (posY + y) + 'px;';
        } else {
            dragStart.helper = null;
            x += pageX;
            y += pageY;
            positionLines(initDragLines(), x, y, x + right - left, y + bottom - top);
        }
        dragInfo = {
            x: posX,
            y: posY,
            l: left,
            t: top,
            w: right - left,
            h: bottom - top,
            start: dragStart
        };
        return true;
    }
    return false;
}

function readySelectElem(left, top, width, height, getReadyElem) {
    if (width > MIN_POS || height > MIN_POS) {
        positionElem(left, top, width, height, getReadyElem());
        return true;
    }
    return false;
}

function parsePosition(evt, ready, args) {
    let x = evt.pageX,
        y = evt.pageY,
        left = startEvent.pageX,
        top = startEvent.pageY,
        width, height;
    if (x < left) {
        width = left - x - 1;
        left = x + 1;
    } else {
        width = x - left - 1;
    }
    if (y < top) {
        height = top - y - 1;
        top = y + 1;
    } else {
        height = y - top - 1;
    }
    return ready(left, top, width, height, args);
}

function getAllParentElem(elem) {
    let elems = [],
        ownerElem = Config.owner;
    while (elem !== ownerElem) {
        if (elem.nodeType === 1) {
            elems.unshift(elem);
        }
        elem = elem.parentNode;
    }
    elems.unshift(ownerElem);
    return elems;
}

function get_select_elems(elem, evt, startEvent) {
    let x = evt.pageX,
        y = evt.pageY,
        ox = startEvent.pageX,
        oy = startEvent.pageY,
        elems = [],
        node = elem.firstChild;
    if (x < ox) {
        ox = x;
        x = startEvent.pageX;
    }
    if (y < oy) {
        oy = y;
        y = startEvent.pageY;
    }
    while (node) {
        if (node.nodeType === 1 && !node.hasAttribute('selector-ignore')) {
            let rect = DomHelper.getRect(node);
            if (!(rect.top > y || rect.right < ox || rect.bottom < oy || rect.left > x)) {
                elems.push(node);
            }
        }
        node = node.nextSibling;
    }
    if (elems.length === 0) {
        elems.push(elem);
    }
    return elems;
}

function mouse_select(evt) {
    let starget = startEvent.target,
        etarget = evt.target;
    if (starget === etarget) {
        util.call(Config.onselect, this, evt, get_select_elems(starget, evt, startEvent));
    } else {
        let selems = getAllParentElem.call(this, starget),
            eelems = getAllParentElem.call(this, etarget),
            idx = 0,
            selem, eelem;
        for (let len = Math.min(selems.length, eelems.length); idx < len; idx++) {
            if ((selem = selems[idx]) !== (eelem = eelems[idx])) break;
        }
        if (idx > 0) {
            util.call(Config.onselect, this, evt, get_select_elems(selems[idx - 1], evt, startEvent));
        }
    }
}

function mouse_resize(left, top, width, height) {
    let oleft = resizeRect.left,
        otop = resizeRect.top,
        owidth = resizeRect.right - oleft,
        oheight = resizeRect.bottom - otop,
        rateW = width / owidth,
        rateH = height / oheight,
        rateL = (left - oleft) / owidth,
        rateT = (top - otop) / oheight;
    if (util.call(Config.onresize, this, rateW, rateH, rateL, rateT) !== false) {
        let elems = selectInfo.elems,
            len = elems.length;
        elems[0].style.cssText += '; left: ' + left + 'px; top: ' + top + 'px; width: ' + width + 'px; height: ' + height + 'px;';
        for (let i = 1; i < len; i++) {
            let elem = elems[i],
                rect = DomHelper.getRect(elem),
                width = rect.width,
                height = rect.height;
            elem.style.cssText += '; left: ' + (rect.left + rateL * width) + 'px; top: ' + (rect.top + rateT * height) + 'px; width: ' + (width * rateW) + 'px; height: ' + (height * rateH) + 'px;';
        }
        doSelect(elems, selectInfo.resizable);
    };
}

//## 注册设计器的鼠标事件，实现拖拽和框选等功能
function resetParentRect() {
    let ownerElem = Config.owner;
    parentRect = DomHelper.getRect(ownerElem);
    parentRect.scrollLeft = ownerElem.scrollLeft;
    parentRect.scrollTop = ownerElem.scrollTop;
}