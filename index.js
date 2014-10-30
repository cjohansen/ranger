var bane = require('bane');
var mmouse = require('mmouse');

function defaultAction(fn) {
  return function (e) {
    // Tracker functions return data when they are active. If nothing was
    // returned, it means we should ignore this event and allow it to propagate
    if (fn(e)) {
      e.preventDefault();
    }
  };
}

/**
 * Register event listener and return a 'spec' that can be passed to off() to
 * deregister.
 */
function on(el, ev, handler) {
  el.addEventListener(ev, handler);
  return [el, ev, handler];
}

function off(spec) {
  spec[0].removeEventListener(spec[1], spec[2]);
}

/**
 * Get the position of an element in the viewport.
 */
function getPosition(element) {
  var x = 0;
  var y = 0;
  while (element) {
    x += element.offsetLeft - element.scrollLeft + element.clientLeft;
    y += element.offsetTop - element.scrollTop + element.clientTop;
    element = element.offsetParent;
  }
  return {x: x, y: y};
}

/**
 * Get dimensions of element
 */
function getDimensions(element) {
  return {x: element.offsetWidth, y: element.offsetHeight};
}

/**
 * Wrap an event handler in a function that only executes the handler for mouse
 * events that occur within the boundaries of the target element. The event
 * object will have targetX/targetY properties that are relative to the element
 * (e.g. clicking the left upper corner will yield targetX 0, targetY 0)
 */
function mouseInElement(el, handler) {
  var element = el[0] && el[0].tagName ? el[0] : el;
  return function (e) {
    var pos = getPosition(element);
    var dim = getDimensions(element);
    var x = e.clientX - pos.x;
    var y = e.clientY - pos.y;

    if (x > 0 && y > 0 && x < dim.x && y < dim.y) {
      e.targetX = x;
      e.targetY = y;
      handler.call(this, e);
    }
  };
}

function onMount(el, callback) {
  if (el.offsetWidth) {
    callback();
  } else {
    setTimeout(function () {
      onMount(el, callback);
    }, 10);
  }
}

function maybe(obj, method) {
  var args = [].slice.call(arguments, 2);
  if (obj[method]) {
    obj[method].apply(obj, arguments);
  }
}

function createModel(container, slider, opt) {
  var options = opt || {};
  var stepSize = options.step || 1;
  var min = options.min || 0;
  var max = options.max || 0;
  var value = options.value || 0;
  var snap = options.snap;
  var hasFocus = false;
  var pos = 0;
  var prevEmit = {};
  var pointSize = 1;

  function emitValue(eventName, event, val) {
    if (prevEmit[eventName] !== val) {
      event.value = val;
      model.emit(eventName, event);
      prevEmit[eventName] = val;
    }
  }

  var model = bane.createEventEmitter({
    calculatePointSize: function (width) {
      max = max || width;
      pointSize = width / (max - min);

      if (value) {
        model.tracker.move({x: pointSize * value, y: 0});
      }
    },

    navigate: function (e) {
      if (!hasFocus) { return; }
      var unit = stepSize * pointSize;
      var offset = pos % unit;

      if (e.keyCode === 37) {
        model.tracker.move({x: offset === 0 ? -unit : -offset, y: 0});
        maybe(e, 'preventDefault');
      }
      if (e.keyCode === 39) {
        model.tracker.move({x: unit - offset, y: 0});
        maybe(e, 'preventDefault');
      }
    },

    attemptFocus: function (e) {
      var el = e.target;
      var hadFocus = hasFocus;
      hasFocus = false;
      while (el) {
        if (el === container) {
          hasFocus = true;
          if (!hadFocus) {
            model.emit('focus', {value: value});
          }
          el = null;
        } else {
          el = el.parentNode;
        }
      }
    },

    tracker: mmouse.trackMovementIn(container, {
      onStart: function (e) {
        hasFocus = true;
        emitValue('click', e, value);
      },

      onStop: function (e) {
        emitValue('change', e, value);
      },

      onMove: function (e) {
        pos = snap ? e.posX - (e.posX % (stepSize * pointSize)) : e.posX;
        value = Math.floor(pos / pointSize);

        slider.style.left = pos + 'px';
        e.posX = pos;
        model.emit('move', e);
        emitValue('input', e, value);
      }
    })
  });

  return model;
}

function createInput(container, opt) {
  container = container[0] && container[0].tagName ? container[0] : container;
  var slider = container.getElementsByClassName('slider')[0];
  if (!slider) {
    throw new Error('Cannot make element a range input, no .slider');
  }

  var model = createModel(container, slider, opt || {});

  onMount(container, function () {
    model.calculatePointSize(container.offsetWidth);
  });

  slider.style.position = 'absolute';
  var keydown = on(document.body, 'keydown', model.navigate);
  var click = on(document.body, 'click', model.attemptFocus);
  var move = on(document.body, 'mousemove', defaultAction(model.tracker.track));
  var mouseup = on(document.body, 'mouseup', defaultAction(model.tracker.stop));
  var mousedown = on(slider, 'mousedown', defaultAction(model.tracker.start));

  model.destroy = function () {
    off(keydown);
    off(click);
    off(move);
    off(mouseup);
    off(mousedown);
  };

  return model;
}

exports.createModel = createModel;
exports.createInput = createInput;
exports.mouseInElement = mouseInElement;
