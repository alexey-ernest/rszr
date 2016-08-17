var Bus = require('./bus.js');
var bus = new Bus();
var Events = require('./constants').Events;
var presets = require('./presets');
var path = require('path');
var async = require('async');
var debug = require('debug')('rszr:worker');

function handleError(err) {
  if (err) return console.error(err);
}

function emitEvent(event) {
  return function (fn) {
    bus.emitImageResize(event, fn);
  };
}

module.exports = {

  /**
   * Starts worker.
   *
   * @param      {Function}  fn      Callback.
   */
  start: function (fn) {

    bus.on(Events.IMAGE_UPLOADED, function (msg) {
      var data = JSON.parse(msg.body);

      debug(Events.IMAGE_UPLOADED + ' event: ' + msg.body);

      var filename = path.basename(data.uri, path.extname(data.uri));

      // generate resize events
      var sizes = presets.sizes,
          i,
          len = sizes.length,
          size,
          resizedFileName,
          resizedUri,
          tasks = [];
      for (i = 0; i < len; i+=1) {
        size = sizes[i];
        resizedFileName = filename + '_' + size[0] + 'x' + size[1];
        resizedUri = data.uri.replace(filename, resizedFileName);

        event = Object.assign({}, data, {
          targetUri: resizedUri,
          width: size[0],
          height: size[1]
        });

        debug('Resize event created: ' + JSON.stringify(event));

        tasks[i] = emitEvent(event);
      }

      // sending events
      async.parallel(tasks, function (err) {
        if (err) return handleError(err);

        debug(tasks.length + ' resize events generated for ' + data.uri + ' image');

        msg.finish();
      });
    });

    fn();
  }

};