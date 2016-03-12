'use strict'

const WebTorrent = require('webtorrent')
const wt_ilp = require('./index')
const PaymentClient = require('./paymentClient').PaymentClient

const paymentClient = new PaymentClient({
  walletUri: 'https://blue.ilpdemo.org',
  username: 'alice',
  password: 'alice'
})
paymentClient.connect()

const leecher = new WebTorrent({
  // wrtc: wrtc
})

const magnetURI = 'magnet:?xt=urn:btih:a3734717a96baaf7ab9afad20ac47371066acc6a&dn=570994.PNG&tr=http%3A%2F%2Flocalhost%3A8000%2Fannounce'

const leecherTorrent = leecher.add(magnetURI, {
  announceList: [['http://localhost:8000/announce']]
})
leecherTorrent.on('wire', function (wire) {
  wire.use(wt_ilp({
    paymentClient: paymentClient,
    license: {
      content_hash: leecherTorrent.infoHash,
      creator_account: "https://red.ilpdemo.org/ledger/accounts/walt",
      creator_public_key: "QwRCBaiU95sIYi19/A4PqSpz93lQpchheiS1BVtlnVM=",
      license: "https://creativecommons.org/licenses/pay/1.0",
      licensee_public_key: 'lfFMEl9mWw56HygZGYejElw64wnKschRQSzu+JuZkVw=',
      expires_at: '2016-06-01T12:00:00Z',
      signature: 'thanks!'
    }
  }))
  console.log('leecherTorrent on wire')
})
leecherTorrent.on('download', function (chunkSize) {
  console.log('leecher downloaded ' + chunkSize)
})
leecherTorrent.on('done', function () {
  console.log('leecher done, downloaded ' + leecherTorrent.files.length + ' files')
})