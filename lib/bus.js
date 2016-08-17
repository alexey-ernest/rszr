/**
 * @fileOverview Service bus integration.
 */

// env
if (!process.env.NSQD_ADDRESS) {
  console.log("NSQD_ADDRESS environment variable required.");
  process.exit(1);
}

var events = require('events');
var nsq = require('nsqjs');
var debug = require('debug')('rszr:bus');


/**
 * Default options.
 *
 * @type       {Object}
 */
var defaults = {
  nsqdAddress: process.env.NSQD_ADDRESS,
  nsqdPort: +process.env.NSQD_PORT || 4150
};

/**
 * Image uploaded event name constant.
 *
 * @type       {string}
 */
var IMAGE_UPLOADED = 'image-uploaded';


/**
 * Bus communication wrapper.
 *
 * @class
 * @param      {Object}  options  Configuration options.
 */
function Bus(options) {

  options = Object.assign({}, defaults, options);
  
  /**
   * Private bus writer.
   *
   * @type       {nsq.Writer}
   */
  var bus = new nsq.Writer(options.nsqdAddress, +options.nsqdPort);
  bus.connect();
  
  /**
   * Inherits from EventEmitter.
   */
  Bus.prototype = Object.create(events.EventEmitter.prototype, {
    constructor: {
      value: Bus,
      configurable: true,
      enumerable: true,
      writable: true
    }
  });

  /**
   * Internal implementation of the bus wrapper.
   *
   * @class      BusInternal (name)
   */
  var BusInternal = function () {};

  /**
   * Inherits from Bus.
   */
  BusInternal.prototype = Object.create(Bus.prototype, {
    constructor: {
      value: Bus,
      configurable: true,
      enumerable: true,
      writable: true
    }
  });

  /**
   * Extends prototype functionality.
   */
  Object.assign(BusInternal.prototype, {
    
    /**
     * Publishes an event that image has been uploaded to S3.
     *
     * @method     imageUploaded
     * @param      {Object}    data    Event data.
     * @param      {Function}  fn      Callback.
     */
    imageUploaded: function (data, fn) {

      debug('Image uploaded event: ' + JSON.stringify(data));

      // emit event to the bus
      bus.publish(IMAGE_UPLOADED, data, fn);

      // emit event as an EventEmitter
      this.emit(IMAGE_UPLOADED, data);
    }

  });

  return new BusInternal();
}

module.exports = Bus;
