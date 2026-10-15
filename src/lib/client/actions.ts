"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/auth/actions";
import { requireConfirmedSession } from "@/lib/auth/session";
import { parseClientProfileUpdate } from "@/lib/client/profile";

export async function updateClientProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireConfirmedSession("/cliente/perfil");
  const parsed = parseClientProfileUpdate({
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    residenceCity: String(formData.get("residenceCity") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { error: "Confira os campos em vermelho.", fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Não foi possível salvar. Entre novamente." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone,
      ...(formData.has("residenceCity") ? { residence_city: parsed.data.residenceCity } : {}) })
    .eq("user_id", user.id).select("user_id").single();

  if (error || !data) {
    console.error("account_profile_save_failed", { code: error?.code ?? "profile_missing" });
    return { error: "Não foi possível salvar seu perfil. Tente novamente." };
  }

  revalidatePath("/cliente");
  revalidatePath("/cliente/perfil");
  revalidatePath("/app", "layout");
  return { success: "Seus dados foram salvos." };
}
