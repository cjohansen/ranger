# Ranger

Custom range input control. Assumes you create the containing element as well as
the slider element. The slider element will be absolutely positioned along the
x-axis of the containing element, minimum position 0, max position
`containingElement.offsetWidth`.

Assume the following markup:

```html
<div class="range-input">
  <div class="slider"><div class="slider-icon"></div></div>
</div>
```

...and the following CSS:

```css
.range-input {
    width: 400px;
    overflow: hidden;
    height: 20px;
}

.slider-icon {
    width: 20px;
    height: 20px;
    position: relative;
    left: -10px;
    background: url(slider-icon.png);
}
```

...the following JavaScript will turn it into a slidable controller.

```js
var el = document.getElementsByClassName('range-input')[0];
var slider = document.getElementsByClassName('slider')[0];
var range = ranger.createInput(el, slider, {
  min: 0,
  max: 100,
  step: 5,
  value: 50
});
```

The controller will be draggable to anywhere, but navigation using arrow keys
will snap to values from 0 to 100. Since the element is 400px wide and the
default value is 50, the slider element will start out at 200px left position.

If you want the slider to "snap" to value markers as you drag with the mouse as
well, set the `snap` property:

```js
var el = document.getElementsByClassName('range-input')[0];
var slider = document.getElementsByClassName('slider')[0];
var range = ranger.createInput(el, slider, {
  min: 0,
  max: 100,
  step: 5,
  value: 50,
  snap: true
});
```
