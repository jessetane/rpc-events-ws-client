var tape = require('tape')
var WebSocket = require('uws')
var Emitter = require('events')
var Rpc = require('rpc-events')
var RpcEventsWsClient = require('./')

tape('open on demand unless outstanding call(s) timeout', function (t) {
  t.plan(7)
  var client = new RpcEventsWsClient({
    url: 'ws://127.0.0.1:7357',
    serialize: JSON.stringify,
    deserialize: JSON.parse,
    timeout: 10, // time to wait for a call response
    openTimeout: 10, // time to wait for underlying transport to open
    reopenDelay: 50 // time after unexpected close before attempting to reopen
  })
  client.open = function () {
    t.pass()
    RpcEventsWsClient.prototype.open.call(client)
  }
  client.call('hello', function (err) {
    t.ok(err)
    t.equal(err.message, 'Call timed out')
    var server = new WebSocket.Server({
      host: '127.0.0.1',
      port: 7357
    }, function (err) {
      t.error(err)
      client.call('hello', function (err, res) {
        t.error(err)
        t.equal(res, 'world')
        client.close()
        server.close()
        delete client.open
      })
    })
    server.on('connection', function (socket) {
      var c = new Rpc({
        send: socket.send.bind(socket),
        serialize: JSON.stringify,
        deserialize: JSON.parse
      })
      c.setInterface({
        hello: function (cb) {
          cb(null, 'world')
        }
      })
      socket.onmessage = function (evt) {
        c.receive(evt.data)
      }
    })
  })
})

tape('try to open on demand as long as call(s) have not timed out', function (t) {
  t.plan(5)
  var client = new RpcEventsWsClient({
    url: 'ws://127.0.0.1:7357',
    serialize: JSON.stringify,
    deserialize: JSON.parse,
    timeout: 50,
    openTimeout: 10,
    reopenDelay: 10
  })
  client.open = function () {
    t.pass()
    RpcEventsWsClient.prototype.open.call(client)
  }
  client.call('hello', function (err, res) {
    t.error(err)
    t.equal(res, 'world')
    client.close()
    server.close()
    delete client.open
  })
  var server = new WebSocket.Server({
    host: '127.0.0.1',
    port: 7357
  }, t.error)
  server.on('connection', function (socket) {
    var c = new Rpc({
      send: socket.send.bind(socket),
      serialize: JSON.stringify,
      deserialize: JSON.parse
    })
    c.setInterface({
      hello: function (cb) {
        cb(null, 'world')
      }
    })
    socket.onmessage = function (evt) {
      c.receive(evt.data)
    }
  })
})

tape('reestablishes subscriptions after connection fails', function (t) {
  t.plan(4)
  var server = serve()
  var client = new RpcEventsWsClient({
    url: 'ws://127.0.0.1:7357',
    serialize: JSON.stringify,
    deserialize: JSON.parse,
    timeout: 50,
    openTimeout: 10,
    reopenDelay: 10
  })
  var i = 0
  client.subscribe('event', function (evt) {
    t.equal(evt, 42)
    if (i === 0) {
      server.close()
      server = serve()
      setTimeout(function () {
        server.iface.emit('event', 42)
      }, 50)
    } else if (i === 1) {
      client.close()
      server.close()
    }
    i++
  }, t.fail)
  setTimeout(function () {
    server.iface.emit('event', 42)
  }, 50)
  function serve () {
    var iface = new Emitter()
    var server = new WebSocket.Server({
      host: '127.0.0.1',
      port: 7357
    }, t.error)
    server.on('connection', function (socket) {
      var c = new Rpc({
        send: socket.send.bind(socket),
        serialize: JSON.stringify,
        deserialize: JSON.parse
      })
      c.setInterface(iface)
      socket.onmessage = function (evt) {
        c.receive(evt.data)
      }
    })
    server.iface = iface
    return server
  }
})
