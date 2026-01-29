"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export default function LoginPage() {
  const router = useRouter();

  // Client-only: safe to create the browser client directly.
  const supabase = supabaseBrowser();

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

  // Wait for Supabase auth to initialize before doing anything clever.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === "INITIAL_SESSION") {
        setChecking(false);
        if (session) router.replace("/pipeline");
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [router, supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!supabase) {
      setError("Authentication not initialized. Please refresh.");
      return;
    }

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

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError(error.message || "Sign in failed");
          return;
        }
        
        // Handle remember me
        try {
          if (rememberMe) {
            localStorage.setItem("rememberMe_email", email);
          } else {
            localStorage.removeItem("rememberMe_email");
          }
        } catch {
          // localStorage might be disabled
        }
        
        router.replace("/pipeline");
        return;
      }

      // signup
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message || "Sign up failed");
        return;
      }

      // If email confirmation is required, session can be null.
      if (!data.session) {
        setInfo("Account created. Check your email to confirm, then come back and sign in.");
        return;
      }

      router.replace("/pipeline");
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Auth error:", err);
      }
      setError("An unexpected error occurred. Please try again.");
    }
  }

  if (checking) return <div className="p-6">Loading…</div>;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">
          {mode === "login" ? "Sign in" : "Create account"}
        </h1>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm">Email</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </div>

          <div>
            <label className="text-sm">Password</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
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

          <button className="w-full rounded-lg bg-black text-white py-2">
            {mode === "login" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button
          className="mt-4 text-sm underline"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
