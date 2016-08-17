/**
 * @fileOverview HTTP API endpoints.
 */

var express = require('express');
var router = express.Router();

// mounting image API
var imageApi = require('./image');
router.use('/image', imageApi);

module.exports = router;
