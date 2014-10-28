/*global beforeEach */
var ranger = require('../index.js');

describe('ranger', function () {
  var container, slider;

  beforeEach(function () {
    container = {style: {}};
    slider = {style: {}};
  });

  describe('model', function () {
    it('does not navigate when it does not have focus', function () {
      var range = ranger.createModel(container, slider);
      sinon.stub(range.tracker, 'move');

      range.navigate({keyCode: 37});

      refute.called(range.tracker.move);
    });

    it('emits focus event', function () {
      var range = ranger.createModel(container, slider);
      var listener = sinon.spy();
      range.on('focus', listener);
      range.attemptFocus({target: container});

      assert.calledOnce(listener);
    });

    it('does not emit focus event when already in focus', function () {
      var range = ranger.createModel(container, slider);
      var listener = sinon.spy();
      range.on('focus', listener);
      range.attemptFocus({target: container});
      range.attemptFocus({target: container});

      assert.calledOnce(listener);
    });

    it('navigates when it has focus', function () {
      var range = ranger.createModel(container, slider);
      range.attemptFocus({target: container});
      sinon.stub(range.tracker, 'move');

      range.navigate({keyCode: 37});

      assert.calledOnce(range.tracker.move);
    });

    it('navigates left and right', function () {
      var range = ranger.createModel(container, slider);
      range.attemptFocus({target: container});

      range.navigate({keyCode: 39});
      assert.equals(slider.style.left, '1px');

      range.navigate({keyCode: 37});
      assert.equals(slider.style.left, '0px');
    });

    it('navigates in chunked step', function () {
      var range = ranger.createModel(container, slider, {step: 5});
      range.attemptFocus({target: container});

      range.navigate({keyCode: 39});

      assert.equals(slider.style.left, '5px');
    });

    it('navigates in scaled step', function () {
      var range = ranger.createModel(container, slider, {
        min: 0,
        max: 10,
        step: 1
      });

      range.calculatePointSize(200);
      range.attemptFocus({target: container});
      range.navigate({keyCode: 39});

      assert.equals(slider.style.left, '20px');
    });

    it('navigates in chunked and scaled step', function () {
      var range = ranger.createModel(container, slider, {
        min: 0,
        max: 10,
        step: 2
      });

      range.calculatePointSize(200);
      range.attemptFocus({target: container});
      range.navigate({keyCode: 39});

      assert.equals(slider.style.left, '40px');
    });

    it('initializes with default value', function () {
      var range = ranger.createModel(container, slider, {
        min: 0,
        max: 10,
        value: 5
      });

      range.calculatePointSize(200);

      assert.equals(slider.style.left, '100px');
    });

    it('moves left from initial value', function () {
      var range = ranger.createModel(container, slider, {
        min: 0,
        max: 10,
        value: 5
      });

      range.attemptFocus({target: container});
      range.calculatePointSize(200);
      range.navigate({keyCode: 37});

      assert.equals(slider.style.left, '80px');
    });

    it('moves in slider where each value is < 1px wide', function () {
      var range = ranger.createModel(container, slider, {min: 0, max: 100});

      range.calculatePointSize(50);
      range.attemptFocus({target: container});

      range.navigate({keyCode: 39});
      assert.equals(slider.style.left, '0.5px');

      range.navigate({keyCode: 39});
      assert.equals(slider.style.left, '1px');
    });

    it('emits click event', function () {
      var range = ranger.createModel(container, slider);
      var listener = sinon.spy();
      range.on('click', listener);

      range.tracker.start({pageX: 0, pageY: 0});

      assert.calledOnce(listener);
    });

    it('emits change event on end drag', function () {
      var range = ranger.createModel(container, slider);
      var listener = sinon.spy();
      range.on('change', listener);

      range.tracker.start({pageX: 0, pageY: 0});
      range.tracker.track({pageX: 1, pageY: 0});
      range.tracker.track({pageX: 2, pageY: 0});
      range.tracker.stop({pageX: 2, pageY: 0});

      assert.calledOnce(listener);
      assert.match(listener.getCall(0).args[0], {value: 2});
    });

    it('emits input event on every movement', function () {
      var range = ranger.createModel(container, slider);
      var listener = sinon.spy();
      range.on('input', listener);

      range.tracker.start({pageX: 0, pageY: 0});
      range.tracker.track({pageX: 1, pageY: 0});
      range.tracker.track({pageX: 2, pageY: 0});
      range.tracker.stop({pageX: 2, pageY: 0});

      assert.calledTwice(listener);
      assert.match(listener.getCall(0).args[0], {value: 1});
    });
  });
});
