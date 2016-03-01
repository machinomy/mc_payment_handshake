'use strict'

const WebTorrent = require('webtorrent')
const wt_ilp = require('./index')

const leecher = new WebTorrent({
  // wrtc: wrtc
})

const magnetURI = 'magnet:?xt=urn:btih:a3734717a96baaf7ab9afad20ac47371066acc6a&dn=570994.PNG&tr=http%3A%2F%2Flocalhost%3A8000%2Fannounce'
const token = '2921c294-4d01-477b-99b6-de25994dc598'

const leecherTorrent = leecher.add(magnetURI, {
  announceList: [['http://localhost:8000/announce']]
})
leecherTorrent.on('wire', function (wire) {
  wire.use(wt_ilp({
    token: '2921c294-4d01-477b-99b6-de25994dc598'
  }))
  console.log('leecherTorrent on wire')
  // wire.wt_ilp.fetch()
  // wire.on('handshake', function (handshake) {
  //   console.log('handshake')
  // })
  wire.once('extended', function (handshake) {
    console.log('leecher extended', handshake)
  })
})
leecherTorrent.on('download', function (chunkSize) {
  console.log('leecher downloaded ' + chunkSize)
})
leecherTorrent.on('done', function () {
  console.log('leecher done, downloaded ' + leecherTorrent.files.length + ' files')
})