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

function on(el, ev, handler) {
  el.addEventListener(ev, handler);
  return [el, ev, handler];
}

function off(spec) {
  spec[0].removeEventListener(spec[1], spec[2]);
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
