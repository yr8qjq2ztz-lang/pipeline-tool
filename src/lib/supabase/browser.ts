import { createClient } from "@supabase/supabase-js";

export function supabaseBrowser() {
  type BrowserSupabaseClient = ReturnType<typeof createClient>;

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

  return createClient(url, key);
}
