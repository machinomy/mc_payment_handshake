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
    debug('wt_ilp onMessage', dict)
    // switch (dict.msg_type) {
    //   // Low Balance
    //   case 0:
    //     debug('wt_ilp got low balance message', dict.bal.toString('utf8'))
    //     this._paymentManager.handlePaymentRequest({
    //       peerPublicKey: this.peerPublicKey,
    //       destinationAmount: this.peerPrice.times(5).toString(),
    //       destinationAccount: this.peerAccount,
    //       // TODO make the condition dependent on the memo to ensure that it can't be changed
    //       // TODO don't stringify the memo once https://github.com/interledger/five-bells-shared/pull/111 is merged
    //       destinationMemo: {
    //         public_key: opts.license.licensee_public_key,
    //       }
    //     })
    //     break
    // }
  }

  wt_ilp.prototype.forceChoke = function () {
    debug('force choke')
    this._wire.choke()
    this._wireUnchoke = this._wire.unchoke
    this._wire.unchoke = function () {
      debug('fake unchoke called')
      // noop
      // Other parts of the webtorrent code will try to unchoke it
    }
  }

  wt_ilp.prototype.unchoke = function () {
    debug('unchoke')
    if (this._wireUnchoke) {
      this._wire.unchoke = this._wireUnchoke
      this._wireUnchoke = null
    }
    this._wire.unchoke()
  }

  wt_ilp.prototype._interceptRequests = function () {
    const _this = this
    const _onRequest = this._wire._onRequest
    this._wire._onRequest = function () {
      _this.emit('request', arguments)
      _onRequest.apply(_this._wire, arguments)
    }
  }


  wt_ilp.prototype._send = function (dict, trailer) {
    var buf = bencode.encode(dict)
    if (Buffer.isBuffer(trailer)) {
      buf = Buffer.concat([buf, trailer])
    }
    this._wire.extended('wt_ilp', buf)
  }

  // wt_ilp.prototype._sendLowBalance = function () {
  //   const peerBalance = this._paymentManager.getBalance(this.peerPublicKey)
  //   debug('Sending low balance notification. Peer ' + this.peerPublicKey + ' has balance: ' + peerBalance)
  //   this._send({
  //     msg_type: 0,
  //     bal: peerBalance.toString()
  //   })
  // }

  // // Before sending requests we want to make sure the peer has
  // // sufficient funds with us and then charge them for the request
  // wt_ilp.prototype._setupInterceptRequests = function () {
  //   const _this = this
  //   const _onRequest = this._wire._onRequest
  //   this._wire._onRequest = function () {
  //     if (_this._paymentManager.ready && _this._licenseIsValid()) {
  //       const peerHasSufficientBalance = _this._paymentManager.hasSufficientBalance({
  //         peerPublicKey: _this.peerPublicKey,
  //         contentHash: _this._infoHash,
  //       })
  //       if (peerHasSufficientBalance) {
  //         _this._unchoke()
  //       } else {
  //         _this._sendLowBalance()
  //         _this._forceChoke()
  //       }
  //     } else {
  //       _this._forceChoke()
  //     }

  //     if (!_this._wire.amChoking) {
  //       _this._paymentManager.chargeRequest.call(_this._paymentManager, {
  //         peerPublicKey: _this.peerPublicKey,
  //         contentHash: _this._infoHash,
  //       })
  //       _onRequest.apply(_this._wire, arguments)
  //     }
  //   }
  // }

  return wt_ilp
}
