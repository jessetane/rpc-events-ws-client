# rpc-events-ws-client
[rpc-events](https://github.com/jessetane/rpc-engine) with a websocket transport.

## Why
Provisioning and babysitting rpc transports can be automated.

## How
``` javascript
var RpcWs = require('rpc-events-ws-client')

var server = new RpcWs({
  url: 'wss://www.example.com',
  serialize: JSON.stringify,
  deserialize: JSON.parse,
  timeout: 2500, // time to wait for a call response
  openTimeout: 2500, // time to wait for underlying transport to open before reopening
  reopenDelay: 5000 // time after unexpected close before attempting to reopen
})

server.call('some-method', err => {
  if (err) throw err
  // a transport was automatically set up for us
  // if it ever goes down, another will be transparently
  // provisioned, but only if some subscriptions or calls are outstanding
})
```

## License
MIT
