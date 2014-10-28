!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.ranger=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var bane = require('bane');
var mmouse = require('mmouse');

function defaultAction(fn) {
  return function (e) {
    e.preventDefault();
    fn(e);
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

},{"bane":2,"mmouse":3}],2:[function(require,module,exports){
((typeof define === "function" && define.amd && function (m) { define("bane", m); }) ||
 (typeof module === "object" && function (m) { module.exports = m(); }) ||
 function (m) { this.bane = m(); }
)(function () {
    "use strict";
    var slice = Array.prototype.slice;

    function handleError(event, error, errbacks) {
        var i, l = errbacks.length;
        if (l > 0) {
            for (i = 0; i < l; ++i) { errbacks[i](event, error); }
            return;
        }
        setTimeout(function () {
            error.message = event + " listener threw error: " + error.message;
            throw error;
        }, 0);
    }

    function assertFunction(fn) {
        if (typeof fn !== "function") {
            throw new TypeError("Listener is not function");
        }
        return fn;
    }

    function supervisors(object) {
        if (!object.supervisors) { object.supervisors = []; }
        return object.supervisors;
    }

    function listeners(object, event) {
        if (!object.listeners) { object.listeners = {}; }
        if (event && !object.listeners[event]) { object.listeners[event] = []; }
        return event ? object.listeners[event] : object.listeners;
    }

    function errbacks(object) {
        if (!object.errbacks) { object.errbacks = []; }
        return object.errbacks;
    }

    /**
     * @signature var emitter = bane.createEmitter([object]);
     *
     * Create a new event emitter. If an object is passed, it will be modified
     * by adding the event emitter methods (see below).
     */
    function createEventEmitter(object) {
        object = object || {};

        function notifyListener(event, listener, args) {
            try {
                listener.listener.apply(listener.thisp || object, args);
            } catch (e) {
                handleError(event, e, errbacks(object));
            }
        }

        object.on = function (event, listener, thisp) {
            if (typeof event === "function") {
                return supervisors(this).push({
                    listener: event,
                    thisp: listener
                });
            }
            listeners(this, event).push({
                listener: assertFunction(listener),
                thisp: thisp
            });
        };

        object.off = function (event, listener) {
            var fns, events, i, l;
            if (!event) {
                fns = supervisors(this);
                fns.splice(0, fns.length);

                events = listeners(this);
                for (i in events) {
                    if (events.hasOwnProperty(i)) {
                        fns = listeners(this, i);
                        fns.splice(0, fns.length);
                    }
                }

                fns = errbacks(this);
                fns.splice(0, fns.length);

                return;
            }
            if (typeof event === "function") {
                fns = supervisors(this);
                listener = event;
            } else {
                fns = listeners(this, event);
            }
            if (!listener) {
                fns.splice(0, fns.length);
                return;
            }
            for (i = 0, l = fns.length; i < l; ++i) {
                if (fns[i].listener === listener) {
                    fns.splice(i, 1);
                    return;
                }
            }
        };

        object.once = function (event, listener, thisp) {
            var wrapper = function () {
                object.off(event, wrapper);
                listener.apply(this, arguments);
            };

            object.on(event, wrapper, thisp);
        };

        object.bind = function (object, events) {
            var prop, i, l;
            if (!events) {
                for (prop in object) {
                    if (typeof object[prop] === "function") {
                        this.on(prop, object[prop], object);
                    }
                }
            } else {
                for (i = 0, l = events.length; i < l; ++i) {
                    if (typeof object[events[i]] === "function") {
                        this.on(events[i], object[events[i]], object);
                    } else {
                        throw new Error("No such method " + events[i]);
                    }
                }
            }
            return object;
        };

        object.emit = function (event) {
            var toNotify = supervisors(this);
            var args = slice.call(arguments), i, l;

            for (i = 0, l = toNotify.length; i < l; ++i) {
                notifyListener(event, toNotify[i], args);
            }

            toNotify = listeners(this, event).slice();
            args = slice.call(arguments, 1);
            for (i = 0, l = toNotify.length; i < l; ++i) {
                notifyListener(event, toNotify[i], args);
            }
        };

        object.errback = function (listener) {
            if (!this.errbacks) { this.errbacks = []; }
            this.errbacks.push(assertFunction(listener));
        };

        return object;
    }

    return {
        createEventEmitter: createEventEmitter,
        aggregate: function (emitters) {
            var aggregate = createEventEmitter();
            emitters.forEach(function (emitter) {
                emitter.on(function (event, data) {
                    aggregate.emit(event, data);
                });
            });
            return aggregate;
        }
    };
});

},{}],3:[function(require,module,exports){
/*global _*/
function clamp(val, min, max) {
  min = typeof min === 'number' ? min : -Infinity;
  max = typeof max === 'number' ? max : Infinity;
  return Math.max(min, Math.min(max, val));
}

function noop() {}

function trackMovement(options) {
  var opts = options || {};
  var startX, startY, diffX, diffY, prevX, prevY, posX = 0, posY = 0;
  var enabled = opts.hasOwnProperty('enabled') ? opts.enabled : true;
  var onMove = opts.onMove || noop;
  var onStart = opts.onStart || noop;
  var onStop = opts.onStop || noop;
  var getMinX = opts.getMinX || noop;
  var getMaxX = opts.getMaxX || noop;
  var getMaxY = opts.getMaxY || noop;
  var getMinY = opts.getMinY || noop;

  function start(e) {
    if (!enabled) { return; }
    startX = e.pageX;
    startY = e.pageY;
    prevX = startX;
    prevY = startY;
    onStart({x: startX, y: startY});
  }

  function stop(e) {
    if (!enabled || startX === undefined) { return; }
    var endX = e.pageX - startX;
    var endY = e.pageY - startY;
    startX = undefined;
    startY = undefined;
    posX = clamp(posX, getMinX(), getMaxX());
    posY = clamp(posY, getMinY(), getMaxY());
    onStop({x: endX, y: endY});
  }

  function track(e) {
    if (!enabled || startX === undefined) { return; }
    posX = posX + (e.pageX - prevX);
    posY = posY + (e.pageY - prevY);
    prevX = e.pageX;
    prevY = e.pageY;

    onMove({
      startX: startX,
      startY: startY,
      endX: e.pageX,
      endY: e.pageY,
      dx: e.pageX - startX,
      dy: e.pageY - startY,
      posX: clamp(posX, getMinX(), getMaxX()),
      posY: clamp(posY, getMinY(), getMaxY())
    });
  }

  return {
    move: function (e) {
      startX = prevX || 0;
      startY = prevY || 0;
      start({pageX: startX, pageY: startY});
      var target = {pageX: startX + (e.x || 0), pageY: startY + (e.y || 0)};
      track(target);
      stop(target);
    },

    disable: function () {
      enabled = false;
      startX = undefined;
      startY = undefined;
    },

    enable: function () {
      enabled = true;
    },

    start: start,
    stop: stop,
    track: track
  };
}

function trackMovementIn(el, options) {
  return trackMovement(_.merge(options || {}, {
    getMinX: function () { return 0; },
    getMaxX: function () { return el.offsetWidth; },
    getMinY: function () { return 0; },
    getMaxY: function () { return el.offsetHeight; }
  }));
}

exports.trackMovement = trackMovement;
exports.trackMovementIn = trackMovementIn;

},{}]},{},[1])(1)
});