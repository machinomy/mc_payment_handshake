'use strict'

const EventEmitter = require('events').EventEmitter
const inherits = require('inherits')
const bencode = require('bencode')

/**
 * Returns a bittorrent extension
 * @param {String} opts.account ILP ledger account URI
 * @param {String} opts.price Amount to charge per chunk
 * @param {String} opts.token Token to identify payment
 * @return {BitTorrent Extension}
 */
module.exports = function (opts) {
  if (!opts) {
    opts = {}
  }

  inherits(wt_ilp, EventEmitter)

  function wt_ilp (wire) {
    EventEmitter.call(this)

    this._peerAccount = null
    this._peerPrice = null
    this._peerToken = null

    this._wire = wire
    this._fetching = false

    // Seeder
    if (opts.account && opts.price) {
      this._wire.extendedHandshake.account = opts.account
      this._wire.extendedHandshake.price = opts.price
    }

    // Leecher
    if (opts.token) {
      this._wire.extendedHandshake.token = opts.token
    }
  }

  wt_ilp.prototype.name = 'wt_ilp'

  wt_ilp.prototype.onHandshake = function (infoHash, peerId, extensions) {
    this._infoHash = infoHash
  }

  wt_ilp.prototype.onExtendedHandshake = function (handshake) {
    if (!handshake.m || !handshake.m.wt_ilp) {
      return this.emit('warning', new Error('Peer does not support wt_ilp'))
    }

    // Sent from seeder
    if (handshake.account && handshake.price) {
      this._peerAccount = handshake.account.toString('utf8')
      this._peerPrice = handshake.price.toString('utf8')

      this._sendPayment()
    }

    // Sent from leecher
    if (handshake.token) {
      this._peerToken = handshake.token.toString('utf8')

      this._checkToken(this._peerToken)
    }
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
    console.log('wt_ilp got message', dict)
    switch (dict.msg_type) {
      // Request Payment
      case 0:
        console.log('wt_ilp got payment request')
        this._send({
          msg_type: 1,
          account: this._account,
          price: this._price
        })
        break
      case 1:
        console.log('wt_ilp got account details: ' + dict.account + ' ' + dict.price)
        break
    }
  }

  wt_ilp.prototype._forceChoke = function () {
    this._wire.choke()
    this._wireUnchoke = this._wire.unchoke
    this._wire.unchoke = function () {
      console.log('fake unchoke called')
    }
  }

  wt_ilp.prototype._unchoke = function () {
    if (this._wireUnchoke) {
      this._wire.unchoke = this._wireUnchoke
    }
    this._wire.unchoke()
  }

  wt_ilp.prototype._checkToken = function () {
    if (!this._peerToken) {
      this._forceChoke()
    }

    this._forceChoke()
    const _this = this
    console.log('checking balance')
    setTimeout(function () {
      console.log('unchoking')
      _this._unchoke()
    }, 3000)
  }

  wt_ilp.prototype._sendPayment = function () {
    console.log('send ' + this._peerPrice + ' to ' + this._peerAccount)
  }

  wt_ilp.prototype.cancel = function () {
    this._fetching = false
  }

  wt_ilp.prototype._send = function (dict, trailer) {
    var buf = bencode.encode(dict)
    if (Buffer.isBuffer(trailer)) {
      buf = Buffer.concat([buf, trailer])
    }
    this._wire.extended('wt_ilp', buf)
  }

  return wt_ilp
}
