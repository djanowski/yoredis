'use strict';

const hiredis = require('hiredis');
const Net     = require('net');
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
          this.socket = Net.createConnection(url.port, url.hostname);
          this.socket
            .on('data', data => {
              const operation = this._operations.shift();

              reader.feed(data);

              let replies = [];
              let error;

              while (true) {
                const reply = reader.get();

                if (reply === undefined)
                  break;
                else if (reply instanceof Error)
                  error = reply;

                replies.push(reply);
              }

              const pipelineSize = operation[0];
              const resolve      = operation[1];
              const reject       = operation[2];

              if (error)
                reject(error);
              else if (pipelineSize === 0)
                resolve(replies[0]);
              else
                resolve(replies);
            })
            .on('error', error => {
              this._operations.shift()[2](error);
            });

          this._operations = [];
        });
    }
  }

  call() {
    return this.connect()
      .then(() => {
        return new Promise((resolve, reject) => {
          this._operations.push([ 0, resolve, reject ]);
          const respArray = createCommand([ Array.prototype.slice.call(arguments, 0) ]);
          this.socket.write(respArray);
        });
      });
  }

  callMany(commands) {
    return this.connect()
      .then(() => {
        return new Promise((resolve, reject) => {
          this._operations.push([ commands.length, resolve, reject ]);
          const respArray = createCommand(commands);
          this.socket.write(respArray);
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


// -- RESP --

const bufStar   = new Buffer('*', 'ascii');
const bufDollar = new Buffer('$', 'ascii');
const bufCrlf   = new Buffer('\r\n', 'ascii');


function createCommand(commands) {
  const respArrays = commands.map(toRESPArray);
  const buffer     = Buffer.concat([ ... respArrays, bufCrlf ]);
  return buffer;
}


function toRESPArray(command) {
  const respStrings = command.map(toRESPBulkString);
  const stringCount = new Buffer(String(respStrings.length), 'ascii');
  const respArray   = Buffer.concat([
    bufStar, stringCount, bufCrlf, ... respStrings
  ]);
  return respArray;
}


function toRESPBulkString(string) {
  const asciiString    = new Buffer(string, 'ascii');
  const byteLength     = new Buffer(String(asciiString.length), 'ascii');
  const totalLength    = bufDollar.length + byteLength.length + bufCrlf.length + asciiString.length + bufCrlf.length;
  const respBulkString = Buffer.concat([
    bufDollar, byteLength, bufCrlf, asciiString, bufCrlf
  ], totalLength);
  return respBulkString;
}


module.exports = YoRedis;
