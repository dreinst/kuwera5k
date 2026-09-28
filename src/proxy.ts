import { NextResponse, type NextRequest } from "next/server";

// /admin disembunyikan: tanpa cookie pintu, semua alamat /admin tampil sebagai 404. Cookie pintu hanya
// didapat lewat alamat rahasia /masuk/{ADMIN_GATE_KEY} (env), yang lalu mengarah ke /admin/login.
// Autentikasi tetap di requireAdmin(); ini hanya menyembunyikan halamannya dari orang yang iseng mencoba.
const GATE_COOKIE = "kw_gate";

const notFound = (req: NextRequest) => NextResponse.rewrite(new URL("/_tidak-ada", req.url));

export function proxy(req: NextRequest) {
  const key = process.env.ADMIN_GATE_KEY;
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/masuk/")) {
    if (!key || pathname !== `/masuk/${key}`) return notFound(req);
    const res = NextResponse.redirect(new URL("/admin/login", req.url));
    res.cookies.set(GATE_COOKIE, key, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 3600,
    });
    return res;
  }

  if (!key || req.cookies.get(GATE_COOKIE)?.value !== key) return notFound(req);
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:path*", "/masuk/:path*"] };
