import type { WeatherCoords, WeatherData, SolarData } from './types';
import { ok, err, type Result } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a Date object to "HH:MM" in the local timezone of the browser. */
function toHHMM(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Add minutes to a Date and return a new Date.
 * Used for golden-hour window calculation (±30 min around sunrise/sunset).
 */
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

const WEATHER_API_KEY = 'd638ebead38a4bb89a5233308263007';
const weatherApiCache = new Map<string, Promise<any>>();

export async function fetchWeatherData(
  coords: WeatherCoords
): Promise<Result<WeatherData>> {
  try {
    const cacheKey = `${coords.lat.toFixed(3)}|${coords.lon.toFixed(3)}`;
    
    if (!weatherApiCache.has(cacheKey)) {
      const fetchPromise = (async () => {
        const url = new URL('https://api.weatherapi.com/v1/forecast.json');
        url.searchParams.set('key', WEATHER_API_KEY);
        url.searchParams.set('q', `${coords.lat},${coords.lon}`);
        url.searchParams.set('days', '14');

        const res = await fetch(url.toString());
        if (!res.ok) {
          throw new Error(`Weather API error: HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!json?.forecast?.forecastday || json.forecast.forecastday.length === 0) {
          throw new Error('No forecast data returned for this location.');
        }
        return json;
      })();
      weatherApiCache.set(cacheKey, fetchPromise);
    }

    // Wait for the shared promise to resolve
    const json = await weatherApiCache.get(cacheKey);

    const targetDate = coords.date; 
    let dayData = json.forecast.forecastday.find((d: any) => d.date === targetDate);
    
    if (!dayData) {
      // If the target date is outside the forecast window (e.g., \u003e 14 days in the future),
      // we can't get an exact forecast. Fallback to returning the last available day's data
      // or the first day's data as a rough placeholder, rather than failing completely.
      dayData = json.forecast.forecastday[json.forecast.forecastday.length - 1];
      if (!dayData) {
        return err(`No weather data available for ${targetDate}`);
      }
    }

    const day = dayData.day;
    const locationName = json.location?.name || 'Destination';

    return ok({
      temperature:              Math.round(day.avgtemp_c),
      feelsLike:                Math.round(day.avgtemp_c),
      description:              day.condition.text,
      icon:                     day.condition.icon.replace('//', 'https://'),
      humidity:                 Math.round(day.avghumidity),
      windSpeed:                Math.round((day.maxwind_kph * 1000) / 3600), // convert km/h to m/s
      precipitationProbability: day.daily_chance_of_rain,
      fetchedAt:                Date.now(),
      location:                 locationName,
    });
  } catch (e: any) {
    console.error('[fetchWeatherData]', e);
    return err('Failed to fetch weather data. Check your network connection or API quota.');
  }
}

// ─── Solar data (sunrise-sunset.org — no API key required) ────────────────────

export async function fetchSolarData(
  coords: WeatherCoords
): Promise<Result<SolarData>> {
  try {
    const url = new URL('https://api.sunrise-sunset.org/json');
    url.searchParams.set('lat', String(coords.lat));
    url.searchParams.set('lng', String(coords.lon));
    url.searchParams.set('date', coords.date);
    url.searchParams.set('formatted', '0'); // ISO 8601 UTC responses

    const res = await fetch(url.toString());

    if (!res.ok) {
      return err(`Solar API error: HTTP ${res.status}`);
    }

    const json = await res.json() as {
      status: string;
      results: {
        sunrise: string;
        sunset: string;
      };
    };

    if (json.status !== 'OK') {
      return err('Solar API returned an error. Verify the coordinates are valid.');
    }

    const sunrise = new Date(json.results.sunrise);
    const sunset  = new Date(json.results.sunset);

    // Golden hour: ±30 minutes around sunrise and sunset
    const ghMorningStart = addMinutes(sunrise, -10);
    const ghMorningEnd   = addMinutes(sunrise, 40);
    const ghEveningStart = addMinutes(sunset,  -40);
    const ghEveningEnd   = addMinutes(sunset,   10);

    return ok({
      sunrise:                toHHMM(sunrise),
      sunriseIso:             sunrise.toISOString(),
      sunset:                 toHHMM(sunset),
      sunsetIso:              sunset.toISOString(),
      goldenHourMorningStart: toHHMM(ghMorningStart),
      goldenHourMorningEnd:   toHHMM(ghMorningEnd),
      goldenHourEveningStart: toHHMM(ghEveningStart),
      goldenHourEveningEnd:   toHHMM(ghEveningEnd),
      date:                   coords.date,
    });
  } catch (e: any) {
    console.error('[fetchSolarData]', e);
    return err('Failed to fetch solar data. Check your network connection.');
  }
}

// ─── Combined fetch ────────────────────────────────────────────────────────────
// Fires both requests in parallel for efficiency.

export async function fetchEnvironmentalData(coords: WeatherCoords): Promise<{
  weather: Result<WeatherData>;
  solar:   Result<SolarData>;
}> {
  const [weather, solar] = await Promise.all([
    fetchWeatherData(coords),
    fetchSolarData(coords),
  ]);
  return { weather, solar };
}
