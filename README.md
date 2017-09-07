## Subpar

### example

```js
const PubSubWorker = require('subpar');

class GitHubWorker extends PubSubWorker {
  handle(message) {

    console.log(message.attributes);
    console.log(message.data);
  }
}

const worker = new GitHubWorker({ topic: 'nodesecurity-github', name: 'nodesecurity-github-client' });
worker.start();
module.exports = worker;
```
