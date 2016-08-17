
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var logger = require('morgan');

var errors = require('./routes/errors');
var routes = require('./routes');

var app = express();

// logger
if (app.get('env') === 'development') {
  app.use(logger('dev'));
} else {
  app.use(logger());
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/', routes);

// error handlers
app.use(errors.notfound);
app.use(errors.error);

module.exports = app;
