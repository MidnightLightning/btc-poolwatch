"use strict";
var leveldown = require('leveldown');
var async = require('async');

var dataDir = process.env.HOME + '/.cryptocoinjs/mempool.db';
var db = leveldown(dataDir);

var peers = {};
var peerCount = 0;
var txns = {};
var txnCount = 0;
var txnPropagation = {};

db.open({createIfMissing: false}, function(err) {
  if (err) {
    console.log(err);
    return;
  }
  
  var i = db.iterator();
  console.log('Parsing database entries...');
  doLoop(i, 1, function(err) {
    console.log('');
    console.log(txnCount+' transactions were gathered from '+peerCount+' peers');
    for (var i in txnPropagation) {
      if (txnPropagation.hasOwnProperty(i)) {
        var date = new Date(txnPropagation[i].earliest*1000);
        console.log('Transaction '+i+' was known by '+txnPropagation[i].count+' peers, and was first seen '+date);
      }
    }
  });
})


function doLoop(iterator, count, callback) {
  if (count > 100000) return false; // Stop runaway process
  if (count % 100 == 0) {
    process.stdout.write('.');
  }
  if (count % 1000 == 0) {
    process.stdout.write(' ');
  }
  if (count % 10000 == 0) {
    process.stdout.write('\n');
  }
  
  iterator.next(function(err, key, value) {
    if (err) {
      callback(err);
      return;
    }
    if (typeof key === 'undefined') {
      callback(null);
      return;
    }
    
    // key = [hash]~host~port
    var tmp = key.toString('utf8').split('~');
    var port = tmp.pop();
    var host = tmp.pop();
    var hash = key.slice(0, key.length-(host.length+port.length+2)).toString('hex');
    var timestamp = value.readUInt32BE(0);
    
    if (!peers[host+'~'+port]) {
      peers[host+'~'+port] = true;
      peerCount++;
    }
    if (!txns[hash]) {
      txns[hash] = true;
      txnCount++;
    }
    if (typeof txnPropagation[hash] == 'undefined') {
      txnPropagation[hash] = {count:1, earliest:timestamp};
    } else {
      txnPropagation[hash].count += 1;
      if (timestamp < txnPropagation[hash].earliest) {
        txnPropagation[hash].earliest = timestamp;
      }
    }
    doLoop(iterator, ++count, callback);
  });
};