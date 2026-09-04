import { ok, err, type Result } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lon: number;
  /** Resolved city name returned by the API (may differ from query) */
  resolvedName: string;
}

export interface GeocodingHints {
  placeId?: string;
  expectedCountry?: string;
  expectedState?: string;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
// Keyed by normalised destination string. Lives for the browser session —
// avoids re-geocoding the same city when navigating between trips.

const cache = new Map<string, Promise<Coordinates>>();

function cacheKey(destination: string, hints?: GeocodingHints): string {
  return [
    destination.trim().toLowerCase(),
    hints?.placeId?.trim().toLowerCase() ?? '',
    normalizeCountryCode(hints?.expectedCountry),
    normalizeState(hints?.expectedState),
  ].join('|');
}

function normalizeAlpha(value: string | undefined): string {
  return (value ?? '').trim().toUpperCase().replace(/[^A-Z]/g, '');
}

function normalizeCountryCode(value: string | undefined): string {
  const raw = normalizeAlpha(value);
  if (!raw) return '';

  const aliases: Record<string, string> = {
    USA: 'US',
    UNITEDSTATES: 'US',
    US: 'US',
    CANADA: 'CA',
    CA: 'CA',
    UNITEDKINGDOM: 'GB',
    UK: 'GB',
    GREATBRITAIN: 'GB',
    GB: 'GB',
  };

  if (aliases[raw]) return aliases[raw];
  if (raw.length === 2) return raw;
  return raw;
}





function normalizeState(value: string | undefined): string {
  const raw = normalizeAlpha(value);
  if (!raw) return '';
  const aliases: Record<string, string> = {
    CALIFORNIA: 'CA',
    CA: 'CA',
  };
  return aliases[raw] ?? raw;
}

function extractPrimaryDestination(destination: string): string {
  return destination.split(';')[0]?.trim() ?? destination.trim();
}

function parseDestination(destination: string): GeocodingHints {
  const primary = extractPrimaryDestination(destination);
  const tokens = primary.split(',').map((token) => token.trim()).filter(Boolean);

  if (tokens.length < 2) return {};

  const expectedCountry = normalizeCountryCode(tokens[tokens.length - 1]);
  const expectedState = tokens.length >= 3 ? normalizeState(tokens[tokens.length - 2]) : '';

  return {
    expectedCountry: expectedCountry || undefined,
    expectedState: expectedState || undefined,
  };
}



// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve a destination string (e.g. "Goa", "Reykjavik, Iceland") to
 * geographic coordinates using the Nominatim Geocoding API.
 *
 * Returns a cached result if the same destination was already resolved
 * during this session.
 */
export async function getCoordinatesFromCity(
  destination: string,
  hints?: GeocodingHints,
): Promise<Result<Coordinates>> {
  const parsed = parseDestination(destination);
  const expectedCountry = normalizeCountryCode(hints?.expectedCountry ?? parsed.expectedCountry);
  const expectedState = normalizeState(hints?.expectedState ?? parsed.expectedState);

  const mergedHints: GeocodingHints = {
    placeId: hints?.placeId,
    expectedCountry: expectedCountry || undefined,
    expectedState: expectedState || undefined,
  };

  const key = cacheKey(destination, mergedHints);
  if (cache.has(key)) {
    try {
      const coords = await cache.get(key)!;
      return ok(coords);
    } catch (e: any) {
      cache.delete(key);
      return err('Failed to resolve location from cache.');
    }
  }

  const fetchPromise = (async () => {
    try {
      let primary = extractPrimaryDestination(destination);
      // Strip emojis if any slipped through
      primary = primary.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/gu, '').trim();

      const url = new URL('https://api.weatherapi.com/v1/search.json');
      url.searchParams.set('key', 'd638ebead38a4bb89a5233308263007');
      url.searchParams.set('q', primary);

      let res = await fetch(url.toString(), { cache: 'no-cache' });
      let json = await res.json();

      // Fallback logic for strict matching
      if (!Array.isArray(json) || json.length === 0) {
        const parts = primary.split(',').map(s => s.trim()).filter(Boolean);
        
        // Fallback 1: Try "First Part, Last Part" (e.g. "Shinjuku, Tokyo, Japan" -> "Shinjuku, Japan")
        if (parts.length > 2) {
          const fallback1 = `${parts[0]}, ${parts[parts.length - 1]}`;
          url.searchParams.set('q', fallback1);
          res = await fetch(url.toString(), { cache: 'no-cache' });
          json = await res.json();
        }

        // Fallback 2: Try just the first part (e.g. "Shinjuku")
        if ((!Array.isArray(json) || json.length === 0) && parts.length > 1) {
          url.searchParams.set('q', parts[0]);
          res = await fetch(url.toString(), { cache: 'no-cache' });
          json = await res.json();
        }
      }

      if (!Array.isArray(json) || json.length === 0) {
        throw new Error(`Could not find coordinates for "${destination}". Try a simpler city or country name.`);
      }

      const first = json[0];

      const coords: Coordinates = {
        lat: first.lat,
        lon: first.lon,
        resolvedName: `${first.name}, ${first.country}`,
      };

      return coords;
    } catch (e: any) {
      cache.delete(key);
      throw e;
    }
  })();

  cache.set(key, fetchPromise);

  try {
    const coords = await fetchPromise;
    return ok(coords);
  } catch (e: any) {
    console.error('[getCoordinatesFromCity]', e);
    // Pass the actual underlying message so we can see what's happening (e.g., HTTP 401, HTTP 429, Failed to fetch)
    return err(e.message || 'Failed to resolve location due to a network or rate-limit error.');
  }
}
