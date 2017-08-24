module.exports = RpcEventsWsClient

var RpcEmitter = require('rpc-events')
var inherits = require('inherits')
var isBrowser = typeof window !== 'undefined'
var WebSocket = isBrowser ? window.WebSocket : require('' || 'ws')

inherits(RpcEventsWsClient, RpcEmitter)

function RpcEventsWsClient (opts) {
  RpcEmitter.call(this, opts)
  this.timeout = this.timeout || 2500
  this.openTimeout = this.openTimeout || 2500
  this.reopenDelay = this.reopenDelay || 5000
  this.state = 'closed'
  this._connectQueue = []
}

RpcEventsWsClient.prototype.open = function () {
  if (this.state === 'open' || this.state === 'opening') {
    throw new Error('Already open')
  } else {
    clearTimeout(this._reopening)
    this.state = 'opening'
  }
  if (!this.url && isBrowser) {
    var protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    this.url = protocol + '://' + location.host
  }
  var self = this
  this.socket = new WebSocket(this.url)
  this.socket.onopen = function () {
    clearTimeout(self._opening)
    self.state = 'open'
    self.socket.onmessage = function (evt) {
      self.receive(evt.data)
    }
    self.init(function () {
      RpcEmitter.prototype.open.call(self)
      while (self._connectQueue.length) {
        var queued = self._connectQueue.shift()
        clearTimeout(queued[2])
        if (self.state === 'open') {
          RpcEmitter.prototype._dosend.call(self, queued[0], queued[1])
        }
      }
    })
  }
  this.socket.onclose = function () {
    clearTimeout(self._opening)
    if (self.state === 'closed') {
      return
    } else {
      RpcEmitter.prototype.closeRemote.call(self)
      self.state = 'closed'
    }
    if (self._connectQueue.length === 0 && Object.keys(self._subscriptions.remote).length === 0) {
      return
    }
    self._reopening = setTimeout(function () {
      self.open()
    }, self.reopenDelay)
  }
  this.socket.onerror = function (err) {
    if (self.listenerCount('error') > 1) {
      self.emit('error', err)
    }
  }
  if (this.openTimeout) {
    this._opening = setTimeout(function () {
      self.socket.close()
    }, this.openTimeout)
  }
}

RpcEventsWsClient.prototype.close = function () {
  clearTimeout(this._reopening)
  RpcEmitter.prototype.close.call(this)
  this.state = 'closed'
  if (this.socket) {
    this.socket.close()
  }
}

RpcEventsWsClient.prototype.init = function (cb) {
  // users may need to do authentication here
  cb()
}

RpcEventsWsClient.prototype.send = function (message) {
  this.socket.send(message)
}

RpcEventsWsClient.prototype._dosend = function (message, didOriginateLocally) {
  if (this.state === 'open') {
    RpcEmitter.prototype._dosend.call(this, message, didOriginateLocally)
    return
  }
  var self = this
  var timeout = null
  var cb = this._callbacks[message.id]
  if (cb) {
    var _cb = cb
    var cb = function (err) {
      self._connectQueue = self._connectQueue.filter(function (queued) {
        return queued[0] !== message
      })
      _cb.apply(null, arguments)
    }
    cb.timeout = _cb.timeout
    this._callbacks[message.id] = cb
  } else if (this.timeout) {
    timeout = setTimeout(function () {
      self._connectQueue = self._connectQueue.filter(function (queued) {
        return queued[0] !== message
      })
    }, this.timeout)
  }
  this._connectQueue.push([ message, didOriginateLocally, timeout ])
  if (this.state !== 'opening') {
    this.open()
  }
}
