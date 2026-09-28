"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/http/origin";
import { sendRecovery, changeRecoveredPassword } from "@/lib/auth/recovery";
import type { ActionState } from "@/lib/auth/actions";
export async function requestPasswordRecovery(_prev: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  return sendRecovery(supabase.auth, form.get("email"), await getRequestOrigin());
}
export async function updateRecoveredPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const result = await changeRecoveredPassword(supabase.auth, { password: form.get("password"), confirmPassword: form.get("confirmPassword") });
  if (result.error) return { error: result.error };
  redirect("/login?password=updated");
}
