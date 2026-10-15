"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/auth/actions";
import { extractInviteToken, INVITE_STATUS_COPY, inviteReturnPath } from "@/lib/auth/signup-journey";
import { createClient } from "@/lib/supabase/server";
import { parseInvitePeek } from "@/lib/workspace/public";

export async function openInviteLinkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = extractInviteToken(String(formData.get("invite") ?? ""));
  if (!token) {
    return { error: "Cole o link inteiro do convite ou só o código que você recebeu." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("peek_workspace_invite", { p_token: token });
  if (error) {
    return { error: "Não foi possível conferir o convite agora. Tente de novo em instantes." };
  }

  const peek = parseInvitePeek(data);
  if (peek.status === "valid") {
    redirect(`/cadastro?intent=equipe&next=${encodeURIComponent(inviteReturnPath(token))}`);
  }

  return { error: INVITE_STATUS_COPY[peek.status].body };
}
