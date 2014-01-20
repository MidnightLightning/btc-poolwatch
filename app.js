"use strict";
var async = require('async');
var binstring = require('binstring');
var BTCNetwork = require('btc-p2p').BTCNetwork;
var Storage = require('./lib/Storage').Storage;
var fs = require('fs');

// Set up data directory
var dataDir = process.env.HOME + '/.cryptocoinjs';
var db = false; // Storage connection
async.waterfall([
  function(cb) {
    fs.mkdir(dataDir, function(err) {
      if (err && err.code !== 'EEXIST') {
        cb(new Error('Failed to create data directory'));
      }
      cb(null);
    });
  },
  function(cb) {
    db = new Storage(dataDir+'/mempool.db', cb);
  }],
  function(err, rs) {
    if (err) {
      console.log(err);
      process.exit(0);
    }
  }
);


// Connect to BTC network
var n = new BTCNetwork();
process.once('SIGINT', function() {
  console.log('Got SIGINT; closing...');
  process.once('SIGINT', function() {
    // Double SIGINT; force-kill
    process.exit(0);
  });
  n.shutdown();
});

n.on('error', function(d) {
  if (d.severity == 'error' || d.severity == 'warning') {
    console.log('Error:', d);
  }
});

n.on('peerStatus', function(d) {
  //console.log('status:', d);
  console.log('Connected to '+d.numActive+' peers');
});

n.on('verackMessage', function verackReceived(d) {
  // Send a MEMPOOL message, to get all transactions.
  d.peer.send('mempool');
});

// Every time a transaction is received, note its timestamp
n.on('transactionInv', function transactionInv(d) {
  var key = Buffer.concat([
    Buffer(d.peer.getUUID(), 'utf8'),
    Buffer('~', 'utf8'),
    d.hash
  ]);
  var value = binstring(parseInt(new Date().getTime()/1000), {in:'number', out:'buffer'});
  db.putOrIgnore(key, value, function(err, rs) {
    if (err) {
      console.log(err);
      process.emit('SIGINT');
      return;
    }
    if (rs == 'Inserted value') {
      console.log('Peer '+d.peer.getUUID()+' knows of Transaction '+d.hash.toString('hex'));
    }
  });
});

// Launch with lots of peer connections
n.options.maxPeers = 50;
n.launch();