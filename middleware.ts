import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Dominio público de Citaya (portada + páginas de reservas). */
const PUBLIC_HOST = new RegExp(
  `^${process.env.PUBLIC_HOST_RE ?? "(?:www\\.)?holacitaya\\.app"}$`,
  "i",
);

/** Páginas públicas (reservas y portada): no necesitan sesión. */
function isAnonymousPage(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/r/") || pathname === "/bienvenida") return true;
  // En el dominio público todo es anónimo: las rutas del panel ya se han
  // redirigido a panel.holacitaya.app en next.config (antes del middleware).
  const host = (request.headers.get("host") ?? "").split(":")[0];
  return PUBLIC_HOST.test(host);
}

export async function middleware(request: NextRequest) {
  if (isAnonymousPage(request)) return NextResponse.next();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              options as Parameters<typeof supabaseResponse.cookies.set>[2],
            ),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // Routes reachable without a session.
  const publicRoutes = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ];
  const isPublicRoute = publicRoutes.includes(pathname);

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated users don't belong on entry auth pages — but /reset-password
  // is reached WITH a recovery session, so it must stay accessible.
  if (
    user &&
    (pathname === "/login" ||
      pathname === "/signup" ||
      pathname === "/forgot-password")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/hoy";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
