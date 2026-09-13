import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapMarker {
  id:           string;
  position:     { lat: number; lng: number };
  title?:       string;
  color?:       string;
  highlighted?: boolean;
}

export interface MapViewProps {
  center?:           { lat: number; lng: number };
  zoom?:             number;
  recenterTrigger?:  number;
  markers?:          MapMarker[];
  selectedMarkerId?: string;
  onMarkerClick?:    (markerId: string) => void;
  onInfoWindowClose?: () => void;
  renderInfoWindow?: (markerId: string) => ReactNode;
  onLoad?:           (map: any) => void;
  onUnmount?:        () => void;
  style?:            CSSProperties;
  className?:        string;
}

function createPinIcon(color: string, highlighted: boolean): L.DivIcon {
  const w = highlighted ? 34 : 26;
  const h = highlighted ? 44 : 34;
  const cx = w / 2;
  const cy = highlighted ? 16 : 12;
  const r = highlighted ? 6.5 : 5;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <path d="M${cx} 1C${Math.round(cx * 0.4)} 1 1 ${Math.round(cx * 0.85)} 1 ${cx + 1}c0 ${Math.round(cx * 1.05)} ${cx - 1} ${Math.round(h * 0.65)} ${cx - 1} ${Math.round(h * 0.65)}s${cx - 1}-${Math.round(h * 0.35)} ${cx - 1}-${Math.round(h * 0.65)}C${w - 1} ${Math.round(cx * 0.85)} ${Math.round(cx * 1.6)} 1 ${cx} 1z" fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="white" opacity="0.92"/>
  </svg>`;
  
  return new L.DivIcon({
    html: svg,
    className: 'custom-leaflet-marker bg-transparent border-0',
    iconSize: [w, h],
    iconAnchor: [cx, h],
    popupAnchor: [0, -h],
  });
}

function MapController({ center, zoom, recenterTrigger, onLoad, onUnmount }: any) {
  const map = useMap();
  
  useEffect(() => {
    if (onLoad) onLoad(map);
    return () => {
      if (onUnmount) onUnmount();
    };
  }, [map, onLoad, onUnmount]);

  useEffect(() => {
    if (center) {
      map.setView(center, zoom, { animate: true });
    }
  }, [recenterTrigger, center]);

  return null;
}

export function MapView({
  center,
  zoom = 12,
  recenterTrigger,
  markers = [],
  selectedMarkerId,
  onMarkerClick,
  onInfoWindowClose,
  renderInfoWindow,
  onLoad,
  onUnmount,
  style,
  className,
}: MapViewProps) {

  // Default to a world-center view if no specific destination is known yet.
  const DEFAULT_CENTER = { lat: 20, lng: 0 };
  const DEFAULT_ZOOM = 2;

  const effectiveCenter = center ?? DEFAULT_CENTER;
  const effectiveZoom = center ? zoom : DEFAULT_ZOOM;

  const selectedMarker = selectedMarkerId ? markers.find((m) => m.id === selectedMarkerId) : null;

  return (
    <MapContainer
      center={effectiveCenter}
      zoom={effectiveZoom}
      style={{ width: '100%', height: '100%', ...style }}
      className={className}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController
        center={effectiveCenter}
        zoom={effectiveZoom}
        recenterTrigger={recenterTrigger}
        onLoad={onLoad}
        onUnmount={onUnmount}
      />
      
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={m.position}
          title={m.title}
          icon={createPinIcon(m.color ?? '#F5A524', m.highlighted ?? false)}
          zIndexOffset={m.highlighted ? 1000 : 0}
          eventHandlers={{
            click: () => onMarkerClick && onMarkerClick(m.id),
          }}
        >
          {selectedMarker?.id === m.id && renderInfoWindow && (
            <Popup
              autoClose={false}
              closeOnClick={false}
              eventHandlers={{ remove: () => onInfoWindowClose && onInfoWindowClose() }}
            >
              <div style={{ margin: '-10px -15px' }}>{renderInfoWindow(m.id)}</div>
            </Popup>
          )}
        </Marker>
      ))}
    </MapContainer>
  );
}



