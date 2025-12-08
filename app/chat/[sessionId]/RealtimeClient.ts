"use client";

import { useEffect, useRef } from "react";

type RealtimeClientProps = {
  sessionId: string;
  onServerEvent?: (event: unknown) => void;
};

export function RealtimeClient({ sessionId, onServerEvent }: RealtimeClientProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      console.warn("[RealtimeClient] Missing sessionId, not connecting.");
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/realtime?sessionId=${encodeURIComponent(
      sessionId,
    )}`;

    console.log("[RealtimeClient] connecting to", url);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      hasOpenedRef.current = true;
      console.log("[RealtimeClient] open");
      ws.send(JSON.stringify({ type: "ping", sessionId }));
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        console.log("[RealtimeClient] message (parsed):", data);
        onServerEvent?.(data);
      } catch {
        console.log("[RealtimeClient] message (raw):", ev.data);
      }
    };

    ws.onerror = (err) => {
      // Ignore early errors before we ever successfully opened a socket.
      if (!hasOpenedRef.current) {
        console.debug("[RealtimeClient] early error (dev double-effect), ignored.");
        return;
      }
      console.error("[RealtimeClient] error:", err);
    };

    ws.onclose = (ev) => {
      // Ignore the first dev-mode cleanup close before open.
      if (!hasOpenedRef.current) {
        console.debug(
          "[RealtimeClient] early close before open (dev double-effect), ignored.",
        );
        return;
      }
      console.log(
        "[RealtimeClient] closed:",
        ev.code,
        ev.reason || "(no reason)",
      );
    };

    return () => {
      console.log("[RealtimeClient] cleanup: closing socket");
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      } catch {
        // ignore
      }
    };
  }, [sessionId, onServerEvent]);

  return null;
}
