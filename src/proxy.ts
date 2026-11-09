import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isAdminToken } from "@/lib/auth";

/** Operator pages (/admin, /print) and their APIs require the admin cookie. */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/admin/login") || pathname.startsWith("/api/admin/login")) return NextResponse.next();

  if (await isAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/print/:path*", "/api/admin/:path*"],
};
