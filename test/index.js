'use strict';

const Subpar = require('../');

const Code = require('code');
const lab = exports.lab = require('lab').script();
const expect = Code.expect;

const describe = lab.describe;
const it = lab.it;

describe('subpar', () => {

  it('throws when created with invalid options', (done) => {

    expect(() => {

      new Subpar('test', { random: 'nonsense' });
    }).to.throw();
    done();
  });

  it('defaults environment to NODE_ENV', (done) => {

    const server = new Subpar('test');
    const handler = function (request, reply) {

      return reply('hello');
    };
    server.register(handler);

    expect(server.environment).to.equal('test');
    done();
  });
});

describe('bind', () => {

  it('can bind values to handlers', () => {

    const server = new Subpar('test');
    server.bind({ test: { some: 'object' } });

    server.register(function (request, reply) {

      reply(this.test);
    });

    return server.initialize().then(() => {

      const payload = {
        subscription: 'test',
        message: {
          messageId: '1234',
          data: {},
          attributes: {}
        }
      };

      return server.server.inject({ method: 'post', url: '/', payload });
    }).then((res) => {

      expect(res.statusCode).to.equal(200);
      expect(res.result).to.equal({ some: 'object' });
    });
  });
});

describe('decorate', () => {

  it('can add decorators', () => {

    const server = new Subpar('test');
    server.decorate('request', 'test', () => ({ some: 'object' }));

    const handler = function (request, reply) {

      reply(request.test());
    };

    server.register(handler);

    return server.initialize().then(() => {

      const payload = {
        subscription: 'test',
        message: {
          messageId: '1234',
          data: {},
          attributes: {}
        }
      };

      return server.server.inject({ method: 'post', url: '/', payload });
    }).then((res) => {

      expect(res.statusCode).to.equal(200);
      expect(res.result).to.equal({ some: 'object' });
    });
  });
});

describe('handle', () => {

  it('can add a default handler', () => {

    const server = new Subpar('test');
    const handler = function (request, reply) {

      reply({ some: 'object' });
    };

    server.register({ handler });

    return server.initialize().then(() => {

      const payload = {
        subscription: 'test',
        message: {
          messageId: '1234',
          data: {},
          attributes: {}
        }
      };

      return server.server.inject({ method: 'post', url: '/', payload });
    }).then((res) => {

      expect(res.statusCode).to.equal(200);
      expect(res.result).to.equal({ some: 'object' });
    });
  });

  it('can add a default handler (shorthand)', () => {

    const server = new Subpar('test');
    const handler = function (request, reply) {

      reply({ some: 'object' });
    };

    server.register(handler);

    return server.initialize().then(() => {

      const payload = {
        subscription: 'test',
        message: {
          messageId: '1234',
          data: {},
          attributes: {}
        }
      };

      return server.server.inject({ method: 'post', url: '/', payload });
    }).then((res) => {

      expect(res.statusCode).to.equal(200);
      expect(res.result).to.equal({ some: 'object' });
    });
  });

  it('throws when trying to add a second default handler', (done) => {

    const server = new Subpar('test');
    const handler = function (request, reply) {

      reply({ some: 'object' });
    };

    server.register(handler);
    expect(() => {

      server.register(handler);
    }).to.throw();
    done();
  });

  it('throws when trying to add a second default handler (shorthand)', (done) => {

    const server = new Subpar('test');
    const handler = function (request, reply) {

      reply({ some: 'object' });
    };

    server.register({ handler });
    expect(() => {

      server.register({ handler });
    }).to.throw();
    done();
  });

  it('can add a handler with a condition', () => {

    const server = new Subpar('test');
    const handler = function (request, reply) {

      return reply('hello');
    };

    server.register({ handler, condition: { attributes: { type: 'test' } } });

    return server.initialize().then(() => {

      const payload = {
        subscription: 'test',
        message: {
          messageId: '1234',
          data: {},
          attributes: {
            type: 'test'
          }
        }
      };

      return server.server.inject({ method: 'post', url: '/', payload });
    }).then((res) => {

      expect(res.statusCode).to.equal(200);
      expect(res.result).to.equal('hello');
    });
  });

  it('responds with 204 when condition does not match and no fallback has been added', () => {

    const server = new Subpar('test');
    const handler = function (request, reply) {

      return reply('hello');
    };

    server.register({ handler, condition: { attributes: { type: 'test' } } });

    return server.initialize().then(() => {

      const payload = {
        subscription: 'test',
        message: {
          messageId: '1234',
          data: {},
          attributes: {
            type: 'unmatched'
          }
        }
      };

      return server.server.inject({ method: 'post', url: '/', payload });
    }).then((res) => {

      expect(res.statusCode).to.equal(204);
    });
  });

  it('falls back to default handler when condition does not match', () => {

    const server = new Subpar('test');
    const handler = function (request, reply) {

      return reply('hello');
    };

    const fallback = function (request, reply) {

      return reply('fallback');
    };

    server.register({ handler, condition: { attributes: { type: 'test' } } });
    server.register({ handler: fallback });

    return server.initialize().then(() => {

      const payload = {
        subscription: 'test',
        message: {
          messageId: '1234',
          data: {},
          attributes: {
            type: 'test'
          }
        }
      };

      return server.server.inject({ method: 'post', url: '/', payload });
    }).then((res) => {

      expect(res.statusCode).to.equal(200);
      expect(res.result).to.equal('hello');

      const payload = {
        subscription: 'test',
        message: {
          messageId: '1234',
          data: {},
          attributes: {
            type: 'different'
          }
        }
      };

      return server.server.inject({ method: 'post', url: '/', payload });
    }).then((res) => {

      expect(res.statusCode).to.equal(200);
      expect(res.result).to.equal('fallback');
    });
  });

  it('decodes base64 encoded json', () => {

    const server = new Subpar('test');
    const handler = function (request, reply) {

      expect(request.payload.data).to.equal({ encoded: 'json' });
      reply({ some: 'object' });
    };

    server.register({ handler });

    return server.initialize().then(() => {

      const payload = {
        subscription: 'test',
        message: {
          messageId: '1234',
          data: Buffer.from(JSON.stringify({ encoded: 'json' })).toString('base64'),
          attributes: {}
        }
      };

      return server.server.inject({ method: 'post', url: '/', payload });
    }).then((res) => {

      expect(res.statusCode).to.equal(200);
      expect(res.result).to.equal({ some: 'object' });
    });
  });

  it('refuses to parse invalid base64 encoded json', () => {

    const server = new Subpar('test');
    const handler = function (request, reply) {

      expect(request.payload.data).to.not.exist();
      reply({ some: 'object' });
    };

    server.register({ handler });

    return server.initialize().then(() => {

      const payload = {
        subscription: 'test',
        message: {
          messageId: '1234',
          data: Buffer.from('{"encoded":"json"').toString('base64'),
          attributes: {}
        }
      };

      return server.server.inject({ method: 'post', url: '/', payload });
    }).then((res) => {

      expect(res.statusCode).to.equal(200);
      expect(res.result).to.equal({ some: 'object' });
    });
  });

  it('refuses to coerce numbers as base64 encoded json', () => {

    const server = new Subpar('test');
    const handler = function (request, reply) {

      expect(request.payload.data).to.not.exist();
      reply({ some: 'object' });
    };

    server.register({ handler });

    return server.initialize().then(() => {

      const payload = {
        subscription: 'test',
        message: {
          messageId: '1234',
          data: 1234,
          attributes: {}
        }
      };

      return server.server.inject({ method: 'post', url: '/', payload });
    }).then((res) => {

      expect(res.statusCode).to.equal(200);
      expect(res.result).to.equal({ some: 'object' });
    });
  });

  it('fails to initialize when no handlers have been added', () => {

    const server = new Subpar('test');

    return server.initialize().then(() => {

      Code.fail('should not be reached');
    }).catch((err) => {

      expect(err).to.exist();
    });
  });

  it('can start the server on a real port', () => {

    const server = new Subpar('test');

    const handler = function (request, reply) {

      reply('hello');
    };

    server.register(handler);

    return server.start().then(() => {

      expect(server.server.info.port).to.be.a.number();
      expect(server.server.info.port).to.be.above(1000);
    });
  });
});
