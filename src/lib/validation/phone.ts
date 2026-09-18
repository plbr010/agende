export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) {
    return null;
  }
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return `+${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

export function isValidPhone(input: string): boolean {
  const normalized = normalizePhone(input);
  return normalized !== null && /^\+[1-9]\d{7,14}$/.test(normalized);
}

export function formatPhoneBr(input: string): string {
  const digits = input.replace(/\D/g, "").replace(/^55/, "").slice(0, 11);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
