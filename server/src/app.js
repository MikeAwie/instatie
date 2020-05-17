const server = require('./server');

const app = server();

app.get('/', ({ query, data }) => {
  return { ping: 'pong' };
});

module.exports = app;
