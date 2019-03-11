'use strict';

const test    = require('tape-promise').default(require('tape'));
const YoRedis = require('./index');

const redis   = new YoRedis();

test('ping', function(t) {
  return redis.call('ping')
    .then(function(reply) {
      t.equal(reply, 'PONG');
    });
});

test('unknown command', function(t) {
  return redis.call('foo')
    .then(t.fail)
    .catch(function(error) {
      t.assert(error, 'throws');
    });
});

test('connection error', function(t) {
  const otherRedis = new YoRedis({ url: 'redis://127.0.0.1:9876' });
  return otherRedis.call('ping')
    .then(t.fail)
    .catch(function(error) {
      t.assert(error, 'throws');
    });
});

test('reconfigure with Promise', function(t) {
  let times = 0;
  const otherRedis = new YoRedis(function() {
    times++;
    return Promise.resolve({ url: 'redis://127.0.0.1:6379' });
  });
  return otherRedis.call('ping')
    .then(function(reply) {
      t.equal(times, 1);
      t.equal(reply, 'PONG');
      otherRedis.end();
      return otherRedis.call('echo', 'FOO');
    })
    .then(function(reply) {
      t.equal(times, 2);
      t.equal(reply, 'FOO');
      otherRedis.end();
    });
});

test('multiple values in reply', function(t) {
  return redis.call('sadd', 'bar', '1', '2')
    .then(function() {
      return redis.call('smembers', 'bar');
    })
    .then(function(reply) {
      t.deepEqual(reply, [ '1', '2' ]);
    });
});

test('pipelining', function(t) {
  return redis.callMany([ [ 'ping' ], [ 'set', 'foo', 'bar' ], [ 'get', 'foo' ] ])
    .then(function(replies) {
      t.equal(replies[0], 'PONG');
      t.equal(replies[1], 'OK');
      t.equal(replies[2], 'bar');
    });
});

test('pipelining with error', async function(t) {
  try {
    await redis.callMany([ [ 'ping' ], [ 'set', 'foo' ], [ 'ping' ] ]);
    t.fail('Should have rejected the promise');
  } catch (error) {
    t.equal(error.message, `ERR wrong number of arguments for 'set' command`);
  }
});

test('return buffers', async function(t) {
  const redisWithBuffers = new YoRedis({ returnBuffers: true });

  try {
    await redisWithBuffers.call('set', 'foo', 'bar');
    const actual   = await redisWithBuffers.call('get', 'foo');
    const expected = Buffer.from('bar');
    t.equal(actual.compare(expected), 0);
  } finally {
    redisWithBuffers.end();
  }
});

test('auth', async function(t) {
  const redisWithAuth = new YoRedis({ url: 'redis://:s3cr3t@localhost:6379' });

  try {
    await redisWithAuth.call('get', 'foo');
    t.fail('Should have failed');
  } catch (error) {
    const actual   = error.message;
    const expected = 'ERR Client sent AUTH, but no password is set';
    t.equal(actual, expected);
  } finally {
    redisWithAuth.end();
  }
});

test.onFinish(function() {
  redis.end();
});
