import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset Password — Invitation Portfolio" },
      { name: "description", content: "Set a new admin password." },
      { property: "og:title", content: "Reset Password — Invitation Portfolio" },
      { property: "og:description", content: "Set a new admin password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));
    const errDesc = params.get("error_description");
    if (errDesc) setMsg(`${errDesc.replace(/\+/g, " ")}. Please request a new reset email.`);
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setMsg("Password must be at least 8 characters.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setMsg(error.message);
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Set a new password</CardTitle></CardHeader>
        <CardContent>
          {!ready ? (
            <p className="text-sm text-muted-foreground">{msg ?? "Open this page from the reset link in your email."}</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pw">New password</Label>
                <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {msg && <p className="text-sm text-destructive">{msg}</p>}
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Saving…" : "Save password"}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
