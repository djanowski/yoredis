YoRedis
=======

A minimalistic Redis client using modern Node.js.


Motivation
==========

The goal is to write a minimal Redis client that:

- Targets modern versions of Node.js: LTS and stable.
- Uses Promises from the beginning, not just as an afterthought.
- Allows async configuration which can accommodate modern credential stores
  such as [Vault][vault].


Usage
=====

Basic usage:

```node
const YoRedis = require('yoredis');

const redis = new YoRedis({ url: 'redis://127.0.0.1:6379' });

redis.call('ping')
  .then(function(reply) {
    console.log(reply);
  });
```

With dynamic, async configuration using [Vaulted][vaulted]:

```node
const redis = new YoRedis(function() {
  return vault.read({ id: 'redis/production' })
    .then(function(secret) {
      return {
        url: secret.url
      };
    });
});

redis.call('ping')
  .then(function(reply) {
    console.log(reply);
  });
```

Pipelining
----------

```node
redis.callMany([ [ 'ping' ], [ 'set', 'foo', 'bar' ], [ 'get', 'foo' ] ])
  .then(function(replies) {
    // replies is:
    // [
    //   'PONG',
    //   'OK',
    //   'bar'
    // ]
  })

```


Roadmap
=======

- Support streams.


[vault]:   https://www.vaultproject.io
[vaulted]: https://github.com/chiefy/vaulted
