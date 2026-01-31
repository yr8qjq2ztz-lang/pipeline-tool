import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

type LooseRow = Record<string, unknown>;
type LooseFunction = { Args: Record<string, unknown>; Returns: unknown };
type LooseTable = {
  Row: LooseRow;
  Insert: LooseRow;
  Update: LooseRow;
  Relationships: never[];
};

type LooseSchema = {
  Tables: Record<string, LooseTable>;
  Views: Record<string, LooseTable>;
  Functions: Record<string, LooseFunction>;
  Enums: Record<string, string>;
  CompositeTypes: Record<string, unknown>;
};

type LooseDatabase = {
  public: LooseSchema;
};

type BrowserSupabaseClient = SupabaseClient<LooseDatabase>;

let browserClient: BrowserSupabaseClient | null = null;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const timeoutMs = Number(process.env.NEXT_PUBLIC_SUPABASE_FETCH_TIMEOUT_MS ?? 30_000);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const signal = init?.signal;
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return fetch(input, {
    ...init,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));
}

export function supabaseBrowser() {
  // Next.js may prerender Client Components during `next build`.
  // Avoid constructing a browser client on the server where env vars
  // may be intentionally absent (e.g., in CI) and `@supabase/ssr` will throw.
  if (typeof window === "undefined") {
    const noopSub = { subscription: { unsubscribe() {} } };
    const notAvailable = () => {
      throw new Error("Supabase browser client is not available during SSR/prerender.");
    };

    const stub = {
      auth: {
        onAuthStateChange: () => ({ data: noopSub }),
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
        signInWithPassword: async () => notAvailable(),
        signUp: async () => notAvailable(),
        signOut: async () => notAvailable(),
      },
      from: () => notAvailable(),
    };

    return stub as unknown as BrowserSupabaseClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  if (browserClient) return browserClient;
  browserClient = createClient<LooseDatabase>(url, key, {
    global: {
      fetch: fetchWithTimeout,
    },
  });

  return browserClient;
}
