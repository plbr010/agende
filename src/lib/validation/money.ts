export const SERVICE_DURATION_MIN = 5;
export const SERVICE_DURATION_MAX = 480;
export const SERVICE_PRICE_MAX_CENTS = 10_000_000;
export const SERVICE_NAME_MAX = 80;
export const CLIENT_NOTES_MAX = 2000;

export function parseReaisToCents(input: string): number | null {
  const raw = input.trim().replace(/R\$\s?/gi, "").trim();
  if (!raw) {
    return null;
  }

  let normalized = raw;
  if (raw.includes(",")) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if ((raw.match(/\./g) ?? []).length > 1) {
    normalized = raw.replace(/\./g, "");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [reais, fraction = ""] = normalized.split(".");
  const cents = Number.parseInt(reais, 10) * 100 + Number.parseInt(fraction.padEnd(2, "0").slice(0, 2) || "0", 10);
  if (!Number.isFinite(cents) || cents < 0 || cents > SERVICE_PRICE_MAX_CENTS) {
    return null;
  }
  return cents;
}

export function formatCentsToReais(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatCentsInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function isValidDurationMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= SERVICE_DURATION_MIN && value <= SERVICE_DURATION_MAX;
}
