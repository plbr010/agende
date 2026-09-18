export function isValidBrNational(national: string): boolean {
  if (national.length === 11) {
    return /^[1-9]\d9\d{8}$/.test(national);
  }
  if (national.length === 10) {
    return /^[1-9]\d[2-9]\d{7}$/.test(national);
  }
  return false;
}

export function extractBrNationalDigits(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  if (digits.startsWith("55") && digits.length >= 12) {
    const national = digits.slice(2);
    if (isValidBrNational(national)) {
      return national;
    }
  }

  if (isValidBrNational(digits)) {
    return digits;
  }

  return null;
}

export function normalizePhone(input: string): string | null {
  const national = extractBrNationalDigits(input);
  if (!national) {
    return null;
  }
  return `+55${national}`;
}

export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}

export function formatPhoneBr(input: string): string {
  const national =
    extractBrNationalDigits(input) ?? input.replace(/\D/g, "").slice(0, 11);
  const digits = national.slice(0, 11);

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
