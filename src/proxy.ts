import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  // Always start with a pass-through response we can attach cookies to
  const response = NextResponse.next();

  // If Supabase needs to refresh the session, it will call `setAll`.
  // We must apply those cookies to *whatever* response we return (including redirects).
  type CookieOptions = Parameters<NextResponse["cookies"]["set"]>[2];
  type CookieToSet = { name: string; value: string; options?: CookieOptions };
  const pendingCookies: CookieToSet[] = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env vars are missing (rare, but builds can be weird), don't block the site.
  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        pendingCookies.length = 0;
        (cookiesToSet as CookieToSet[]).forEach(({ name, value, options }) => {
          pendingCookies.push({ name, value, options });
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isLoginRoute = pathname === "/login" || pathname.startsWith("/login/");
  const isProtectedRoute =
    pathname === "/" ||
    pathname.startsWith("/pipeline") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/replay") ||
    pathname.startsWith("/admin");

  // Not logged in + trying to access protected route -> go to login
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    const redirectRes = NextResponse.redirect(url);
    pendingCookies.forEach(({ name, value, options }) => {
      redirectRes.cookies.set(name, value, options);
    });
    return redirectRes;
  }

  // Logged in + trying to access login -> go to pipeline
  if (user && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/pipeline";
    url.search = "";
    const redirectRes = NextResponse.redirect(url);
    pendingCookies.forEach(({ name, value, options }) => {
      redirectRes.cookies.set(name, value, options);
    });
    return redirectRes;
  }

  return response;
}

// Apply proxy to all routes except Next static assets & common files
export const config = {
  // Important: exclude all Next.js internal paths. In dev, Next uses routes like
  // `/_next/webpack-hmr` which must not be intercepted by auth redirects.
  matcher: ["/((?!api|_next|favicon.ico|robots.txt|sitemap.xml).*)"],
};
