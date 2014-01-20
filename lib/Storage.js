"use strict";
var leveldown = require('leveldown');
var async = require('async');

function isNotFoundError(err) {
  return (err !== null && err.message && err.message.indexOf('NotFound') !== -1)? true : false;
}

var Storage = exports.Storage = function Storage(uri, callback) {
  var defaultCreateOpts = {
    createIfMissing: true,
  };
  
  var self = this;
  async.series([
    function(cb) {
      self.handle = leveldown(uri);
      self.handle.open(defaultCreateOpts, cb);
    }
  ], callback);
};

Storage.prototype.putOrIgnore = function putOrIgnore(key, value, callback) {
  var self = this;
  self.handle.get(key, function(err, rs) {
    if (typeof err !== 'null') {
      if (isNotFoundError(err)) {
        // Not currently set; insert the value
        self.handle.put(key, value, function(err) {
          if (err) {
            callback(err);
            return;
          }
          callback(null, 'Inserted value');
        });
        return;
      }
    } else {
      // Other error; return
      var e = new Error('Failed to insert value');
      e.inner = err;
      callback(e);
      return;
    }
    // Otherwise, currently set; ignore
    callback(null, 'Already exists; ignored');
  });
};