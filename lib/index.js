'use strict';

const Hapi = require('hapi');
const Hoek = require('hoek');
const BaseJoi = require('joi');
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

const internals = {};
internals.schema = Joi.object({
  port: Joi.number().integer().min(1).max(65536).default(8000),
  bind: Joi.object().unknown().default({}),
  decorate: Joi.array().items(Joi.object({
    type: Joi.string().valid('request', 'reply', 'server').required(),
    property: Joi.string().required(),
    method: Joi.func().required(),
    options: Joi.when(Joi.ref('type'), { is: 'request', then: Joi.object({ apply: Joi.boolean() }), otherwise: Joi.forbidden() })
  })).single().default([]),
  environment: Joi.string().default(process.env.NODE_ENV || 'development')
});

internals.defaults = {
  method: 'POST',
  path: '/',
  strict: false
};

class Subpar {
  constructor(name, opts = {}) {

    this.name = name;

    const validated = Joi.validate(opts, internals.schema);
    if (validated.error) {
      throw validated.error;
    }

    const options = validated.value;
    this.environment = options.environment;

    this.server = new Hapi.Server();
    this.server.connection({ port: options.port });
    this.server.bind(options.bind);

    for (const decoration of options.decorate) {
      this.server.decorate(decoration.type, decoration.property, decoration.method, decoration.options);
    }
  }

  handle(opts) {

    const options = Hoek.applyToDefaults(internals.defaults, opts);

    this.server.route({
      method: options.method,
      path: options.path,
      handler: options.handler,
      config: {
        validate: {
          payload: {
            message: Joi.object({
              messageId: Joi.string().required(),
              data: Joi.base64Object().keys(options.data).unknown(!options.strict).required(),
              attributes: Joi.object().keys(options.attributes).unknown(!options.strict),
            }),
            subscription: Joi.string().required()
          },
          failAction: function (request, reply, source, error) {

            request.log(['error'], error.stack);
            return reply();
          }
        }
      }
    });
  }

  initialize() {

    this.table = this.server.connections[0].table();
    if (!this.table.length) {
      return Promise.reject(new Error('No handlers added, unable to start'));
    }

    const reporter = [{
      module: 'good-squeeze',
      name: 'Squeeze',
      args: [{ request: '*', response: '*', log: '*', error: '*' }]
    }];

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

      const handlers = this.table.map((route) => {

        return `${route.method.toUpperCase()} ${route.path}`;
      }).join(', ');

      this.server.log(['info'], `Started function '${this.name}' in ${this.production ? 'production' : 'development'} mode on port ${this.server.info.port} with handlers for: ${handlers}`);
    });
  }
}

module.exports = Subpar;
