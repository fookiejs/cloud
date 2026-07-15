import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { KeyRound, Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/api";
import { clearSession, loadSession, saveSession, type Session } from "@/lib/session";

function ChangePasswordForm({ session }: { session: Session }) {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await changePassword(session, {
        currentPassword,
        newPassword,
      });
      saveSession(Object.assign({}, session, { mustChangePassword: false }));
      navigate("/projects", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSignOut() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-full items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-white/[0.08] bg-card shadow-2xl">
        <CardHeader className="space-y-6 text-center">
          <div className="flex justify-center">
            <BrandMark />
          </div>
          <div>
            <CardTitle className="text-2xl">Change your password</CardTitle>
            <CardDescription className="mt-2">
              You must set a new password before using Task Bridge.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="current-password">Current password</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="current-password"
                  type="password"
                  className="pl-10"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
            </Button>
          </form>

          <Button type="button" variant="ghost" className="w-full" onClick={handleSignOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function ChangePasswordPage() {
  const session = loadSession();
  if (!session) return <Navigate to="/login" replace />;
  if (!session.mustChangePassword) return <Navigate to="/projects" replace />;
  return <ChangePasswordForm session={session} />;
}
