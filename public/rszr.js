/**
 * RSZR app script.
 */
(function (window) {
  'use strict';

  // Private fields
  var socket,     // socket.io client
      canvas,     // canvas Element for processing images
      canvasCtx;  // canvas 2d context

  /**
   * Helper function for dynamically loading external scripts.
   *
   * @param      {String}    url     Script URL.
   * @param      {Function}  fn      Callback function.
   */
  function loadScript(url, fn) {
    var script = document.createElement("script");
    script.type = "text/javascript";
    if (script.readyState) {
      // IE
      script.onreadystatechange = function() {
        if (script.readyState in ['loaded', 'complete']) {
          script.onreadystatechange = null;
          fn();
        }
      };
    } else {
      // Others
      script.onload = function() {
        fn();
      };
    }
    script.src = url;
    document.getElementsByTagName("head")[0].appendChild(script);
  }

  /**
   * Calculates optimal width and height of the image to fit well in the canvas.
   *
   * @param      {number}  originalWidth   The original width
   * @param      {number}  originalHeight  The original height
   * @param      {number}  targetWidth     The target width
   * @param      {number}  targetHeight    The target height
   * @return     {Array}   The image size.
   */
  function calculateImageSize(originalWidth, originalHeight, targetWidth, targetHeight) {
    var scaleX,
      scaleY,
      scale;

    // calculate scale parameters
    scaleX = targetWidth / originalWidth;
    scaleY = targetHeight / originalHeight;

    // use the maximum scale ratio to fill the whole canvas by cropping original image
    scale = Math.max(scaleX, scaleY);

    return [originalWidth * scale, originalHeight * scale];
  }

  /**
   * Process image data.
   *
   * @param      {string}    base64  Base64 encoded original image data.
   * @param      {string}    type    Image content type.
   * @param      {number}    width   Target width.
   * @param      {number}    height  Target height.
   * @param      {Function}  fn      Callback.
   */
  function processImage(base64, type, width, height, fn) {
    // load image data
    var img = new Image();
    img.onload = function() {

      // calculate image size
      var size = calculateImageSize(img.width, img.height, width, height),
          realWidth = size[0],
          realHeight = size[1];

      // scale canvas to target size
      canvas.setAttribute('width', width);
      canvas.setAttribute('height', height);

      // draw image and center it in the canvas
      canvasCtx.drawImage(img, (width - realWidth)/2, (height - realHeight)/2, realWidth, realHeight);

      // get scaled image data
      var canvasData = canvas.toDataURL('image/' + type, 1.0);
      var base64 = canvasData.replace(/data:image\/[^;]+;base64,/, '');

      fn(base64);
    };

    img.src = 'data:image/' + type + ';base64,' + base64;
  }

  /**
   * Inits RSZR app.
   */
  function init() {

    // init socket.io
    socket = io();

    // prepare canvas for image processing
    canvas = document.createElement('canvas');
    canvasCtx = canvas.getContext('2d');

    // start listening for incoming messages
    socket.on('process', function (data) {
      processImage(data.content, data.type, data.width, data.height, function (base64) {
        // send processed data back to the server
        socket.emit('complete', base64);
      });
    });
  }

  // loading socket.io
  loadScript('/socket.io/socket.io.js', function () {
    init();
  });

})(window);