import { useEffect, useState } from 'react';
import { getAccessToken, isCloudHost } from '@/lib/auth';

export interface AgentInfo {
  hostname: string;
  version: string;
  connectedAt: number;
}

export interface AgentConnection {
  checking: boolean;
  online: boolean;
  info: AgentInfo | null;
}

async function fetchAgentStatus(token: string): Promise<{
  online: boolean;
  info: AgentInfo | null;
}> {
  const res = await fetch('/v1/agent/status', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return { online: false, info: null };
  }
  return (await res.json()) as { online: boolean; info: AgentInfo | null };
}

export function useAgentConnection(): AgentConnection {
  const [checking, setChecking] = useState(() => isCloudHost());
  const [online, setOnline] = useState(() => !isCloudHost());
  const [info, setInfo] = useState<AgentInfo | null>(null);

  useEffect(() => {
    if (!isCloudHost()) {
      setChecking(false);
      setOnline(true);
      return;
    }

    let cancelled = false;

    async function tick(): Promise<void> {
      const token = getAccessToken();
      if (token === null) {
        if (!cancelled) {
          setOnline(false);
          setInfo(null);
          setChecking(false);
        }
        return;
      }
      try {
        const status = await fetchAgentStatus(token);
        if (!cancelled) {
          setOnline(status.online);
          setInfo(status.info);
          setChecking(false);
        }
      } catch {
        if (!cancelled) {
          setOnline(false);
          setInfo(null);
          setChecking(false);
        }
      }
    }

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, 2500);

    function onAgent(ev: Event): void {
      const detail = (ev as CustomEvent<{ online?: boolean; info?: AgentInfo | null }>).detail;
      if (typeof detail?.online !== 'boolean') {
        return;
      }
      setOnline(detail.online);
      setInfo(detail.info ?? null);
      setChecking(false);
    }
    window.addEventListener('lotaru:agent', onAgent);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener('lotaru:agent', onAgent);
    };
  }, []);

  return { checking, online, info };
}
