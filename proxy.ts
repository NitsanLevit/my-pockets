import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

const PUBLIC_SEGMENTS = ["login", "signup"];

function isPublicPath(pathname: string) {
  const withoutLocale = pathname.replace(
    new RegExp(`^/(${routing.locales.join("|")})`),
    ""
  );
  if (withoutLocale === "" || withoutLocale === "/") return true;
  return PUBLIC_SEGMENTS.some((segment) =>
    withoutLocale.startsWith(`/${segment}`)
  );
}

export async function proxy(request: NextRequest) {
  // 1. Resolve locale prefix / redirects first so cookies below land on the
  //    final, locale-aware response.
  const response = handleI18nRouting(request);

  // 2. Refresh the Supabase session and mirror any rotated cookies onto the
  //    response next-intl produced above.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const locale =
      routing.locales.find((l) => request.nextUrl.pathname.startsWith(`/${l}`)) ??
      routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
