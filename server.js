// server.js
const http = require("http");
const { WebSocketServer } = require("ws");
const next = require("next");
const { parse } = require("url");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

// Optional: log unhandled rejections instead of crash with ENOENT
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

app
  .prepare()
  .then(() => {
    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);

        // We only handle WebSocket for /api/realtime in the upgrade handler below.
        // For normal HTTP requests, just let Next.js handle everything.
        return handle(req, res, parsedUrl);
      } catch (err) {
        console.error("[http] request error:", err);
        res.statusCode = 500;
        res.end("Internal server error");
      }
    });

    // --- WebSocket server for /api/realtime --- //
    const wss = new WebSocketServer({ noServer: true });

    // In-memory map of connections by sessionId (for now, just echo-style behavior)
    const sessions = new Map();

    wss.on("connection", (ws, request, clientInfo) => {
      const { pathname, searchParams } = clientInfo;
      const sessionId = searchParams.get("sessionId") || "unknown";
      const connectionId = clientInfo.connectionId;

      console.log("[realtime] ws client connected", {
        pathname,
        sessionId,
        connectionId,
      });

      // Track sessions in memory (simple fan-out hook later if needed)
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, new Set());
      }
      sessions.get(sessionId).add(ws);

      // On open, send a welcome message
      const welcome = {
        type: "welcome",
        sessionId,
        payload: {
          connectionId,
          message: "Connected to /api/realtime via custom WebSocket server",
        },
      };
      ws.send(JSON.stringify(welcome));

      ws.on("message", (data) => {
        try {
          const text = data.toString();
          console.log("[realtime] raw message text =", text);

          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch (err) {
            console.error("[realtime] failed to parse JSON:", err);
            return;
          }

          const msg = {
            connectionId,
            sessionId: parsed.sessionId || sessionId,
            type: parsed.type,
            payload: parsed.payload ?? null,
          };

          console.log("[realtime] parsed message", msg);

          // Simple router for basic testing (ping/signal/client-event)
          if (msg.type === "ping") {
            const pong = {
              type: "server-event",
              sessionId: msg.sessionId,
              payload: { kind: "pong", ts: Date.now() },
            };
            ws.send(JSON.stringify(pong));
          } else if (msg.type === "signal") {
            console.log("[realtime] signal payload", msg.payload);
            const ack = {
              type: "server-event",
              sessionId: msg.sessionId,
              payload: { kind: "signal-ack", ts: Date.now() },
            };
            ws.send(JSON.stringify(ack));
          } else if (msg.type === "client-event") {
            console.log("[realtime] client-event payload", msg.payload);
            const ack = {
              type: "server-event",
              sessionId: msg.sessionId,
              payload: { kind: "client-event-ack", ts: Date.now() },
            };
            ws.send(JSON.stringify(ack));
          } else {
            console.log("[realtime] unknown message type:", msg.type);
          }
        } catch (err) {
          console.error("[realtime] message handler error:", err);
        }
      });

      ws.on("close", () => {
        console.log("[realtime] ws client disconnected", { sessionId, connectionId });
        const set = sessions.get(sessionId);
        if (set) {
          set.delete(ws);
          if (set.size === 0) {
            sessions.delete(sessionId);
          }
        }
      });

      ws.on("error", (err) => {
        console.error("[realtime] ws error:", err);
      });
    });

    // Upgrade HTTP → WebSocket for /api/realtime
    server.on("upgrade", (req, socket, head) => {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;

        // ✅ ONLY intercept /api/realtime
        if (pathname === "/api/realtime") {
          const searchParams = url.searchParams;
          const connectionId = cryptoRandomId();

          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req, {
              pathname,
              searchParams,
              connectionId,
            });
          });

          // We handled this upgrade, so return.
          return;
        }

        // ❗ For ALL OTHER upgrade paths (e.g. /_next/webpack-hmr),
        // DO NOTHING here and let Next.js's internal upgrade handler
        // take over. DO NOT destroy the socket.
        return;
      } catch (err) {
        console.error("[server] upgrade error:", err);
        try {
          socket.destroy();
        } catch {
          // ignore
        }
      }
    });

    const port = process.env.PORT || 3000;
    server.listen(port, () => {
      console.log(
        `> Custom Next.js server with WebSocket listening on http://localhost:${port}`
      );
    });
  })
  .catch((err) => {
    console.error("Error preparing Next.js app:", err);
    process.exit(1);
  });

// Simple random id helper for connectionId
function cryptoRandomId() {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}
