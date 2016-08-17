/**
 * @fileOverview Helpful utils.
 */

module.exports = {

  /**
   * Checks wheter request is multipart/form-data request.
   *
   * @method     isFormData
   * @param      {Object}   req     Express Request object.
   * @return     {boolean}  true if request is multipart/form-data request.
   */
  isFormData: function(req) {
    var type = req.headers['content-type'] || '';
    return 0 === type.indexOf('multipart/form-data');
  },

  /**
   * Checking whether multiparty's part is a video file.
   *
   * @method     isImageFile
   * @param      {Object}   part  Multiparty part object.
   * @return     {boolean}  true if part has Content-Type header image/*
   */
  isImageFile: function(part) {
    return 0 === part.headers['content-type'].indexOf('image/');
  },

   /**
   * Builds full S3 object URI.
   *
   * @method     getObjectUri
   * @param      {string}  bucket  S3 bucket name.
   * @param      {string}  key     Object key name.
   * @return     {string}  Full object URI.
   */
  getS3Uri: function(bucket, key) {
    return 'https://' + bucket + '.s3.amazonaws.com/' + key;
  }

};