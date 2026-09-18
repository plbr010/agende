import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultDestination } from "@/lib/auth/redirects";
import { loadAppSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      const session = await loadAppSession();
      const destination = session
        ? getDefaultDestination(session.context)
        : "/verificar-email?status=error";
      const redirectTo = request.nextUrl.clone();
      redirectTo.pathname = next && next.startsWith("/") ? next : destination;
      redirectTo.search = "";
      return NextResponse.redirect(redirectTo);
    }
  }

  const errorUrl = request.nextUrl.clone();
  errorUrl.pathname = "/verificar-email";
  errorUrl.search = "status=expired";
  return NextResponse.redirect(errorUrl);
}
