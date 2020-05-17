import app from './app';

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});

process.on('uncaughtException', (error) => {
  console.error('uncaughtException: ', error.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(error.stack);
  }
});
