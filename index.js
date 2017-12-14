'use strict'

const EventEmitter = require('events').EventEmitter
const inherits = require('inherits')
const bencode = require('bencode')
const debug = require('debug')('mc_ph')

/**
 * Returns a bittorrent extension
 * @param {String} opts.address Ethereum address
 * @return {BitTorrent Extension}
 */
module.exports = function (opts) {

  const MessageType = {
    SendAddress: 0
  }

  if (!opts) {
    opts = {}
  }

  inherits(mc_ph, EventEmitter)

  function mc_ph (wire) {
    EventEmitter.call(this)

    debug('mc_payment_handshake instantiated')

    this._wire = wire

    this.address = opts.address
    this.host = opts.host
    this.port = opts.port

    if (!this.address) {
      throw new Error('Must instantiate mc_payment_handshake with an ethereum address')
    }

    // Peer fields will be set once the extended handshake is received
    this.peerAddress = null
    this.peerHost = null
    this.peerPort = null

    this.amForceChoking = false

    // Add fields to extended handshake, which will be sent to peer
    this._wire.extendedHandshake.mc_ph_address = this.address

    debug('Extended handshake to send:', this._wire.extendedHandshake)

    this._interceptRequests()
  }

  mc_ph.prototype.name = 'mc_ph'

  mc_ph.prototype.onHandshake = function (infoHash, peerId, extensions) {
    // noop
  }

  mc_ph.prototype.onExtendedHandshake = function (handshake) {
    if (!handshake.m || !handshake.m.mc_ph) {
      return this.emit('mc_payment_handshake_not_supported', new Error('Peer does not support mc_payment_handshake'))
    }

    if (handshake.mc_ph_address) {
      this.peerAddress = handshake.mc_ph_address.toString('utf8')
    }

    this.emit('mc_payment_handshake', {
      address: this.peerAddress
    })
  }

  mc_ph.prototype.onMessage = function (buf) {
    let dict
    try {
      const str = buf.toString()
      const trailerIndex = str.indexOf('ee') + 2
      dict = bencode.decode(str.substring(0, trailerIndex))
    } catch (err) {
      // drop invalid messages
      return
    }
    const address = Buffer.isBuffer(dict.address) ? dict.address.toString('utf8') : ''
    switch (dict.msg_type) {
      case MessageType.SendAddress:
        debug('Got opposite address: ' + address + ' from ' + this.peerHost + ':' + this.peerPort)
        this.emit('got_address', address)
        break
      default:
        debug('Got unknown message: ', dict)
        break
    }
  }

  mc_ph.prototype.forceChoke = function () {
    debug('force choke peer ' + this.peerHost + ':' + this.peerPort)
    this.amForceChoking = true
    this._wire.choke()
  }

  mc_ph.prototype.unchoke = function () {
    debug('unchoke' + this.peerHost + ':' + this.peerPort)
    this.amForceChoking = false
  }

  mc_ph.prototype._interceptRequests = function () {
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

  mc_ph.prototype._send = function (dict) {
    this._wire.extended('mc_payment_handshake', bencode.encode(dict))
  }

  mc_ph.prototype.sendAddress = function (address) {
    debug('Send address to ' + this.peerHost + ':' + this.peerPort)
    this._send({
      msg_type: MessageType.SendAddress,
      address: address
    })
  }

  return mc_ph
}
