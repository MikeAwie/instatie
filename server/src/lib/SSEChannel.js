export default class SSEChannel {
  constructor(options) {
    this.options = Object.assign(
      {},
      {
        pingInterval: 3000,
        maxStreamDuration: 300000,
        clientRetryInterval: 1000,
        startId: 1,
        historySize: 100,
      },
      options,
    );

    this.nextID = this.options.startId;
    this.clients = new Set();
    this.messages = [];

    if (this.options.pingInterval) {
      this.pingTimer = setInterval(() => this.ping(), this.options.pingInterval);
    }
  }

  ping() {
    this.clients.forEach((client) => {
      client.res.write(':ping\n\n');
      client.res.flush();
    });
  }

  formatData(data) {
    if (typeof data === 'object') {
      return `data: ${JSON.stringify(data)}`;
    } else {
      return data
        ? data
            .split(/[\r\n]+/)
            .map((str) => `data: ${str}`)
            .join('\n')
        : '';
    }
  }

  publish(data, eventName) {
    const id = this.nextID;
    let output = `id: ${id}\n`;
    if (eventName) {
      output += `event: ${eventName}\n`;
    }
    output += `${this.formatData(data)}\n\n`;

    this.clients.forEach((client) => {
      client.res.write(output);
      client.res.flush();
    });

    this.messages.push(output);
    while (this.messages.length > this.options.historySize) {
      this.messages.shift();
    }
    this.nextID++;

    return id;
  }

  subscribe(req, res) {
    const client = { req, res };
    client.req.socket.setNoDelay(true);
    client.res.writeHead(200, {
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
      'Cache-Control':
        's-maxage=' +
        (Math.floor(this.options.maxStreamDuration / 1000) - 1) +
        '; max-age=0; stale-while-revalidate=0; stale-if-error=0',
      'X-Accel-Buffering': 'no',
    });
    let body = 'retry: ' + this.options.clientRetryInterval + '\n\n';

    const lastID = Number.parseInt(req.headers['last-event-id']);
    if (!Number.isNaN(lastID)) {
      const rewind = -(this.nextID - lastID - 1);
      this.messages.slice(rewind).forEach((output) => {
        body += output;
      });
    }

    client.res.write(body);
    client.res.flush();
    this.clients.add(client);

    setTimeout(() => {
      if (!client.res.finished) {
        this.unsubscribe(client);
      }
    }, this.options.maxStreamDuration);
    client.res.on('close', () => this.unsubscribe(client));
    return client;
  }

  unsubscribe(client) {
    client.res.end();
    this.clients.delete(client);
  }

  stop() {
    this.clients.forEach((client) => {
      client.req.destroy();
      client.res.end();
    });
  }

  listClients() {
    const rollupByIP = {};
    this.clients.forEach((client) => {
      const ip = client.req.connection.remoteAddress;
      if (!(ip in rollupByIP)) {
        rollupByIP[ip] = 0;
      }
      rollupByIP[ip]++;
    });
    return rollupByIP;
  }

  getSubscriberCount() {
    return this.clients.size;
  }
}
