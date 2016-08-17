/**
 * @fileOverview Image uploading middleware.
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

var bucket = process.env.S3_BUCKET;
var s3Region = process.env.S3_REGION;

var debug = require('debug')('rszr:api:image-upload');
var uuid = require('node-uuid');
var path = require('path');
var multiparty = require('multiparty');
var AWS = require('aws-sdk');
var s3 = new AWS.S3({region: s3Region});
var Bus = require('../../../lib/bus');
var bus = new Bus();
var utils = require('../../../lib/utils');

/**
 * Image uploading middleware.
 *
 * @param      {Request}   req     The request object.
 * @param      {Response}  res     The response object.
 * @param      {Function}  next    The next callback.
 */
module.exports = function (req, res, next) {
  if (!utils.isFormData(req)) {
    return res.status(406).send({ message: 'Not Acceptable: expecting multipart/form-data' });
  }

  var id = req.query.id || uuid.v4();

  // parsing request
  var form = new multiparty.Form({
    autoFields: true
  });

  var filesCount = 0;
  form.on('part', function (part) {
    if (filesCount > 0) {
      return;
    }

    if (!utils.isImageFile(part)) {
      return res.status(400).send({ message: 'Bad Request: expecting image/* file' });
    }

    // upload to S3
    filesCount++;
    var key = id + path.extname(part.filename);
    var uri = utils.getS3Uri(bucket, key);
    debug('Uploading image file ' + id + ' of size ' + part.byteCount + ' bytes to ' + uri);

    var params = {
      Bucket: bucket,
      Key: key,
      ACL: 'public-read',
      Body: part,
      ContentLength: part.byteCount,
      ContentType: part.headers['content-type']
    };

    s3.putObject(params, function (err) {
      if (err) return next(err);

      debug("Image " + id + " successfully uploaded to " + uri);

      // send event
      var event = {
        id: id,
        uri: uri
      };
      bus.emitImageUploaded(event, function (err) {
        if (err) return next(err);

        res.json(event);
      });
    });
  });

  form.on('error', function (err) {
    return next(err);
  });

  form.parse(req);
};
