import http from 'http';
import url from 'url';
import compression from 'compression';
import helmet from 'helmet';

const allowedMethods = ['GET', 'POST'];

const allowedOrigins = ['http://localhost:3000', 'http://instatie.ro', 'https://instatie.ro'];

const router = Object.assign({}, ...allowedMethods.map((method) => ({ [method]: {} })));

const logger = require('morgan')('tiny');

const applyCompression = compression();

const applyHelmetHeaders = helmet();

const done = (request, response, error) => {
  if (response.headersSent) return;
  let status;
  const headers = { ...(response.headers || {}), 'Content-Type': 'application/json' };
  let message;
  let stack;
  if (error) {
    if (typeof error.status === 'number' && error.status >= 400 && error.status < 600) {
      status = error.status;
    }

    if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600) {
      status = error.statusCode;
    }

    message = error.message;
    stack = error.stack;
  } else {
    status = 404;
    message = `Not found done - ${request.url}`;
  }
  response.writeHead(status || 500, headers);
  response.end(
    JSON.stringify({
      status: status || 500,
      message: message,
      stack: process.env.NODE_ENV === 'production' ? null : stack,
    }),
  );
  console.error(message);
  return;
};

const httpServer = http.createServer((request, response) => {
  logger(request, response, (error) => {
    if (error) return done(request, response, error);
    applyCompression(request, response, (error) => {
      if (error) return done(request, response, error);
      applyHelmetHeaders(request, response, (error) => {
        if (error) return done(request, response, error);
        const headers = {
          'Access-Control-Allow-Methods': allowedMethods.join(', ') + ', OPTIONS',
          'Access-Control-Max-Age': 86400,
        };

        const parsedUrl = url.parse(request.url, true);

        if (allowedOrigins.includes(request.headers.origin)) {
          headers['Access-Control-Allow-Origin'] = request.headers.origin;
        }

        const method = request.method;

        if (request.method === 'OPTIONS') {
          response.writeHead(204, headers);
          response.end();
          return;
        }

        const { pathname } = parsedUrl;

        if (
          !Object.values(router)
            .reduce((routes, method) => routes.concat(Object.keys(method)), [])
            .includes(pathname)
        ) {
          response.writeHead(404, { ...headers, 'Content-Type': 'text/plain' });
          response.end(`Not found - ${request.url}`);
          return;
        }

        const handler = router[method][pathname];

        if (!allowedMethods.includes(method) || !handler) {
          response.writeHead(405, { ...headers, 'Content-Type': 'text/plain' });
          response.end(`${method} is not allowed for this request.`);
          return;
        }

        const { query } = parsedUrl;

        let data = [];
        request.on('error', (error) => {
          return done(request, response, error);
        });
        request.on('data', (chunk) => {
          data.push(chunk);
        });
        request.on('end', async () => {
          if (data.length > 0) {
            data = JSON.parse(Buffer.concat(data).toString());
          }

          const [responseData = {}, statusCode = 200] = [await handler({ query, data })].flat();
          response.writeHead(statusCode, { ...headers, 'Content-Type': 'application/json' });
          response.end(JSON.stringify(responseData));

          done(request, response);
        });
      });
    });
  });
});

httpServer.on('error', (error) => {
  console.error('Error: ', error.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(error.stack);
  }
});

const server = {};

server.listen = (port, cb) => {
  httpServer.listen(port, cb);
};

Object.assign(
  server,
  ...allowedMethods.map((method) => ({
    [method.toLowerCase()]: (path, handler) => {
      router[method][path] = handler;
    },
  })),
);

export default () => server;
