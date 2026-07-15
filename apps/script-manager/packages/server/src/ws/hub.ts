import type { WebSocket } from 'ws';
import type { EventBus } from '../events/bus.js';
import type { Orchestrator } from '../orchestrator.js';
import type { ServerMessage } from '../types.js';

export interface Hub {
  attach(ws: WebSocket): void;
}

export function createHub(bus: EventBus, orch: Orchestrator): Hub {
  const clients = new Set<WebSocket>();

  bus.subscribe((msg: ServerMessage) => {
    const text = JSON.stringify(msg);
    for (const c of clients) {
      if (c.readyState === 1) {
        c.send(text);
      }
    }
  });

  return {
    attach(ws: WebSocket): void {
      clients.add(ws);
      ws.send(
        JSON.stringify({
          kind: 'hello',
          ts: Date.now(),
          running: orch.listRunningExecutions(),
        } satisfies ServerMessage),
      );
      ws.on('close', () => {
        clients.delete(ws);
      });
      ws.on('error', () => {
        clients.delete(ws);
      });
    },
  };
}
