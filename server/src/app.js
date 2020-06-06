import server from './lib/server';

const app = server();

app.get('/', (req, res) => res.send('In Statie API'));

export default app;
