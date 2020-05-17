import server from './server';

const app = server();

app.get('/', ({ query, data }) => {
  return { ping: 'pong' };
});

export default app;
