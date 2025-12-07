import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Allow ALL requests through without redirects or auth checks
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

// Optional: you can omit config entirely, but if it's already there, replace with this
// to effectively match nothing special (middleware still runs, but does nothing).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
