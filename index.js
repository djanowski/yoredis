'use strict';

const hiredis = require('hiredis');
const URL     = require('url');

const reader  = new hiredis.Reader();

class YoRedis {
  constructor(config) {
    if (config instanceof Function)
      this.config = config;
    else
      this.config = function() { return config || {} };
  }

  connect() {
    if (this.socket)
      return Promise.resolve(this.socket);
    else {
      return Promise.resolve(this.config())
        .then(config => {
          const url   = URL.parse(
            config.url || process.env.REDIS_URL || 'redis://127.0.0.1:6379'
          );
          this.socket = hiredis.createConnection(url.port, url.hostname);
          this.socket
            .on('reply', data => {
              if (data instanceof Error)
                this._operations.shift()[1](data);
              else
                this._operations.shift()[0](data);
            })
            .on('error', error => {
              this._operations.shift()[1](error);
            });
          this._operations = [];
        });
    }
  }

  call() {
    return this.connect()
      .then(() => {
        return new Promise((resolve, reject) => {
          this._operations.push([ resolve, reject ]);
          this.socket.write.apply(this.socket, arguments);
        });
      });
  }

  end() {
    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }
  }
}

module.exports = YoRedis;
