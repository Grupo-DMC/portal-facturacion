import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

const isProd = process.env.NODE_ENV === "production";

function csp(nonce: string) {
  return [
    "default-src 'self'",
    // 'strict-dynamic' + nonce: solo corre el JS que Next emite con el nonce de esta respuesta.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProd ? "" : " 'unsafe-eval'"}`,
    // Los atributos style="" de React/Tailwind no admiten nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'" + (isProd ? "" : " ws: wss:"),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = pathname === "/login";

  let res: NextResponse;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp(nonce));

  if (!session && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    res = pathname.startsWith("/api/") ? NextResponse.json({ error: "No autenticado" }, { status: 401 }) : NextResponse.redirect(url);
  } else if (session && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = session.role === "ger" ? "/semanal" : "/";
    url.search = "";
    res = NextResponse.redirect(url);
  } else {
    res = NextResponse.next({ request: { headers } });
  }

  res.headers.set("Content-Security-Policy", csp(nonce));
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (isProd) res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  // Datos financieros: nada de caché compartida.
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
