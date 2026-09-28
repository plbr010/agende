import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeRecovery } from "@/lib/auth/recovery";
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const valid = await exchangeRecovery(supabase.auth, request.nextUrl.searchParams);
  return NextResponse.redirect(new URL(valid ? "/redefinir-senha" : "/recuperar-senha?status=expired", request.url));
}
