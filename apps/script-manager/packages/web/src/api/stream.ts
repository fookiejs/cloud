import type { ServerMessage } from '../types.js';
import { getAccessToken, isCloudHost } from '@/lib/auth';

export type StreamListener = (msg: ServerMessage) => void;

export interface Stream {
  subscribe(listener: StreamListener): () => void;
  close(): void;
}

export function connectStream(): Stream {
  const listeners = new Set<StreamListener>();
  let ws: WebSocket | null = null;
  let closed = false;
  let reconnectTimer: number | null = null;

  function open(): void {
    let proto = 'ws';
    if (window.location.protocol === 'https:') {
      proto = 'wss';
    }
    const url = new URL(`${proto}://${window.location.host}/api/v1/stream`);
    const token = isCloudHost() ? getAccessToken() : null;
    const socket =
      token !== null
        ? new WebSocket(url.toString(), ['bearer', token])
        : new WebSocket(url.toString());
    ws = socket;
    socket.onmessage = (ev: MessageEvent<string>) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(ev.data) as unknown;
      } catch (_e: unknown) {
        return;
      }
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }
      const rec = parsed as Record<string, unknown>;
      if (rec['type'] === 'agent.status') {
        window.dispatchEvent(
          new CustomEvent('lotaru:agent', {
            detail: {
              online: rec['online'] === true,
              info: (rec['info'] as { hostname: string; version: string; connectedAt: number } | null) ?? null,
            },
          }),
        );
        return;
      }
      if (rec['type'] === 'agent.welcome') {
        return;
      }
      const msg = parsed as ServerMessage;
      for (const l of listeners) {
        l(msg);
      }
    };
    socket.onclose = () => {
      if (closed) {
        return;
      }
      reconnectTimer = window.setTimeout(open, 1000);
    };
    socket.onerror = () => {
      socket.close();
    };
  }

  open();

  return {
    subscribe(listener: StreamListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close(): void {
      closed = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (ws !== null) {
        ws.close();
      }
    },
  };
}
