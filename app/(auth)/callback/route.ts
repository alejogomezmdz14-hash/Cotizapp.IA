import { NextResponse } from "next/server";

export async function GET() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

  return NextResponse.redirect(new URL("/sign-in", appUrl));
}
