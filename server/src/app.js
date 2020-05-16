const server = require('./server');

const app = server();

app.get('/', ({ query, data }, callback) => {
  callback(200, { ping: 'pong' });
});

module.exports = app;
