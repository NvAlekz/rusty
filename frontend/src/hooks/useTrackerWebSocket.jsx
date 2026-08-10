import { useEffect, useState, useRef } from 'react';

// URL del WebSocket del backend. Configurable en el build vía VITE_WS_URL
// (p.ej. wss://rusty.trycloudflare.com/api/ws cuando el backend esté remoto).
const WS_URL =
  import.meta.env.VITE_WS_URL || 'ws://localhost:8000/api/ws';

/**
 * Hook para conectarse al WebSocket del backend y recibir
 * actualizaciones en tiempo real del estado del servidor.
 */
export function useTrackerWebSocket() {
  const [connected, setConnected] = useState(false);
  const [serverState, setServerState] = useState(null);
  const [trackerStatus, setTrackerStatus] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    let reconnectTimer = null;
    let shouldReconnect = true;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'server_state') {
            setServerState(message.payload);
          } else if (message.type === 'server_connect') {
            setServerState({
              server: message.payload.server,
              players: [],
              total_players: 0,
            });
          } else if (message.type === 'server_disconnect') {
            setServerState(null);
          } else if (message.type === 'tracker_status') {
            setTrackerStatus(message.payload);
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (shouldReconnect) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const requestRefresh = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send('refresh');
    }
  };

  return { connected, serverState, trackerStatus, requestRefresh };
}