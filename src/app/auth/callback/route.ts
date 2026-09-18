import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultDestination, sanitizeNextPath } from "@/lib/auth/redirects";
import { loadAppSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const session = await loadAppSession();
      const destination = session
        ? getDefaultDestination(session.context)
        : "/verificar-email?status=error";
      const path = sanitizeNextPath(next) ?? destination;
      return NextResponse.redirect(`${origin}${path}`);
    }
  }

  return NextResponse.redirect(`${origin}/verificar-email?status=error`);
}
