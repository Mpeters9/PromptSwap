// server.js
// Custom Node.js server that:
// - Runs Next.js dev/production server
// - Hosts a WebSocket server at /api/realtime using `ws`

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

// Next.js exposes an upgrade handler for its own WebSockets (HMR, etc.)
let nextUpgradeHandler = null;

app.prepare().then(() => {
  if (typeof app.getUpgradeHandler === 'function') {
    nextUpgradeHandler = app.getUpgradeHandler();
  }

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || '/', true);
    handle(req, res, parsedUrl);
  });

  // WebSocket server for /api/realtime
  const wss = new WebSocketServer({ noServer: true });

  /**
   * Basic structured protocol:
   * { type: "ping" | "signal" | "client-event" | ..., sessionId?: string, payload?: any }
   */
  wss.on('connection', (ws, request) => {
    const { pathname, query } = parse(request.url || '/', true);
    const sessionId = query?.sessionId;
    const connectionId = randomUUID();

    console.log('[realtime] ws client connected', {
      pathname,
      sessionId,
      connectionId,
    });

    // Send welcome
    ws.send(
      JSON.stringify({
        type: 'welcome',
        sessionId,
        payload: {
          connectionId,
          message: 'Connected to /api/realtime via custom WebSocket server',
        },
      })
    );

    ws.on('message', (data) => {
      let text = '';

      if (Buffer.isBuffer(data)) {
        text = data.toString('utf8');
      } else if (typeof data === 'string') {
        text = data;
      } else {
        text = String(data);
      }

      console.log('[realtime] raw message text =', text);

      let msg;
      try {
        msg = JSON.parse(text);
      } catch (err) {
        console.warn('[realtime] invalid JSON', err);
        ws.send(
          JSON.stringify({
            type: 'error',
            sessionId,
            payload: { error: 'INVALID_JSON' },
          })
        );
        return;
      }

      if (!msg || typeof msg.type !== 'string') {
        console.warn('[realtime] missing type on message');
        ws.send(
          JSON.stringify({
            type: 'error',
            sessionId,
            payload: { error: 'INVALID_MESSAGE' },
          })
        );
        return;
      }

      const effectiveSessionId = msg.sessionId || sessionId;

      console.log('[realtime] parsed message', {
        connectionId,
        sessionId: effectiveSessionId,
        type: msg.type,
      });

      switch (msg.type) {
        case 'ping': {
          ws.send(
            JSON.stringify({
              type: 'server-event',
              sessionId: effectiveSessionId,
              payload: { kind: 'pong', ts: Date.now() },
            })
          );
          break;
        }

        case 'signal': {
          // Placeholder for WebRTC signaling (SDP, ICE, etc.)
          console.log('[realtime] signal payload', msg.payload);
          ws.send(
            JSON.stringify({
              type: 'server-event',
              sessionId: effectiveSessionId,
              payload: { kind: 'signal-ack', ts: Date.now() },
            })
          );
          break;
        }

        case 'client-event': {
          console.log('[realtime] client-event payload', msg.payload);
          ws.send(
            JSON.stringify({
              type: 'server-event',
              sessionId: effectiveSessionId,
              payload: { kind: 'client-event-ack', ts: Date.now() },
            })
          );
          break;
        }

        default: {
          console.warn('[realtime] unknown type', msg.type);
          ws.send(
            JSON.stringify({
              type: 'error',
              sessionId: effectiveSessionId,
              payload: {
                error: 'UNKNOWN_TYPE',
                detail: msg.type,
              },
            })
          );
        }
      }
    });

    ws.on('close', (code, reason) => {
      console.log('[realtime] ws closed', {
        connectionId,
        sessionId,
        code,
        reason: reason?.toString(),
      });
    });

    ws.on('error', (err) => {
      console.error('[realtime] ws error', { connectionId, sessionId }, err);
    });
  });

  // Handle HTTP → WebSocket upgrades
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url || '/', true);

    // Let Next handle its own dev WebSocket (HMR)
    if (pathname === '/_next/webpack-hmr' && nextUpgradeHandler) {
      return nextUpgradeHandler(req, socket, head);
    }

    // Our custom realtime WebSocket endpoint
    if (pathname === '/api/realtime') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
      return;
    }

    // Anything else: reject upgrade
    socket.destroy();
  });

  server.listen(port, () => {
    console.log(
      `> Custom Next.js server with WebSocket listening on http://localhost:${port}`
    );
  });
});
