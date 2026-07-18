import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { clearFookieTokens, exchangeCode } from "@/lib/auth";
import { fetchAuthMe } from "@/lib/api";
import { saveSession, type UserRole } from "@/lib/session";
import { BrandSplash } from "@/components/BrandSplash";

const MIN_SPLASH_MS = 2000;

function waitAtLeast(startedAt: number): Promise<void> {
  const left = MIN_SPLASH_MS - (Date.now() - startedAt);
  if (left <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, left);
  });
}

export function CallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();
    const code = params.get("code");
    const state = params.get("state");

    async function run() {
      if (code === null || state === null) {
        setError("Missing OAuth code");
        return;
      }
      try {
        const token = await exchangeCode(code, state);
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
        await waitAtLeast(startedAt);
        if (cancelled) return;
        navigate("/projects", { replace: true });
      } catch (err: unknown) {
        clearFookieTokens();
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Auth failed");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, params]);

  if (error) {
    return (
      <BrandSplash
        title="Task Bridge"
        error={error}
        onRetry={() => navigate("/login", { replace: true })}
      />
    );
  }

  return <BrandSplash title="Task Bridge" subtitle="Signing in…" />;
}
