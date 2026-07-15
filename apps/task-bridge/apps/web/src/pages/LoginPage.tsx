import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearFookieTokens, getAccessToken, signInUrl } from "@/lib/auth";
import { fetchAuthMe } from "@/lib/api";
import { loadSession, saveSession, type UserRole } from "@/lib/session";
import { BrandSplash } from "@/components/BrandSplash";

const MIN_SPLASH_MS = 2000;

function waitAtLeast(startedAt: number): Promise<void> {
  const left = MIN_SPLASH_MS - (Date.now() - startedAt);
  if (left <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, left);
  });
}

async function hydrateSessionFromToken(token: string): Promise<void> {
  const user = await fetchAuthMe(token);
  saveSession({
    token,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userRole: user.role as UserRole,
    isSystemAdmin: user.isSystemAdmin,
    mustChangePassword: false,
    projectId: null,
    projectName: null,
  });
}

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    async function run() {
      const session = loadSession();
      if (session) {
        await waitAtLeast(startedAt);
        if (cancelled) return;
        navigate(session.projectId ? `/projects/${session.projectId}/tasks` : "/projects", {
          replace: true,
        });
        return;
      }

      const token = getAccessToken();
      if (token) {
        try {
          await hydrateSessionFromToken(token);
          await waitAtLeast(startedAt);
          if (cancelled) return;
          navigate("/projects", { replace: true });
        } catch {
          clearFookieTokens();
          try {
            const href = await signInUrl();
            await waitAtLeast(startedAt);
            if (cancelled) return;
            window.location.href = href;
          } catch (err: unknown) {
            if (!cancelled) {
              setError(err instanceof Error ? err.message : "Sign in failed");
            }
          }
        }
        return;
      }

      try {
        const href = await signInUrl();
        await waitAtLeast(startedAt);
        if (cancelled) return;
        window.location.href = href;
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Sign in failed");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, retryKey]);

  if (error) {
    return (
      <BrandSplash
        title="Task Bridge"
        error={error}
        onRetry={() => {
          setError("");
          setRetryKey((k) => k + 1);
        }}
      />
    );
  }

  return <BrandSplash title="Task Bridge" subtitle="Loading…" />;
}
