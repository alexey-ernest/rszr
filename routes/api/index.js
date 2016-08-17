/**
 * @fileOverview HTTP API endpoints.
 */

var express = require('express');
var router = express.Router();

// mounting image API
var imageApi = require('./images');
router.use('/images', imageApi);

module.exports = router;
