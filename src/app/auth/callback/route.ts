import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearPendingJourney, getPendingJourney } from "@/lib/auth/actions";
import { getDefaultDestination, sanitizeNextPath } from "@/lib/auth/redirects";
import { postConfirmationPath } from "@/lib/auth/signup-journey";
import { loadAppSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error?.code === "pkce_code_verifier_not_found") {
      return NextResponse.redirect(`${origin}/verificar-email?status=browser_mismatch`);
    }
    if (!error) {
      let session;
      try {
        session = await loadAppSession();
      } catch {
        // Code exchange has succeeded. Keep its cookies and pending journey;
        // a temporary profile/session read failure must not strand a used link.
        console.error("auth_session_after_confirmation_unavailable");
        return NextResponse.redirect(`${origin}/verificar-email?status=session_unavailable`);
      }
      const destination = session
        ? getDefaultDestination(session.context)
        : "/verificar-email?status=error";
      const path = postConfirmationPath({
        next: sanitizeNextPath(next),
        destination,
        journey: await getPendingJourney(),
        hasClientProfile: Boolean(session?.context.hasClientProfile),
        intendedUse: session?.context.intendedUse ?? null,
      });
      await clearPendingJourney();
      return NextResponse.redirect(`${origin}${path}`);
    }
  }

  return NextResponse.redirect(`${origin}/verificar-email?status=error`);
}
