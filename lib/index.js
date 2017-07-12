'use strict';

const Doodler = require('doodler');
Doodler.start();

const Hapi = require('hapi');
const Hoek = require('hoek');
const BaseJoi = require('joi');
const Path = require('path');

const Utils = require('./utils');

const Joi = BaseJoi.extend({
  name: 'base64Object',
  base: BaseJoi.object(),
  language: {
    invalid: 'Invalid input received, must be an object or a base64 encoded object'
  },
  coerce: function (value, state, options) {

    if (typeof value === 'object' &&
        value !== null) {

      return value;
    }

    if (typeof value !== 'string') {
      return this.createError('base64Object.invalid', null, state, options);
    }

    try {
      return JSON.parse(Buffer.from(value, 'base64'));
    }
    catch (err) {
      return this.createError('base64Object.invalid', null, state, options);
    }
  }
});

// Coverage disabled so we don't have to manually clear the require cache
// in order to test setting a default in Joi
// $lab:coverage:off$
const internals = {};
internals.schema = Joi.object({
  path: Joi.string().default('/'),
  connection: Joi.object().default(),
  environment: Joi.string().default(process.env.NODE_ENV || 'development')
});
// $lab:coverage:on$


internals.optionsSchema = Joi.object({
  handler: Joi.func(),
  condition: Joi.object({
    data: Joi.object(),
    attributes: Joi.object()
  }).default({})
});

class Subpar {
  constructor(name, opts = {}) {

    this.name = name;

    const validated = Joi.validate(opts, internals.schema);
    if (validated.error) {
      throw validated.error;
    }

    const options = validated.value;
    this.environment = options.environment;
    this.path = options.path;

    this.server = new Hapi.Server();
    this.server.connection(options.connection);

    this.server.bind({ doodler: Doodler });

    this.counter = 0;
    this.handlers = [];
    this._handler = Joi.number().integer();
    this.validator = Joi.object({
      subscription: Joi.string().required(),
      id: Joi.default(Joi.ref('message.messageId')),
      data: Joi.default(Joi.ref('message.data')),
      attributes: Joi.default(Joi.ref('message.attributes')),
      message: Joi.object({
        messageId: Joi.string().required(),
        message_id: Joi.string(),
        publish_time: Joi.date(),
        publishTime: Joi.date(),
        data: Joi.base64Object().default({}).required(),
        attributes: Joi.object().default({}).required()
      }).required()
    });
  }

  bind() {

    return this.server.bind.apply(this.server, arguments);
  }

  decorate() {

    return this.server.decorate.apply(this.server, arguments);
  }

  register(options) {

    if (typeof options === 'function') {
      options = { handler: options };
    }

    Joi.assert(options, internals.optionsSchema, 'Invalid options');
    options = internals.optionsSchema.validate(options).value;

    if (Object.keys(options.condition).length === 0) {
      if (this.catchall) {
        throw new Error('A catch all handler has already been added');
      }

      this.catchall = options.handler;
      return;
    }

    const keys = Utils.deepKeys(options.condition);
    for (const key of keys) {
      this._handler = this._handler.when(Joi.ref(key), { is: Hoek.reach(options.condition, key), then: Joi.default(this.counter) });
    }

    const extender = Joi.object({ message: options.condition });
    this.validator = this.validator.concat(extender);

    this.handlers.push(options.handler);
    this.counter++;
  }

  initialize() {

    if (!this.handlers.length &&
        !this.catchall) {

      return Promise.reject(new Error('No handlers added, unable to start'));
    }

    this.validator = this.validator.concat(Joi.object({ handler: this._handler }));

    const self = this;
    this.server.route({
      method: 'GET',
      path: `${Path.join(this.path, '/healthcheck')}`,
      handler: function (request, reply) {

        return reply({ alive: true });
      }
    });

    this.server.route({
      method: 'POST',
      path: this.path,
      handler: function (request, reply) {

        let handler;
        if (typeof request.payload.handler === 'undefined') {
          handler = self.catchall.bind(this);
        }
        else {
          handler = self.handlers[request.payload.handler].bind(this);
        }

        return handler(request, reply);
      },
      config: {
        validate: {
          payload: this.validator,
          failAction: function (request, reply, source, error) {

            if (self.catchall) {
              return self.catchall(request, reply);
            }

            request.log(['error'], error.stack);
            return reply().code(204);
          }
        }
      }
    });

    const reporter = [{
      module: 'good-squeeze',
      name: 'Squeeze',
      args: [{ request: '*', response: '*', log: '*', error: '*' }]
    }];

    // Coverage disabled so we don't have to mock the logger setup
    // $lab:coverage:off$
    if (this.environment === 'production') {
      reporter.push({
        module: 'good-google-cloud',
        name: 'Logger',
        args: [{ name: this.name }]
      });
    }
    else if (this.environment !== 'test') {
      reporter.push({
        module: 'good-console'
      }, 'stdout');
    }
    // $lab:coverage:on$

    return this.server.register([{
      register: require('good-google-cloud')
    }, {
      register: require('good'),
      options: {
        reporters: {
          logger: reporter
        }
      }
    }]).then(() => {

      return this.server.initialize();
    });
  }

  start() {

    return this.initialize().then(() => {

      return this.server.start();
    }).then(() => {

      // Coverage disabled because of the ternary and environmental shenanigans
      // $lab:coverage:off$
      this.server.log(['info'], `Started function '${this.name}' in ${this.environment || 'development'} mode on port ${this.server.info.port} with handler for: POST ${this.path}`);
      // $lab:coverage:on$
    });
  }
}

module.exports = Subpar;
