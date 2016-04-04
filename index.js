'use strict'

const EventEmitter = require('events').EventEmitter
const inherits = require('inherits')
const bencode = require('bencode')
const BigNumber = require('bignumber.js')
const debug = require('debug')('wt_ilp')

/**
 * Returns a bittorrent extension
 * @param {String} opts.account Address of five-bells-wallet
 * @param {String} opts.price Amount to charge per chunk
 * @param {String} opts.publicKey Ed25519 public key
 * @return {BitTorrent Extension}
 */
module.exports = function (opts) {
  if (!opts) {
    opts = {}
  }

  inherits(wt_ilp, EventEmitter)

  function wt_ilp (wire) {
    EventEmitter.call(this)

    debug('wt_ilp instantiated')

    this._wire = wire
    this._infoHash = null

    this.price = new BigNumber(opts.price || 0)
    this.publicKey = opts.publicKey
    this.account = opts.account

    // Peer fields will be set once the extended handshake is received
    this.peerAccount = null
    this.peerPrice = null
    this.peerPublicKey = null
    this.peerBalance = new BigNumber(0)

    this.amForceChoking = false

    // Add fields to extended handshake, which will be sent to peer
    this._wire.extendedHandshake.ilp_public_key = this.publicKey
    this._wire.extendedHandshake.ilp_account = this.account
    this._wire.extendedHandshake.ilp_price = this.price.toString()

    debug('Extended handshake to send:', this._wire.extendedHandshake)

    this._interceptRequests()
  }

  wt_ilp.prototype.name = 'wt_ilp'

  wt_ilp.prototype.onHandshake = function (infoHash, peerId, extensions) {
    this._infoHash = infoHash
  }

  wt_ilp.prototype.onExtendedHandshake = function (handshake) {
    if (!handshake.m || !handshake.m.wt_ilp) {
      return this.emit('warning', new Error('Peer does not support wt_ilp'))
    }

    if (handshake.ilp_account) {
      this.peerAccount = handshake.ilp_account.toString('utf8')
    }
    // TODO remove price from handshake if the requests are going to be explicit
    if (handshake.ilp_price) {
      this.peerPrice = new BigNumber(handshake.ilp_price.toString('utf8'))
    }
    if (handshake.ilp_public_key) {
      this.peerPublicKey = handshake.ilp_public_key.toString('utf8')
    }

    this.emit('ilp_handshake', {
      account: this.peerAccount,
      price: this.peerPrice,
      publicKey: this.peerPublicKey
    })

    // this._unchoke()
  }

  wt_ilp.prototype.onMessage = function (buf) {
    let dict
    try {
      const str = buf.toString()
      const trailerIndex = str.indexOf('ee') + 2
      dict = bencode.decode(str.substring(0, trailerIndex))
    } catch (err) {
      // drop invalid messages
      return
    }
    const amount = Buffer.isBuffer(dict.amount) ? dict.amount.toString('utf8') : 0
    switch (dict.msg_type) {
      // request for funds (denominated in the peer's ledger's asset)
      // { msg_type: 0, amount: 10 }
      case 0:
        debug('Got payment request for: ' + amount + (this.peerPublicKey ? ' (' + this.peerPublicKey.slice(0, 8) + ')' : ''))
        this.emit('payment_request', amount)
        break
      case 1:
        debug('Peer is complaining that the price is too high, suggested price: ' + amount)
        this.emit('payment_request_too_high', amount)
        break
    }
  }

  wt_ilp.prototype.forceChoke = function () {
    debug('force choke peer' + (this.peerPublicKey ? ' (' + this.peerPublicKey.slice(0, 8) + ')' : ''))
    this.amForceChoking = true
    this._wire.choke()
    // this._wireUnchoke = this._wire.unchoke
    // this._wire.unchoke = function () {
    //   debug('fake unchoke called')
    //   // noop
    //   // Other parts of the webtorrent code will try to unchoke it
    // }
  }

  wt_ilp.prototype.unchoke = function () {
    debug('unchoke' + (this.peerPublicKey ? ' (' + this.peerPublicKey.slice(0, 8) + ')' : ''))
    this.amForceChoking = false
    // if (this._wireUnchoke) {
    //   this._wire.unchoke = this._wireUnchoke
    //   this._wireUnchoke = null
    // }
    // this._wire.unchoke()
  }

  wt_ilp.prototype._interceptRequests = function () {
    const _this = this
    const _onRequest = this._wire._onRequest
    this._wire._onRequest = function (index, offset, length) {
      _this.emit('request', length)

      // Call onRequest after the handlers triggered by this event have been called
      const _arguments = arguments
      setTimeout(function () {
        if (!_this.amForceChoking) {
          debug('responding to request')
          _onRequest.apply(_this._wire, _arguments)
        } else {
          debug('force choking peer, dropping request')
        }
      }, 0)
    }
  }

  wt_ilp.prototype._send = function (dict, trailer) {
    var buf = bencode.encode(dict)
    if (Buffer.isBuffer(trailer)) {
      buf = Buffer.concat([buf, trailer])
    }
    this._wire.extended('wt_ilp', buf)
  }

  wt_ilp.prototype.sendPaymentRequest = function (amount) {
    debug('Send payment request for: ' + amount.toString() + (this.peerPublicKey ? ' (' + this.peerPublicKey.slice(0, 8) + ')' : ''))
    this._send({
      msg_type: 0,
      amount: amount.toString()
    })
  }

  wt_ilp.prototype.sendPaymentRequestTooHigh = function (amount) {
    if (!amount) {
      amount = 0
    }
    debug('Telling peer price is too high, suggesting price: ' + amount.toString())
    this._send({
      msg_type: 1,
      amount: amount.toString()
    })
  }

  return wt_ilp
}
