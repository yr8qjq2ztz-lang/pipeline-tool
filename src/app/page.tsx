"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function Home() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "INITIAL_SESSION") {
          setReady(true);
          try {
            router.replace(session ? "/pipeline" : "/login");
          } catch (e) {
            console.error("Navigation error:", e);
            setError("Failed to navigate. Please refresh the page.");
          }
        }
      });

      unsubscribe = () => sub.subscription.unsubscribe();
    } catch (e) {
      console.error("Auth initialization error:", e);
      queueMicrotask(() => {
        setError("Failed to initialize authentication.");
        setReady(true);
      });
    }

    return () => unsubscribe?.();
  }, [router, supabase.auth]);

  if (error) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="font-semibold">Error</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="font-semibold text-gray-700">{ready ? "Redirecting…" : "Loading…"}</p>
      </div>
    </div>
  );
}
