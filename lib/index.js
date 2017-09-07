'use strict';

const EventEmitter = require('events').EventEmitter;
const Promoter = require('promoter');

class PubSubWorker extends EventEmitter {
  constructor(options = {}) {

    super();
    this._pubsub = Promoter(options.auth);
    this._handle = this._handle.bind(this);
    this._handleError = this._handleError.bind(this);

    this.options = options;
    this.logger = options.logger || { log: () => {}, error: () => {} };
  }

  async _handle(message) {

    this.emit('message', message);
    try {
      await this.handle({ id: message.id, timestamp: message.timestamp, data: this.options.raw ? message.data : JSON.parse(message.data), attributes: message.attributes });
      this.emit('done', message);
    }
    catch (err) {
      if (!this.options.maxRetries ||
          (message.attributes.retries &&
           message.attributes.retries >= this.options.maxRetries)) {

        this.emit('error', err);
        return;
      }

      this.emit('retry', message);
      await this.publisher.publish({ data: message.data, attributes: Object.assign(message.attributes, { retries: message.attributes.retries ? message.attributes.retries + 1 : 1 }) });
    }
    finally {
      this.emit('ack', message);
      await message.ack();
    }
  }

  _handleError(err) {

    this.emit('error', err);
    this.logger.error(err);
  }

  async start() {

    this.logger.log(`starting worker ${this.options.name} on topic ${this.options.topic}`);

    this.topic = this._pubsub.topic(this.options.topic);
    await this.topic.get({ gaxOpts: { autoCreate: true } });

    this.publisher = this.topic.publisher(this.options.publisher);

    this.subscription = this.topic.subscription(this.options.name, this.options.subscription);
    await this.subscription.get({ gaxOpts: { autoCreate: true } });

    this.subscription.on('message', this._handle);
    this.subscription.on('error', this._handleError);
  }

  async stop() {

    if (!this.subscription) {
      return;
    }

    this.logger.log('stopping worker');
    await this.subscription.close();
  }
}

module.exports = PubSubWorker;
