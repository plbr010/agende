import { BR_STATES } from "@/lib/workspace/labels";
import { sanitizeDiscoveryCoordinates, type DiscoveryCoordinates } from "./contract";

const BR_STATE_VALUES = new Set(BR_STATES.map((item) => item.value));

export type ReverseGeocodedLocality = {
  city: string;
  state: string;
};

function firstCity(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length >= 2) {
      return value.trim();
    }
  }
  return null;
}

function stateFromPayload(payload: Record<string, unknown>): string {
  const code = payload.principalSubdivisionCode;
  if (typeof code === "string") {
    const match = code.toUpperCase().match(/^BR-([A-Z]{2})$/);
    if (match && BR_STATE_VALUES.has(match[1] as (typeof BR_STATES)[number]["value"])) {
      return match[1];
    }
  }
  const iso = payload.principalSubdivision;
  if (typeof iso === "string") {
    const upper = iso.trim().toUpperCase();
    if (BR_STATE_VALUES.has(upper as (typeof BR_STATES)[number]["value"])) {
      return upper;
    }
  }
  return "";
}

export function parseReverseGeocodePayload(raw: unknown): ReverseGeocodedLocality | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  if (typeof payload.countryCode === "string" && payload.countryCode.toUpperCase() !== "BR") return null;
  const city = firstCity(payload.city, payload.locality, payload.localityName);
  if (!city) return null;
  return { city, state: stateFromPayload(payload) };
}

/**
 * Reverse-geocode rounded WGS84 coordinates to a Brazilian city.
 * Used only after explicit browser consent. Coordinates are not stored.
 */
export async function reverseGeocodeLocality(
  coordinates: DiscoveryCoordinates,
  fetchImpl: typeof fetch = fetch,
): Promise<ReverseGeocodedLocality | null> {
  const rounded = sanitizeDiscoveryCoordinates(coordinates);
  if (!rounded) return null;
  const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
  url.searchParams.set("latitude", String(rounded.latitude));
  url.searchParams.set("longitude", String(rounded.longitude));
  url.searchParams.set("localityLanguage", "pt");
  try {
    const response = await fetchImpl(url, { method: "GET", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    return parseReverseGeocodePayload(await response.json());
  } catch {
    return null;
  }
}
