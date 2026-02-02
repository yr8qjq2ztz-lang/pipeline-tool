"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const supabase = supabaseBrowser();

  function getRedirectTo() {
    if (typeof window === "undefined") return "/pipeline";
    const raw = new URLSearchParams(window.location.search).get("redirectedFrom") ?? "";
    if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
    return "/pipeline";
  }

  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem("rememberMe_email") ?? "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return Boolean(localStorage.getItem("rememberMe_email"));
    } catch {
      return false;
    }
  });
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const redirectTo = getRedirectTo();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace(redirectTo);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) router.replace(redirectTo);
      })
      .finally(() => setChecking(false));

    return () => sub.subscription.unsubscribe();
  }, [router, supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    // Validation
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!password.trim()) {
      setError("Password is required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setSubmitting(true);
    try {
      const redirectTo = getRedirectTo();
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError(error.message || "Sign in failed");
          return;
        }

        // If email confirmation is required (or cookies/storage are blocked), session can be null.
        if (!data.session) {
          setError(
            "Signed in but no session was returned. If email confirmation is enabled, confirm your email first. Otherwise check that third-party cookies/storage aren’t blocked.",
          );
          return;
        }

        try {
          if (rememberMe) localStorage.setItem("rememberMe_email", email);
          else localStorage.removeItem("rememberMe_email");
        } catch {
          // localStorage might be disabled
        }

        setInfo("Signed in. Redirecting…");
        router.replace(redirectTo);
        return;
      }

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message || "Sign up failed");
        return;
      }

      if (!data.session) {
        setInfo("Account created. Check your email to confirm, then come back and sign in.");
        return;
      }

      router.replace(redirectTo);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Auth error:", err);
      }
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) return <div className="p-6">Loading…</div>;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "login" ? "Sign in" : "Create account"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">Use your work email and password.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm" htmlFor="login-email">
              Email
            </label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              id="login-email"
              name="email"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="text-sm" htmlFor="login-password">
              Password
            </label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              id="login-password"
              name="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </div>

          <div className="flex items-center">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="remember-me" className="ml-2 text-sm cursor-pointer">
              Remember my email
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm">{info}</p>}

          <button
            className="w-full rounded-lg bg-black text-white py-2 disabled:opacity-60"
            disabled={submitting}
          >
            {mode === "login" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button
          className="mt-4 text-sm text-slate-700 hover:underline"
          type="button"
          onClick={() => {
            setError(null);
            setInfo(null);
            setMode((m) => (m === "login" ? "signup" : "login"));
          }}
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
