## subpar

This module wraps [hapi](https://github.com/hapijs/hapi) to simplify its usage as a receiver of google's cloud pubsub push subscriptions.

### usage

```js
'use strict';

const Subpar = require('subpar');

const subscription = new Subpar('worker-name');
subscription.handle({
  handler: function (request, reply) {

    // do something with request.payload.message.attributes and request.payload.message.data
    reply();
  }
});

subscription.start();
```
