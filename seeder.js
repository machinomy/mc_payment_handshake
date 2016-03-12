'use strict'

const WebTorrent = require('webtorrent')
const wt_ilp = require('./index')
const PaymentClient = require('./paymentClient').PaymentClient

const paymentClient = new PaymentClient({
  walletUri: 'https://red.ilpdemo.org',
  username: 'walt',
  password: 'walt'
})
paymentClient.connect()

const seeder = new WebTorrent({
  // wrtc: wrtc
})

const seederTorrent = seeder.seed('/Users/eschwartz/Downloads/570994.PNG', {
  announceList: [['http://localhost:8000/announce']]
})

seederTorrent.on('wire', function (wire) {
  wire.use(wt_ilp({
    paymentClient: paymentClient,
    price: '0.0001',
    // TODO license should come from the torrent file
    license: {
      content_hash: seederTorrent.infoHash,
      creator_account: "https://red.ilpdemo.org/ledger/accounts/walt",
      creator_public_key: "QwRCBaiU95sIYi19/A4PqSpz93lQpchheiS1BVtlnVM=",
      license: "https://creativecommons.org/licenses/pay/1.0",
      licensee_public_key: '7cLvHbeOmx4TGZovRInmw37xSGHm6P96VM+Ng5z0+C8=',
      expires_at: '2016-06-01T12:00:00Z',
      signature: 'thanks!'
    }
  }))
  console.log('seederTorrent on wire')
})

seeder.on('torrent', function (torrent) {
  console.log('seeding torrent ' + torrent.infoHash + ' ' + torrent.magnetURI)
})
