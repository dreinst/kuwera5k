import { NextResponse, type NextRequest } from "next/server";

// Halaman admin selain login dan atur sandi tampil sebagai 404 kalau belum login, jadi orang yang iseng
// mencoba /kuweraadmin tidak melihat isinya. Cookie di sini hanya dicek ada atau tidak; keabsahan sesi tetap
// diperiksa requireAdmin() di setiap halaman dan aksi admin.
const PUBLIC = ["/kuweraadmin/login", "/kuweraadmin/setup"];

export function proxy(req: NextRequest) {
  if (PUBLIC.includes(req.nextUrl.pathname) || req.cookies.has("kw_admin")) return NextResponse.next();
  return NextResponse.rewrite(new URL("/_tidak-ada", req.url));
}

export const config = { matcher: ["/kuweraadmin", "/kuweraadmin/:path*"] };
