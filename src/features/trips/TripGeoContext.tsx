// ─── TripGeoContext.tsx ──────────────────────────────────────────────────────
// Separated from TripWorkspacePage so Vite Fast Refresh can work correctly.
// A file must only export components OR hooks/context — not both.

import { createContext, useContext } from 'react';
import type { Coordinates } from '@/features/weather/geocodingService';

export type GeoState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; coords: Coordinates };

interface TripGeoContextValue { geo: GeoState }

export const TripGeoContext = createContext<TripGeoContextValue>({ geo: { status: 'idle' } });

export function useTripGeo(): TripGeoContextValue {
  return useContext(TripGeoContext);
}
