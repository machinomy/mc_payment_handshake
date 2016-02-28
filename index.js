'use strict'

const EventEmitter = require('events').EventEmitter
const inherits = require('inherits')
const bencode = require('bencode')

module.exports = function () {
  inherits(wt_ilp, EventEmitter)

  function wt_ilp (wire) {
    EventEmitter.call(this)

    this._wire = wire
    this._fetching = false
  }

  wt_ilp.prototype.name = 'wt_ilp'

  wt_ilp.prototype.onHandshake = function (infoHash, peerId, extensions) {
    this._infoHash = infoHash
    console.log('extensions', extensions)
  }

  wt_ilp.prototype.onExtendedHandshake = function (handshake) {
    console.log('onExtendedHandshake', handshake)
  }

  wt_ilp.prototype.onMessage = function (buf) {
    let dict, trailer
    try {
      const str = buf.toString()
      const trailerIndex = str.indexOf('ee') + 2
      dict = bencode.decode(str.substring(0, trailerIndex))
      trailer = buf.slice(trailerIndex)
    } catch (err) {
      // drop invalid messages
      return
    }
    this.emit('ilp', dict)
  }

  wt_ilp.prototype.fetch = function () {
    const buf = bencode.encode({
      msg_type: 0
    })
    this._fetching = true
    this._wire.extended('wt_ilp', buf)
  }

  wt_ilp.prototype.cancel = function () {
    this._fetching = false
  }

  return wt_ilp
}
