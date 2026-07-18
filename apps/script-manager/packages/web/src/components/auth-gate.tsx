import { useEffect, useState } from 'react';
import { BrandSplash } from '@/components/brand-splash';
import { FookieCloudMark } from '@/components/fookie-cloud-mark';
import {
  clearSession,
  exchangeCode,
  getAccessToken,
  isCloudHost,
  restoreSessionToken,
  signInUrl,
  tokenStillValid,
} from '@/lib/auth';

const MIN_SPLASH_MS = 2000;

function waitAtLeast(startedAt: number): Promise<void> {
  const left = MIN_SPLASH_MS - (Date.now() - startedAt);
  if (left <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, left);
  });
}

interface Props {
  children: React.ReactNode;
}

export function AuthGate(props: Props): React.JSX.Element {
  const [boot, setBoot] = useState<'skip' | 'loading' | 'ready' | 'auth' | 'error'>(() =>
    isCloudHost() ? 'loading' : 'skip',
  );
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isCloudHost()) {
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();

    async function goSignIn(): Promise<void> {
      const href = await signInUrl();
      await waitAtLeast(startedAt);
      if (cancelled) return;
      location.href = href;
    }

    const url = new URL(location.href);
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (code === null || state === null) {
        setBoot('error');
        setAuthError('Missing OAuth code');
        return;
      }
      setBoot('auth');
      void exchangeCode(code, state)
        .then(async () => {
          await waitAtLeast(startedAt);
          if (cancelled) return;
          history.replaceState({}, '', '/');
          setBoot('ready');
        })
        .catch((err: unknown) => {
          clearSession();
          if (!cancelled) {
            setBoot('error');
            setAuthError(err instanceof Error ? err.message : 'Auth failed');
          }
        });
      return () => {
        cancelled = true;
      };
    }

    let token = getAccessToken();
    if (token === null) {
      void restoreSessionToken()
        .then(async (restoredToken) => {
          await waitAtLeast(startedAt);
          if (!cancelled) {
            void restoredToken;
            setBoot('ready');
          }
        })
        .catch(() => void goSignIn());
      return () => {
        cancelled = true;
      };
    }

    void tokenStillValid(token)
      .then(async (ok) => {
        if (ok) {
          await waitAtLeast(startedAt);
          if (cancelled) return;
          setBoot('ready');
          return;
        }
        clearSession();
        await goSignIn();
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setBoot('error');
          setAuthError(err instanceof Error ? err.message : 'Auth failed');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (boot === 'skip' || boot === 'ready') {
    return <>{props.children}</>;
  }

  if (boot === 'error') {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-sm gap-3">
        <p className="text-destructive">{authError || 'Auth failed'}</p>
        <button
          type="button"
          className="text-primary underline"
          onClick={() => {
            history.replaceState({}, '', '/');
            clearSession();
            void signInUrl().then((href) => {
              location.href = href;
            });
          }}
        >
          Try again
        </button>
        <FookieCloudMark size="sm" />
      </div>
    );
  }

  return (
    <BrandSplash
      title="Script Manager"
      subtitle={boot === 'auth' ? 'Signing in…' : 'Loading…'}
    />
  );
}
