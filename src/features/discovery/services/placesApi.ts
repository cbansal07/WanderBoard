import type { Place } from '@/features/discovery/types';

const FALLBACK_PHOTO_URL = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80';

export interface ResolvedPlace {
  location: { lat: number; lng: number };
  placeId: string;
  name: string;
}

async function fetchLocationIQ(urlParams: Record<string, string>) {
  const url = new URL('https://us1.locationiq.com/v1/search.php');
  url.searchParams.set('format', 'json');
  url.searchParams.set('key', 'pk.11913635f064e39f8f38b09476c56c33');
  
  for (const [key, value] of Object.entries(urlParams)) {
    url.searchParams.set(key, value);
  }

  let res = await fetch(url.toString(), { cache: 'no-cache' });

  // Handle rate limits with a single retry
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 1500));
    res = await fetch(url.toString(), { cache: 'no-cache' });
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

export async function resolvePlaceCoordinates(cityName: string): Promise<ResolvedPlace | null> {
  if (!cityName.trim()) return null;

  try {
    let json = await fetchLocationIQ({ q: cityName, limit: '1' });
    
    // Fallback: If no results, try just the first part before a comma
    if ((!Array.isArray(json) || json.length === 0) && cityName.includes(',')) {
      const firstPart = cityName.split(',')[0].trim();
      json = await fetchLocationIQ({ q: firstPart, limit: '1' });
    }

    if (!Array.isArray(json) || json.length === 0) return null;

    const first = json[0];
    return {
      location: { lat: parseFloat(first.lat), lng: parseFloat(first.lon) },
      placeId: String(first.place_id),
      name: first.display_name,
    };
  } catch (err) {
    console.error('[resolvePlaceCoordinates] Nominatim geocode failed:', err);
    return null;
  }
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  try {
    let json = await fetchLocationIQ({ q: trimmedQuery, limit: '10' });

    // Fallback: if user typed something highly specific that yields 0 results, 
    // try the first word/token to at least give some results
    if (!Array.isArray(json) || json.length === 0) {
       const firstWord = trimmedQuery.split(/[\s,]+/)[0];
       if (firstWord && firstWord !== trimmedQuery) {
         json = await fetchLocationIQ({ q: firstWord, limit: '10' });
       }
    }

    if (!Array.isArray(json)) return [];

    return json.map((result: any) => ({
      name: result.name || result.display_name.split(',')[0],
      rating: 4.5, // Nominatim doesn't have ratings, mock it
      address: result.display_name,
      photoUrl: FALLBACK_PHOTO_URL, // Nominatim doesn't have photos, use fallback
      placeId: String(result.place_id),
    }));
  } catch (err) {
    console.error('[searchPlaces] error:', err);
    return [];
  }
}
