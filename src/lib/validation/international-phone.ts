import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/** Explicit international prefix required. Never infer a country or area code. */
export function internationalPhoneDigits(phone: string | null | undefined): string | null {
  if (!phone || !/^\+[\d\s().-]+$/.test(phone.trim())) return null;
  const normalized = phone.trim().replace(/[\s().-]/g, "");
  if (!/^\+[1-9]\d{1,14}$/.test(normalized)) return null;
  const parsed = parsePhoneNumberFromString(normalized);
  return parsed?.isValid() && parsed.number === normalized ? parsed.number.slice(1) : null;
}
