import { useState, useEffect, useRef, useCallback } from "react";

interface AlertEvent {
  id: number;
  plate_number: string;
  severity: string;
  camera_name: string;
  camera_lat: number;
  camera_lng: number;
  watchlist_reason: string;
  match_confidence: number;
  triggered_at: string;
}

export function useAlertWebSocket() {
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const url = `${proto}//${host}/api/v1/alerts/ws`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log("[WS] Connected to alert stream");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setAlerts((prev) => [data, ...prev].slice(0, 50));
        } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        console.log("[WS] Disconnected, reconnecting in 3s...");
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimer.current = setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  return { alerts, connected };
}
