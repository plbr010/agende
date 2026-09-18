export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export const WORKSPACE_TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (São Paulo, Rio, BH)" },
  { value: "America/Fortaleza", label: "Fortaleza" },
  { value: "America/Recife", label: "Recife" },
  { value: "America/Bahia", label: "Bahia" },
  { value: "America/Belem", label: "Belém" },
  { value: "America/Manaus", label: "Manaus" },
  { value: "America/Cuiaba", label: "Cuiabá" },
  { value: "America/Porto_Velho", label: "Porto Velho" },
  { value: "America/Boa_Vista", label: "Boa Vista" },
  { value: "America/Rio_Branco", label: "Rio Branco" },
  { value: "America/Noronha", label: "Fernando de Noronha" },
] as const;

export type WorkspaceTimezone = (typeof WORKSPACE_TIMEZONES)[number]["value"];

const TIMEZONE_VALUES = new Set<string>(WORKSPACE_TIMEZONES.map((item) => item.value));

export function isWorkspaceTimezone(value: string): value is WorkspaceTimezone {
  return TIMEZONE_VALUES.has(value);
}

export function resolveWorkspaceTimezone(value: string | null | undefined): WorkspaceTimezone {
  if (value && isWorkspaceTimezone(value)) {
    return value;
  }
  return DEFAULT_TIMEZONE;
}

export function formatDateTime(
  value: string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    ...options,
    timeZone: resolveWorkspaceTimezone(timezone),
  }).format(new Date(value));
}

export function formatDate(
  value: string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  return formatDateTime(value, timezone, { dateStyle: "medium" });
}
