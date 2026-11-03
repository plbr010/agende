export function adminErrorMessage(error: { message?: string; code?: string } | null | undefined, fallback: string): string {
  const message = error?.message ?? "";
  if (message.includes("not_official_platform_admin")) {
    return "Só a conta master autorizada pode receber este acesso.";
  }
  if (message.includes("not_platform_admin") || error?.code === "42501") {
    return "Você não tem permissão para o painel master.";
  }
  if (message.includes("cannot_hold_self")) {
    return "Você não pode suspender a própria conta master.";
  }
  if (message.includes("invalid_hold_reason")) {
    return "Informe um motivo entre 3 e 200 caracteres.";
  }
  if (message.includes("hold_not_active")) {
    return "Essa conta já está ativa.";
  }
  if (message.includes("hold_target_not_found") || message.includes("admin_not_found")) {
    return "Não encontramos esse registro.";
  }
  if (message.includes("admin_user_not_confirmed")) {
    return "Só é possível promover uma conta com e-mail confirmado.";
  }
  if (message.includes("invalid_admin_filter")) {
    return "Esse filtro não é válido.";
  }
  return fallback;
}
