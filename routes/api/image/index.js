
/**
 * @fileOverview Image endpoints.
 */

var express = require('express');
var router = express.Router();

var uploadImage = require('./upload-image');

/**
 * Upload endpoint.
 */
router.post('/',
  uploadImage
  );

module.exports = router;
