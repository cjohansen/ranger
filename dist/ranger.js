!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.ranger=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*global mmouse*/
var bane = require('bane');

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

    navigateTo: function (e) {
      model.tracker.moveTo({x: e.targetX, y: e.targetY});
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
  var navigate = on(container, 'click', mouseInElement(container, model.navigateTo));
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

},{"bane":2}],2:[function(require,module,exports){
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

},{}]},{},[1])(1)
});