import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { MapMarker } from '@/components/MapView';
import { DiscoveryList } from '@/features/discovery/components/DiscoveryList';
import { AddToBucketModal } from '@/features/discovery/components/AddToBucketModal';
import type { Place } from '@/features/discovery/types';
import { getPlaceColor, getPlaceLabel } from '@/features/discovery/utils/placeColor';
import { addToBucket } from '@/features/discovery/services/bucketService';
import { searchPlaces } from '@/features/discovery/services/placesApi';
import { useAuth } from '@/features/auth/AuthProvider';
import { err, ok, type BucketListUserData } from '@/types';
import { useTripStore } from './useTripStore';
import { useTripMap } from './TripMapContext';
import { useTripGeo } from './TripGeoContext';

const SEARCH_DEBOUNCE_MS = 1200;

function PlaceInfoCard({
  place,
  tripId,
  tripStartDate,
  tripEndDate,
}: {
  place: Place;
  tripId: string;
  tripStartDate?: string;
  tripEndDate?: string;
}) {
  const { user } = useAuth();
  const [added,  setAdded]  = useState(false);
  const [adding, setAdding] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const color = getPlaceColor(place.types ?? []);
  const label = getPlaceLabel(place.types ?? []);

  const addedBy = user
    ? {
        userId: user.uid,
        displayName: user.displayName ?? user.email ?? 'Traveler',
        photoURL: user.photoURL ?? null,
      }
    : null;

  async function handleAddFromModal(userData: BucketListUserData) {
    if (added || adding) {
      return err('Item already added.');
    }
    if (!addedBy) {
      const message = 'Please sign in to add places.';
      setError(message);
      return err(message);
    }

    setAdding(true);
    setError(null);
    const result = await addToBucket(tripId, place, addedBy, userData);
    setAdding(false);

    if (result.ok || result.error?.includes('already')) {
      setAdded(true);
      return ok(undefined);
    }

    setError(result.error);
    return result;
  }

  function handleOpenModal() {
    if (added || adding) return;
    if (!user) {
      setError('Please sign in to add places.');
      return;
    }
    setError(null);
    setIsModalOpen(true);
  }

  return (
    <div
      className="wb-card"
      style={{ maxWidth: 260, padding: 10, background: '#fff' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color }}>{label}</span>
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--wb-ink)', lineHeight: 1.3, margin: '0 0 2px' }}>{place.name}</p>
      <p style={{ fontSize: 11, color: 'var(--wb-ink-soft)', margin: '0 0 8px' }}>
        <span style={{ color: 'var(--wb-sun)' }}>★</span> {place.rating.toFixed(1)}
      </p>
      {error && <p style={{ fontSize: 11, color: 'var(--wb-sunset)', marginBottom: 6 }}>{error}</p>}
      <button
        onClick={handleOpenModal}
        disabled={added || adding || !user}
        className={`wb-btn wb-btn-sm ${added ? 'wb-btn-ghost' : 'wb-btn-primary'}`}
        style={{
          width: '100%',
          justifyContent: 'center',
          border: added ? '1px solid var(--wb-moss)' : undefined,
          background: added ? 'var(--wb-moss)' : undefined,
          color: added ? '#fff' : undefined,
          cursor: added || adding ? 'default' : 'pointer',
          opacity: adding ? 0.7 : 1,
        }}
      >
        {added ? '✓ Added' : adding ? 'Adding…' : '+ Add to bucket list'}
      </button>
      <AddToBucketModal
        isOpen={isModalOpen}
        place={place}
        minDate={tripStartDate}
        maxDate={tripEndDate}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddFromModal}
      />
    </div>
  );
}

export function TripDiscoveryPage() {
  const { activeTrip } = useTripStore((s) => ({
    activeTrip: s.activeTrip,
  }));
  const { geo }        = useTripGeo();
  const {
    mapRef, idleTick,
    setMapMarkers, setSelectedMarkerId, setHoveredMarkerId, setRenderInfoWindow,
    selectedMarkerId, hoveredMarkerId,
  } = useTripMap();

  const [places,      setPlaces]      = useState<Place[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const debounceTimerRef     = useRef<number | null>(null);
  const requestIdRef         = useRef(0);

  const normalizedQuery = useMemo(() => searchQuery.trim(), [searchQuery]);

  useEffect(() => {
    if (!selectedMarkerId) return;
    document.getElementById(`place-card-${selectedMarkerId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedMarkerId]);

  const executeNearbySearch = useCallback(async () => {
    if (!activeTrip) return;
    const query = normalizedQuery || `attractions in ${activeTrip.selectedDestinationCity || activeTrip.destination}`;

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setSearchError(null);

    const results = await searchPlaces(query);

    if (requestId !== requestIdRef.current) return;
    setHasSearched(true);
    setPlaces(results);
    setLoading(false);
  }, [normalizedQuery, activeTrip]);

  useEffect(() => {
    if (geo.status !== 'ready' || !mapRef.current) return;

    if (debounceTimerRef.current !== null) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(executeNearbySearch, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== null) window.clearTimeout(debounceTimerRef.current);
    };
  }, [geo.status, idleTick, normalizedQuery, executeNearbySearch, mapRef]);

  useEffect(() => {
    if (geo.status !== 'ready' || hasSearched || !mapRef.current) return;
    executeNearbySearch();
  }, [geo.status, hasSearched, executeNearbySearch, mapRef]);

  useEffect(() => () => {
    if (debounceTimerRef.current !== null) window.clearTimeout(debounceTimerRef.current);
  }, []);

  useEffect(() => {
    if (!activeTrip) return;
    const markers: MapMarker[] = places
      .filter((p) => p.location)
      .map((p) => ({
        id:       p.placeId,
        position: p.location!,
        title:    p.name,
        color:    getPlaceColor(p.types ?? []),
      }));
    setMapMarkers(markers);

    setRenderInfoWindow((id: string) => {
      const place = places.find((p) => p.placeId === id);
      return place ? (
        <PlaceInfoCard
          place={place}
          tripId={activeTrip.id}
          tripStartDate={activeTrip.startDate}
          tripEndDate={activeTrip.endDate}
        />
      ) : null;
    });

    return () => {
      setMapMarkers([]);
      setRenderInfoWindow(null);
    };
  }, [places, activeTrip, setMapMarkers, setRenderInfoWindow]);

  useEffect(() => () => {
    setSelectedMarkerId(null);
    setHoveredMarkerId(null);
  }, [setSelectedMarkerId, setHoveredMarkerId]);

  function handleCardClick(placeId: string) {
    setSelectedMarkerId(placeId);
    const loc = places.find((p) => p.placeId === placeId)?.location;
    if (loc && mapRef.current) {
      mapRef.current.setView(loc, 14, { animate: true });
    }
  }

  if (!activeTrip) return null;

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--wb-paper)' }}>

      <div
        className="px-6 pt-5 pb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--wb-line)' }}
      >
        <p className="text-[11px] font-bold tracking-[0.2em] uppercase mb-0.5" style={{ color: 'var(--wb-ocean)' }}>Discovery</p>
        <h2 className="font-fraunces text-[22px] font-bold leading-tight tracking-tight" style={{ color: 'var(--wb-ink)' }}>
          Nearby places
        </h2>
      </div>

      <div className="px-6 pb-3 pt-3 flex-shrink-0">
        <div
          className="flex items-center gap-2 rounded-[10px] px-3 py-2.5"
          style={{ border: '1.5px solid var(--wb-line)', background: '#fff', boxShadow: 'var(--wb-shadow-sm)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--wb-ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <path d="M3 6h18M7 12h10M11 18h2"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="cafes, viewpoints, museums…"
            className="w-full border-0 bg-transparent text-sm outline-none"
            style={{ color: 'var(--wb-ink)' }}
          />
        </div>
        {searchError && (
          <div
            className="mt-2 rounded-[10px] px-3 py-2 text-xs"
            style={{ border: '1.5px solid var(--wb-sunset)', background: '#FEF2EE', color: 'var(--wb-sunset)' }}
          >
            {searchError}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {geo.status === 'loading' || geo.status === 'idle' ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: 'var(--wb-ink-soft)' }}>Finding destination…</p>
          </div>
        ) : geo.status === 'error' ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: 'var(--wb-ink-soft)' }}>Location unavailable.</p>
          </div>
        ) : (
          <DiscoveryList
            tripId={activeTrip.id}
            places={places}
            isLoading={loading}
            hasSearched={hasSearched}
            tripStartDate={activeTrip.startDate}
            tripEndDate={activeTrip.endDate}
            selectedPlaceId={selectedMarkerId}
            hoveredPlaceId={hoveredMarkerId}
            onHoverChange={setHoveredMarkerId}
            onCardClick={handleCardClick}
          />
        )}
      </div>
    </div>
  );
}
