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

var Bus = require('./bus');
var bus = new Bus();
var Events = require('./constants').Events;
var debug = require('debug')('rszr:socket');
var request = require('request');
var path = require('path');

var bucket = process.env.S3_BUCKET;
var s3Region = process.env.S3_REGION;
var AWS = require('aws-sdk');
var s3 = new AWS.S3({region: s3Region});

module.exports = function (server) {
  
  var io = require('socket.io')(server),
      sockets = {},
      freeSockets = {},
      socketsData = {};

  return {

    start: function (fn) {

      io.on('connection', function(socket) {
        
        sockets[socket.id] = socket;
        freeSockets[socket.id] = socket;

        function cleanSocketData(id) {
          delete sockets[id];
          delete freeSockets[id];
          delete socketsData[id];
        }

        // handling new socket connection
        socket.on('complete', function(data) {

          var socketData = socketsData[socket.id];
          delete socketsData[socket.id];

          debug('Image resizing completed for image ' + socketData.data.targetUri);

          // read data
          var buf = new Buffer(data, 'base64');

          // upload to s3
          debug('Uploading resized image file of size ' + buf.length + ' bytes to ' + socketData.data.targetUri);

          var key = path.basename(socketData.data.targetUri);
          var params = {
            Bucket: bucket,
            Key: key,
            ACL: 'public-read',
            Body: buf,
            ContentLength: buf.length,
            ContentType: socketData.contentType
          };

          s3.putObject(params, function (err) {
            if (err) {
              debug('An error occured while uploading resized image to ' + socketData.data.targetUri + ': ' + err);
              
              // requeue the message
              return msg.requeue(1000);
            }

            debug('Resized image has been successfully uploaded to ' + socketData.data.targetUri);

            // finilizing msg
            socketData.msg.finish();
            
            // returning socket to the pool
            freeSockets[socket.id] = socket;
          });
        });

        socket.on('error', function (err) {
          debug('Socket ' + socket.id + ' error: ' + err.stack);
          cleanSocketData(socket.id);
        });

        socket.on('disconnect', function() {
          cleanSocketData(socket.id);
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
              return msg.requeue(1000);
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
                socketsData[aFreeSocket.id] = {
                  msg: msg,
                  data: data,
                  contentType: response.headers['content-type']
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