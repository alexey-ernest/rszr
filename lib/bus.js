/**
 * Service bus integration.
 */

// env
if (!process.env.NSQD_ADDRESS) {
  console.log("NSQD_ADDRESS environment variable required.");
  process.exit(1);
}
if (!process.env.NSQLOOKUPD_ADDRESSES) {
  console.log("NSQLOOKUPD_ADDRESSES environment variable required.");
  process.exit(1);
}

var events = require('events');
var nsq = require('nsqjs');
var debug = require('debug')('rszr:bus');
var constants = require('./constants');

var Events = constants.Events;

/**
 * Default options.
 *
 * @type       {Object}
 */
var defaults = {
  nsqdAddress: process.env.NSQD_ADDRESS,
  nsqdPort: +process.env.NSQD_PORT || 4150,
  nsqlookupdAddresses: process.env.NSQLOOKUPD_ADDRESSES // comma separated list of domain:port nsqlookupd instances
};


/**
 * Bus communication wrapper (singleton).
 */
var bus = (function() {

  options = Object.assign({}, defaults);

  /**
   * Private bus writer.
   *
   * @type       {nsq.Writer}
   */
  var busWriter = new nsq.Writer(options.nsqdAddress, +options.nsqdPort);
  busWriter.connect();

  /**
   * Registers bus readers.
   */
  function registerReaders() {

    var lookupdHTTPAddresses = options.nsqlookupdAddresses.split(',');

    // Image uploaded
    var busReaderImageUploaded = new nsq.Reader(Events.IMAGE_UPLOADED, 
      'create-resize-tasks', 
      {
        lookupdHTTPAddresses: lookupdHTTPAddresses
      }
    );
    busReaderImageUploaded
      .on('message', function (msg) {
        debug('Incoming message ' + Events.IMAGE_UPLOADED + ': ' + msg.id);

        bus.emit(Events.IMAGE_UPLOADED, msg);
      })
      .connect();

    // Image resize
    var busReaderImageResize = new nsq.Reader(Events.IMAGE_RESIZE, 
      'resize-image', 
      {
        lookupdHTTPAddresses: lookupdHTTPAddresses
      }
    );
    busReaderImageResize
      .on('message', function (msg) {
        debug('Incoming message ' + Events.IMAGE_RESIZE + ': ' + msg.id);

        bus.emit(Events.IMAGE_RESIZE, msg);
      })
      .connect();
  }

  /**
   * Event emit helper.
   *
   * @param      {string}    type    Event type.
   * @param      {Object}    data    Event data.
   * @param      {Function}  fn      Callback.
   */
  function emitEvent(type, data, fn) {
    
    debug(type + ' event: ' + JSON.stringify(data));

    // emit event to the bus
    busWriter.publish(type, data, fn);
  }

  /**
   * Publishes an event that image has been uploaded to S3.
   *
   * @method     emitImageUploaded
   * @param      {Object}    data    Event data.
   * @param      {Function}  fn      Callback.
   */
  function emitImageUploaded (data, fn) {
    return emitEvent(Events.IMAGE_UPLOADED, data, fn);
  }

  /**
   * Publishes an event for image resizing.
   *
   * @method     emitImageResize
   * @param      {Object}    data    Event data.
   * @param      {Function}  fn      Callback.
   */
  function emitImageResize (data, fn) {
    return emitEvent(Events.IMAGE_RESIZE, data, fn);
  }

  // register readers
  registerReaders();

  /**
   * Inherits from EventEmitter.
   */
  var that = Object.create(events.EventEmitter.prototype, {
    constructor: {
      value: bus,
      configurable: true,
      enumerable: true,
      writable: true
    }
  });

  /**
   * Public interface.
   */
  Object.assign(that, {
    emitImageUploaded: emitImageUploaded,
    emitImageResize: emitImageResize
  });

  return that;
})();

module.exports = bus;
