import http from 'http';
import https from 'https';
import url from 'url';

export default async (link, json = true, method = 'GET', headers, postData) => {
  const isHttps = link.startsWith('https://');
  const lib = isHttps ? https : http;

  const { host, port, path } = url.parse(link);

  const params = {
    method,
    host,
    port: port || isHttps ? 443 : 80,
    path: path || '/',
    headers,
  };

  return new Promise((resolve, reject) => {
    const request = lib.request(params, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return reject(new Error(`Status Code: ${response.statusCode}`));
      }

      const data = [];

      response.on('data', (chunk) => {
        data.push(chunk);
      });

      response.on('end', () => {
        const result = Buffer.concat(data).toString();
        if (json) {
          resolve(JSON.parse(result));
        } else {
          resolve(result);
        }
      });
    });

    request.on('error', reject);

    if (postData) {
      request.write(postData);
    }

    request.end();
  });
};
