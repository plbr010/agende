const fields: [string[], string, string][] = [
  [["invalid_phone", "workspace_settings_phone_format"], "businessPhone", "Informe um telefone brasileiro válido, com DDD."],
  [["invalid_business_email", "workspace_settings_email_format"], "businessEmail", "Informe um e-mail comercial válido."],
  [["invalid_address", "workspace_settings_address_len"], "address", "O endereço pode ter no máximo 160 caracteres, sem caracteres de controle."],
  [["invalid_city", "workspace_settings_city_len"], "city", "Informe uma cidade de 2 a 80 caracteres."],
  [["invalid_state", "workspace_settings_state_format"], "state", "Escolha um estado brasileiro válido."],
  [["invalid_postal_code", "workspace_settings_postal_code"], "postalCode", "Informe um CEP com 8 dígitos."],
  [["invalid_timezone", "workspace_settings_timezone_allowed"], "timezone", "Escolha um fuso horário válido."],
];
export function workspaceSettingsFieldError(message: string) {
  const field = fields.find(([codes]) => codes.some(code => message.includes(code)));
  return field ? { error: "Revise os campos destacados.", fieldErrors: { [field[1]]: field[2] } } : null;
}

export const inactiveWorkspaceMessage = "O teste grátis ou a assinatura deste estabelecimento está inativo. Confira a assinatura para continuar editando o negócio.";
