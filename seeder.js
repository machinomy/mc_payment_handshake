'use strict'

const WebTorrent = require('webtorrent')
const wt_ilp = require('./index')
// const wrtc = require('wrtc')

const seeder = new WebTorrent({
  // wrtc: wrtc
})

const seederTorrent = seeder.seed('/Users/eschwartz/Downloads/570994.PNG', {
  announceList: [['http://localhost:8000/announce']]
})

seederTorrent.on('wire', function (wire) {
  wire.use(wt_ilp({
    account: 'http://localhost:3001/accounts/bob',
    price: '0.0001'
  }))
  console.log('seederTorrent on wire')
})

seeder.on('torrent', function (torrent) {
  console.log('seeding torrent ' + torrent.infoHash + ' ' + torrent.magnetURI)
})
