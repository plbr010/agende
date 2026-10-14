import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeRecoveryStatus } from "@/lib/auth/recovery";
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const status = await exchangeRecoveryStatus(supabase.auth, request.nextUrl.searchParams);
  return NextResponse.redirect(new URL(status === "success" ? "/redefinir-senha" : `/recuperar-senha?status=${status}`, request.url));
}
