import http from 'http';
import url from 'url';
import compression from 'compression';
import helmet from 'helmet';
import { json2csv } from 'json-2-csv';

const allowedMethods = ['GET'];

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
        response.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', ') + ', OPTIONS');
        response.setHeader('Access-Control-Max-Age', 86400);
        response.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        response.setHeader('Access-Control-Allow-Origin', process.env.ORIGIN);

        const parsedUrl = url.parse(request.url, true);

        const method = request.method;

        if (request.method === 'OPTIONS') {
          response.writeHead(204);
          response.end();
          return;
        }

        const { pathname } = parsedUrl;

        if (
          !Object.values(router)
            .reduce((routes, method) => routes.concat(Object.keys(method)), [])
            .includes(pathname)
        ) {
          response.writeHead(404, { 'Content-Type': 'text/plain' });
          response.end(`Not found - ${request.url}`);
          return;
        }

        const handler = router[method][pathname];

        if (!allowedMethods.includes(method) || !handler) {
          response.writeHead(405, { 'Content-Type': 'text/plain' });
          response.end(`${method} is not allowed for this request.`);
          return;
        }

        const { query } = parsedUrl;

        let body = [];
        request.on('error', (error) => {
          return done(request, response, error);
        });
        request.on('data', (chunk) => {
          body.push(chunk);
        });
        request.on('end', async () => {
          if (body.length > 0) {
            body = JSON.parse(Buffer.concat(body).toString());
          }

          try {
            request.query = query;
            request.body = body;
            response.send = (data, statusCode = 200) => {
              response.writeHead(statusCode, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify(data));
            };
            response.sendCSV = (data) => {
              response.setHeader(
                'Content-disposition',
                `'attachment; filename=${pathname.substring(pathname.lastIndexOf('/') + 1, pathname.length)}.csv`,
              );
              response.writeHead(200, {
                'Content-Type': 'text/csv',
              });
              json2csv(data, (err, csv) => {
                if (err) throw err;
                response.end(csv);
              });
            };
            await handler(request, response);
          } catch (err) {
            return done(request, response, err);
          }

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
