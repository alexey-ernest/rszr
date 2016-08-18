/**
 * Socket interface for resizing images.
 */

// env
if (!process.env.S3_BUCKET) {
  console.log("S3_BUCKET environment variable required.");
  process.exit(1);
}
if (!process.env.S3_REGION) {
  console.log("S3_REGION environment variable required.");
  process.exit(1);
}

var bus = require('./bus');
var Events = require('./constants').Events;
var debug = require('debug')('rszr:socket');
var request = require('request');
var path = require('path');

var bucket = process.env.S3_BUCKET;
var s3Region = process.env.S3_REGION;
var AWS = require('aws-sdk');
var s3 = new AWS.S3({region: s3Region});

/**
 * Maximum time in ms socket can hold the message for processing.
 *
 * @type       {number}   Ms.
 */
var SOCKET_TIMEOUT = 5000;


module.exports = function (server) {
  
  var io = require('socket.io')(server),
      sockets = {},
      freeSockets = {},
      socketsData = {},
      socketTimeouts = {};

  /**
   * Helper function for cleaning socket data.
   *
   * @param      {String}  id      Socket id.
   */
  function cleanSocketData(id) {
    delete sockets[id];
    delete freeSockets[id];
    delete socketsData[id];
    delete socketTimeouts[id];
  }

  /**
   * Helper function for handling socket complete events.
   *
   * @param      {Object}    socket  Socket object.
   * @param      {String}    base64  Base64 encoded processed image data.
   * @param      {Function}  fn      Callback.
   */
  function onSocketComplete(socket, base64, fn) {
    
    // stopping timeout
    if (socketTimeouts[socket.id]) {
      clearTimeout(socketTimeouts[socket.id]);
      delete socketTimeouts[socket.id];
    }

    // retrieve information about the process operation
    var socketData = socketsData[socket.id];
    if (!socketData) {
      return fn('There is no data for the socket ' + socket.id + ', abandon the result.');
    }

    delete socketsData[socket.id];


    var msg = socketData.msg,
        msgData = socketData.data;    

    debug('Image resizing completed for image ' + msgData.targetUri);

    // read data
    var buf = new Buffer(base64, 'base64');

    // upload to s3
    debug('Uploading resized image file of size ' + buf.length + ' bytes to ' + msgData.targetUri);

    var key = path.basename(msgData.targetUri);
    var params = {
      Bucket: bucket,
      Key: key,
      ACL: 'public-read',
      Body: buf,
      ContentLength: buf.length,
      ContentEncoding: 'base64',
      ContentType: socketData.contentType
    };
    s3.putObject(params, function (err) {
      if (err) {
        // requeue the message
        msg.requeue(1000);

        err = new Error('An error occured while uploading resized image to ' + msgData.targetUri + ': ' + err);
        return fn(err);
      }

      debug('Resized image has been successfully uploaded to ' + msgData.targetUri);

      // finilizing msg
      msg.finish();
      
      fn();
    });
  }

  /**
   * Handles new socket connections.
   *
   * @param      {Object}  socket  New socket connection.
   */
  function onSocketConnected(socket) {

    // registering socket
    sockets[socket.id] = socket;
    freeSockets[socket.id] = socket;

    // handling client complete event
    socket.on('complete', function(data) {
      onSocketComplete(socket, data, function (err) {
        if (err) {
          debug(err);
        }

        // returning socket to the free sockets pool
        freeSockets[socket.id] = socket;
      });
    });

    // client error event
    socket.on('error', function (err) {
      debug('Socket ' + socket.id + ' error: ' + err.stack);
      cleanSocketData(socket.id);
    });

    // client disconnected
    socket.on('disconnect', function() {
      cleanSocketData(socket.id);
    });
  }

  /**
   * Selects a socket from the free sockets pool
   */
  function getAFreeSocket() {
    var freeSocketIds = Object.keys(freeSockets);
    
    debug(freeSocketIds.length + ' free sockets are ready for image processing.');

    var freeSocket = freeSockets[freeSocketIds[Math.random() * freeSocketIds.length | 0]];
    return freeSocket;
  }

  /**
   * Helper function for handling image response and loading image data into
   * the buffer.
   *
   * @param      {string}                uri       Image URI.
   * @param      {http.IncomingMessage}  response  Response object.
   * @param      {Function}              fn        Callback.
   */
  function handleImageResponse(uri, response, fn) {
    var err;

    if (response.statusCode !== 200) {
      err = new Error('Invalid status code received for URI ' + uri + ': ' + response.statusCode);
      return fn(err);
    }

    // reading image data
    var buffers = [];
    response
      .on('error', function (err) {
        err = new Error('Could not retrieve data from URI ' + uri + ': ' + err);
        fn(err);
      })
      .on('data', function(buffer) {
        buffers.push(buffer);
      })
      .on('end', function() {
        var buffer = Buffer.concat(buffers);
        fn(null, buffer);
      });
  }

  /**
   * Downloads image from URI and loads it's content to the buffer.
   *
   * @param      {string}    uri     Image URI.
   * @param      {Function}  fn      Callback.
   */
  function downloadImage(uri, fn) {
    
    debug('Downloading original image ' + uri);

    // making GET request
    request
      .get(uri)
      .on('error', function (err) {
        err = new Error('Could not load image from URI ' + uri + ': ' + err);
        fn(err);
      })
      .on('response', function(response) {
        handleImageResponse(uri, response, function (err, buf) {
          if (err) return fn(err);
          fn(null, buf, response.headers['content-type']);
        });
      });
  }

  /**
   * Helper function for emitting process event to the client socket.
   *
   * @param      {Object}  socket       Socket.
   * @param      {Buffer}  buffer       Buffer.
   * @param      {String}  contentType  Image content type.
   * @param      {Number}  width        Target width.
   * @param      {Number}  height       Target height.
   * @param      {String}  targetUri    Target URI.
   */
  function emitProcessEvent(socket, buffer, contentType, width, height, targetUri) {
    
    // converting to Base64
    var imageData = buffer.toString('base64');

    // sending data to the client image/
    var type = contentType.substr(6);
    var params = {
      content: imageData,
      type: type,
      width: width,
      height: height,
      targetUri: targetUri
    };

    socket.emit('process', params);
  }

  /**
   * Handles incoming resize message.
   *
   * @param      {Object}  msg     NSQ message.
   */
  function onResizeMessage(msg) {
    var data = JSON.parse(msg.body);

    debug(Events.IMAGE_RESIZE + ' event: ' + msg.body);

    // get a free socket
    var freeSocket = getAFreeSocket();
    if (!freeSocket) {
      debug('No sockets available!');
      
      // requeue the message
      return msg.requeue(1000, false);
    }

    // downloading original image
    downloadImage(data.uri, function (err, buf, contentType) {
      if (err) {
        debug(err);

        // requeue the message
        return msg.requeue(1000);
      }

      // delete selected socket from free sockets pool
      delete freeSockets[freeSocket.id];

      // saving socket data for result handling
      socketsData[freeSocket.id] = {
        msg: msg,
        data: data,
        contentType: contentType
      };

      // sending process event to a free socket
      emitProcessEvent(freeSocket, buf, contentType, data.width, data.height, data.targetUri);

      // setting processing timeout to prevent client hanging
      socketTimeouts[freeSocket.id] = setTimeout(function () {
        debug('Timeout occured while resizing image ' + data.targetUri);

        // clean socket data
        cleanSocketData(freeSocket.id);

        // return socket to the free sockets pool
        freeSockets[freeSocket.id] = freeSocket;

        // requeue the message
        msg.requeue(1000);
      }, SOCKET_TIMEOUT);
    });
  }

  return {

    start: function (fn) {

      // handling socket connections
      io.on('connection', function(socket) {
        onSocketConnected(socket);
      });

      // handling new incoming message
      bus.on(Events.IMAGE_RESIZE, function (msg) {
        onResizeMessage(msg);
      });

      fn();
    }
  };

};