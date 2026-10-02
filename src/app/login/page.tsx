"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const supabase = createBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured yet.");
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/today`,
      },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setMessage("Check your email for a sign-in link.");
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <Link
        href="/today"
        className="font-[family-name:var(--font-display)] text-3xl font-semibold text-primary"
      >
        Akosile
      </Link>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Sign in to sync</CardTitle>
          <CardDescription>
            Cloud sync keeps your data available across devices. Local capture
            still works offline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!configured ? (
            <Alert>
              <AlertDescription className="text-sm">
                Add your Supabase URL and publishable key to{" "}
                <code>.env.local</code>,
                then run the SQL in{" "}
                <code>supabase/migrations/</code> (001 through 003).
              </AlertDescription>
            </Alert>
          ) : (
            <form
              onSubmit={(e) => void sendMagicLink(e)}
              className="space-y-3"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  placeholder="you@example.com"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full hover:bg-[var(--akosile-primary-dark)]"
              >
                {loading ? "Sending…" : "Email me a link"}
              </Button>
            </form>
          )}

          {message && (
            <Alert className="border-success/30 bg-success/10">
              <AlertDescription className="text-success">{message}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Button asChild variant="link" className="mt-6 text-muted-foreground">
        <Link href="/today">Continue without signing in</Link>
      </Button>
    </div>
  );
}
