# Selector

Provides element selection, drag and drop, drag and drop functions.

## HOW TO USE

### Install
```
npm install ffd-selector
```

### Html
```html
<span outer-draggable>ABC</span>
<div draggable></div>
<div droppable></div>
```

### Config
```javascript
Selector.config({
    onselect(evt, elems) {
        if (elems) {
            if ($(elems[0]).attr('draggable')) {
                Selector.select(elems, true);
            } else {
                Selector.select($(elems[0]).closest('[draggable]'), true);
            }
        } else {
            Selector.select($(evt.target).closest('[draggable]'), true);
        }
    },
    ondragover(target, over) {
        let dropElem = $(target).closest('[droppable]');
        if (dropElem.length) {
            if (over && dropElem[0] === over) return over;
            dropElem.addClass('droppable');
            return dropElem[0];
        }
    },
    ondragstart(target, evt) {
        let drag = $(target);
        if (drag.attr('outer-draggable')) {
            return {
                helper: target.cloneNode(true),
                cursorAt: {
                    x: 10,
                    y: 10
                }
            }
        }
    },
    ondragout(over) {
        $(over).removeClass('droppable');
    },
    ondrop(over, start) {
        $(over).append($(start.helper).text());
    }
});
```

### Regist
```javascript
$('body').on('mousedown', function(evt) {
    Selector.mousedown(evt);
}).on('mousemove', function(evt) {
    Selector.mousemove(evt);
}).on('mouseup mouseleave', function(evt) {
    Selector.mouseup(evt);
})

$('[outer-draggable]').on('mousedown', function(evt) {
    Selector.dragstart(evt);
    return false;
}) 
```

## LICENSE

MIT