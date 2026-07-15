import type { ServerMessage } from '../types.js';

export type Listener = (msg: ServerMessage) => void;

export interface EventBus {
  emit(msg: ServerMessage): void;
  subscribe(listener: Listener): () => void;
}

export function createBus(): EventBus {
  const listeners = new Set<Listener>();

  return {
    emit(msg: ServerMessage): void {
      for (const l of listeners) {
        try {
          l(msg);
        } catch (e: unknown) {
          console.error('listener error', e);
        }
      }
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return function unsubscribe(): void {
        listeners.delete(listener);
      };
    },
  };
}
