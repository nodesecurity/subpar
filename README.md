## Subpar

This module wraps [hapi](https://github.com/hapijs/hapi) to simplify its usage as a receiver of google's cloud pubsub push subscriptions.

### `new Subpar(name, [options])`

Create a new instance of `Subpar`. The `name` parameter is used as the service name in the logging plugin.

`options` is an optional configuration object and may contain:

- `path`: (string) the HTTP path the handler will listen on, defaults to `"/"`
- `environment`: (string) used to configure the logger, when set to `"production"` logging will go through [good-google-cloud](https://github.com/nodesecurity/good-google-cloud), when set to `"test"` logging will be disabled, when set to any other value logging will go to the console. Defaults to the value of `process.env.NODE_ENV` or `"development"` if unset.
- `connection`: (object) passed through to [hapi's server.connection() method](https://github.com/hapijs/hapi/blob/master/API.md#serverconnectionoptions)


### `subpar.bind(context)`

Passed through to [hapi's server.bind() method](https://github.com/hapijs/hapi/blob/master/API.md#serverbindcontext).


### `subpar.decorate(type, property, method, [options])`

Passed through to [hapi's server.decorate() method](https://github.com/hapijs/hapi/blob/master/API.md#serverdecoratetype-property-method-options).


### `subpar.register(options)`

`options` is an object that may contain:

- `handler`: (function) a standard [hapi handler](https://github.com/hapijs/hapi/blob/master/API.md#route-handler).
- `condition`: (object) optional object used to determine when a handler is called. May contain the following properties:
  - `data`:  (object or joi validator) value or values contained in the message data that must match for this handler to be called
  - `attributes`: (object or joi validator) value or values contained in the message attributes that must match for this handler to be called

Only *one* handler may be added without a condition since having no condition means that all valid payloads will be delivered to that handler. Multiple handlers may be added with conditions and the first matching handler will be called.

When adding a handler with no conditions, as a shortcut the handler function can be passed directly to the `register` method.


### `server.initialize()`

Finalize the routing table, register the logging plugins and initialize the underlying hapi server. Returns a promise.


### `server.start()`

Start the underlying hapi server, returns a promise.


## Example

```js
'use strict';

const Subpar = require('subpar');

const server = new Subpar('example');

// shortcut for catch all handler, you can also pass an object
// with a 'handler' property and omit the 'condition'
server.register(function (request, reply) {

  reply({ handler: 'fallback' });
});

server.register({
  handler: function (request, reply) {

    reply({ handler: 'create' });
  },
  condition: {
    attributes: {
      type: 'create'
    }
  }
});

server.register({
  handler: function (request, reply) {

    reply({ handler: 'update' });
  },
  condition: {
    attributes: {
      type: 'update'
    }
  }
});

server.start();
```

In the above server, messages published with a `"type"` attribute with a value of `"create"` will be delivered to the middle handler. Messages with a `"type"` of `"update"` will be delivered to the bottom handler. All other messages will be delivered to the top handler.
