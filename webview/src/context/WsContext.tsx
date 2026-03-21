import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Action } from '../store/reducer';
import type { ServerMessage, ClientMessage, DpSearchResultMsg } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WsStatus = 'disconnected' | 'connecting' | 'connected';

interface WsContextValue {
  status: WsStatus;
  connect: (host: string, port: number) => void;
  disconnect: () => void;
  subscribe: (id: string, dps: string[]) => void;
  unsubscribe: (id: string) => void;
  search: (query: string) => Promise<string[]>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const WsContext = createContext<WsContextValue | null>(null);

export function useWs(): WsContextValue {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error('useWs must be used inside WsContextProvider');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface Props {
  dispatch: React.Dispatch<Action>;
  children: React.ReactNode;
}

export function WsContextProvider({ dispatch, children }: Props) {
  const [status, setStatus] = useState<WsStatus>('disconnected');

  // Refs so callbacks always see the latest WebSocket instance
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef<number>(1000); // ms
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef<boolean>(false);
  const hostRef = useRef<string>('localhost');
  const portRef = useRef<number>(4712);

  // Pending dpSearch promises: id → { resolve, reject }
  const pendingSearches = useRef<Map<string, { resolve: (dps: string[]) => void; reject: (err: Error) => void }>>(new Map());

  // ── Helpers ────────────────────────────────────────────────────────────────

  const sendRaw = useCallback((msg: ClientMessage): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  // ── Core connect logic ─────────────────────────────────────────────────────

  const connectInternal = useCallback((host: string, port: number) => {
    const url = `ws://${host}:${port}`;
    console.log(`[WsContext] Connecting to ${url}`);
    setStatus('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WsContext] Connected');
      backoffRef.current = 1000; // reset backoff
      setStatus('connected');
    };

    ws.onmessage = (event: MessageEvent) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        console.error('[WsContext] Invalid JSON', event.data);
        return;
      }

      switch (msg.type) {
        case 'update':
          dispatch({
            type: 'UPDATE_VALUE',
            dp: msg.dp,
            value: msg.value,
            ts: msg.ts,
            quality: msg.quality,
          });
          break;

        case 'dpSearchResult': {
          const pending = pendingSearches.current.get(msg.id);
          if (pending) {
            pending.resolve((msg as DpSearchResultMsg).dps);
            pendingSearches.current.delete(msg.id);
          }
          break;
        }

        case 'error': {
          const pending = pendingSearches.current.get(msg.id);
          if (pending) {
            pending.reject(new Error(msg.message));
            pendingSearches.current.delete(msg.id);
          }
          console.error(`[WsContext] Server error (id=${msg.id}):`, msg.message);
          break;
        }

        case 'subscribed':
          console.log(`[WsContext] Subscribed: ${msg.id}`);
          break;
      }
    };

    ws.onclose = () => {
      console.log('[WsContext] Disconnected');
      setStatus('disconnected');
      wsRef.current = null;

      // Reject all pending searches
      pendingSearches.current.forEach((p) => p.reject(new Error('WebSocket closed')));
      pendingSearches.current.clear();

      if (!intentionalCloseRef.current) {
        // Exponential backoff reconnect
        const delay = backoffRef.current;
        backoffRef.current = Math.min(backoffRef.current * 2, 10_000);
        console.log(`[WsContext] Reconnecting in ${delay}ms…`);
        reconnectTimerRef.current = setTimeout(() => {
          if (!intentionalCloseRef.current) {
            connectInternal(hostRef.current, portRef.current);
          }
        }, delay);
      }
    };

    ws.onerror = (err) => {
      console.error('[WsContext] WebSocket error', err);
    };
  }, [dispatch]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const connect = useCallback((host: string, port: number) => {
    intentionalCloseRef.current = false;
    hostRef.current = host;
    portRef.current = port;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    connectInternal(host, port);
  }, [connectInternal]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  const subscribe = useCallback((id: string, dps: string[]) => {
    sendRaw({ type: 'subscribe', id, dps });
  }, [sendRaw]);

  const unsubscribe = useCallback((id: string) => {
    sendRaw({ type: 'unsubscribe', id });
  }, [sendRaw]);

  const search = useCallback((query: string): Promise<string[]> => {
    const id = `search-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise<string[]>((resolve, reject) => {
      if (!sendRaw({ type: 'dpSearch', id, query })) {
        reject(new Error('Not connected'));
        return;
      }
      // Time out after 10s
      const timer = setTimeout(() => {
        pendingSearches.current.delete(id);
        reject(new Error('dpSearch timeout'));
      }, 10_000);

      pendingSearches.current.set(id, {
        resolve: (dps) => { clearTimeout(timer); resolve(dps); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });
    });
  }, [sendRaw]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  return (
    <WsContext.Provider value={{ status, connect, disconnect, subscribe, unsubscribe, search }}>
      {children}
    </WsContext.Provider>
  );
}
