/**
 * Socket interface for resizing images.
 */

var Bus = require('./bus');
var bus = new Bus();
var Events = require('./constants').Events;
var debug = require('debug')('rszr:socket');

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

        // selecting a socket from free socket pool
        var freeSocketIds = Object.keys(freeSockets);
        var aFreeSocket = freeSockets[freeSocketIds[Math.random() * freeSocketIds.length | 0]];
        if (!aFreeSocket) {
          debug('No sockets available!');
          msg.requeue(1000, false);
          return;
        }

        delete freeSockets[aFreeSocket.id];

        // saving socket data
        socketData[aFreeSocket.id] = {
          msg: msg,
          data: data
        };

        aFreeSocket.emit('process', data);
      });

      fn();
    }
  };

};