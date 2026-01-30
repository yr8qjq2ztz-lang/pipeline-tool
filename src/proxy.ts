import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  // Always start with a pass-through response we can attach cookies to
  const response = NextResponse.next();

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
        cookiesToSet.forEach(({ name, value, options }) => {
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
    return NextResponse.redirect(url);
  }

  // Logged in + trying to access login -> go to pipeline
  if (user && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/pipeline";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

// Apply proxy to all routes except Next static assets & common files
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
