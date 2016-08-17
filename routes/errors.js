/**
 * @fileOverview Default errors.
 */

var debug = require('debug')('rszr:api');

exports.notfound = function (req, res) {
  res.status(404).send({ message: 'Resource not found' });
};

exports.error = function (err, req, res, next) {
  debug(err.stack);

  var msg = 'Internal Server Error';
  res.status(500).send({ error: msg });
};