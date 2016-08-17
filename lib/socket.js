/**
 * Socket interface for resizing images.
 */

var Bus = require('./bus');
var bus = new Bus();
var Events = require('./constants').Events;
var debug = require('debug')('rszr:socket');
var request = require('request');
var path = require('path');

module.exports = function (server) {
  
  var io = require('socket.io')(server),
      sockets = {},
      freeSockets = {},
      socketData = {};

  return {

    start: function (fn) {

      io.on('connection', function(socket) {
        
        sockets[socket.id] = socket;
        freeSockets[socket.id] = socket;

        // handling new socket connection
        socket.on('complete', function(data) {
          var socketData = socketData[socket.id];
          delete socketData[socket.id];

          debug('Image resizing completed for image: ' + socketData.data.uri);
          
          // finilizing msg
          socketData.msg.finish();
          
          // returning socket to the pool
          freeSockets[socket.id] = socket;
        });

        socket.on('disconnect', function() {
          delete sockets[socket.id];
          delete freeSockets[socket.id];
          delete socketData[socket.id];
        });
      });

      // handling new incoming message
      bus.on(Events.IMAGE_RESIZE, function (msg) {
        var data = JSON.parse(msg.body);

        debug(Events.IMAGE_RESIZE + ' event: ' + msg.body);

        // selecting a socket from the free sockets pool
        var freeSocketIds = Object.keys(freeSockets);
        var aFreeSocket = freeSockets[freeSocketIds[Math.random() * freeSocketIds.length | 0]];
        if (!aFreeSocket) {
          debug('No sockets available!');
          
          // requeue the message
          return msg.requeue(1000, false);
        }

        // downloading original image
        debug('Downloading original image ' + data.uri);

        request
          .get(data.uri)
          .on('response', function(response) {
            if (response.statusCode !== 200) {
              debug('Invalid status code received for URI ' + data.uri + ': ' + response.statusCode);

              // requeue the message
              return msg.requeue(1000, false);
            }

            // reading image data
            var buffers = [];

            response
              .on('error', function (err) {
                debug('Could not retrieve data from URI ' + data.uri + ': ' + err);

                // requeue the message
                msg.requeue(1000, false);
              })
              .on('data', function(buffer) {
                buffers.push(buffer);
              })
              .on('end', function() {
                var buffer = Buffer.concat(buffers);
                
                // converting to Base64
                var imageData = buffer.toString('base64');

                // delete selected socket from free sockets pool
                delete freeSockets[aFreeSocket.id];

                // saving socket data
                socketData[aFreeSocket.id] = {
                  msg: msg,
                  data: data
                };

                var type = path.extname(data.uri).substr(1);
                var params = {
                  width: data.width,
                  height: data.height,
                  type: type,
                  content: imageData
                };

                aFreeSocket.emit('process', params);
              });
          });
      });

      fn();
    }
  };

};