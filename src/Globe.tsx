import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import type { Forecast } from './simulation';

type GeoPoint = { lat: number; lng: number };

const stations = [
  { name: 'MAITRI', lat: -70.7644, lng: 11.7342 },
  { name: 'BHARATI', lat: -69.40683, lng: 76.19533 },
];
const origin = { name: 'MUMBAI', lat: 19.076, lng: 72.8777 };
const route: GeoPoint[] = [origin, { lat: -25, lng: 62 }, { lat: -48, lng: 48 }, { lat: -68, lng: 35 }];
const globeImageUrl = '/earth-night.jpg';
const initialSize = { width: 800, height: 280 };
export const GLOBE_HOME = { lat: -66, lng: 45, altitude: 1.75 };

function getShipPosition(delay: number): GeoPoint {
  const progress = Math.max(0.08, Math.min(0.9, 0.77 - delay / 38));
  const scaledIndex = progress * (route.length - 1);
  const index = Math.floor(scaledIndex);
  const fraction = scaledIndex - index;
  const from = route[index];
  const to = route[Math.min(index + 1, route.length - 1)];
  return {
    lat: from.lat + (to.lat - from.lat) * fraction,
    lng: from.lng + (to.lng - from.lng) * fraction,
  };
}

export default function MissionGlobe({ forecast, delay }: { forecast: Forecast; delay: number }) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(initialSize);
  const [failed, setFailed] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = (width = container.clientWidth, height = container.clientHeight) => {
      if (width <= 0 || height <= 0) return;
      setSize(current => current.width === width && current.height === height ? current : { width, height });
    };

    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(entries => {
        const bounds = entries[0]?.contentRect;
        if (bounds) measure(Math.round(bounds.width), Math.round(bounds.height));
      });
      observer.observe(container);
      return () => observer.disconnect();
    }

    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (globe) {
      globe.pointOfView(GLOBE_HOME, 0);
      globe.controls().autoRotate = false;
    }

    const timer = window.setTimeout(() => {
      if (!containerRef.current?.querySelector('canvas')) setFailed(true);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, []);

  const dots = stations.map(station => ({
    ...station,
    color: station.name === 'MAITRI'
      ? forecast.risk === 'CRITICAL' ? '#fb7185' : forecast.risk === 'ELEVATED' ? '#fbbf24' : '#6ce7a2'
      : '#6ce7a2',
  })).concat({ ...origin, color: '#56d9e8' });

  const ship = getShipPosition(delay);
  const labels = [
    ...stations.map(station => ({
      ...station,
      markerType: 'label' as const,
      detail: station.name === 'MAITRI' ? forecast.risk : 'REFERENCE',
      altitude: 0.035,
    })),
    { ...origin, markerType: 'label' as const, detail: 'ORIGIN', altitude: 0.02 },
  ];
  const htmlMarkers = [
    { ...ship, name: 'RESUPPLY VESSEL', markerType: 'vessel' as const, altitude: 0.045 },
    ...labels,
  ];

  return (
    <div className="globe-wrap" ref={containerRef} data-testid="globe-wrap">
      {!failed ? (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          globeImageUrl={globeImageUrl}
          backgroundColor="rgba(0,0,0,0)"
          showAtmosphere
          atmosphereColor="#51b9d7"
          atmosphereAltitude={0.12}
          pointsData={dots}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointAltitude={(point: any) => point.name === 'MUMBAI' ? 0.008 : 0.025}
          pointRadius={(point: any) => point.name === 'MUMBAI' ? 0.65 : 1.05}
          pointLabel={(point: any) => point.name === 'MAITRI'
            ? `Maitri · ${forecast.runway.toFixed(0)} synthetic fuel days · ${forecast.risk}`
            : point.name === 'BHARATI'
              ? 'Bharati · reference station; fuel inventory not modeled in this demo'
              : 'Mumbai · simulated route origin'}
          pathsData={[route.map(({ lat, lng }) => [lat, lng])]}
          pathColor={() => '#52d9ed'}
          pathStroke={0.12}
          pathResolution={1}
          pathDashLength={0.6}
          pathDashGap={0.3}
          pathDashAnimateTime={2800}
          htmlElementsData={htmlMarkers}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude="altitude"
          htmlElement={(marker: any) => {
            const element = document.createElement('div');
            if (marker.markerType === 'vessel') {
              element.className = 'globe-vessel-marker';
              element.setAttribute('aria-label', 'Resupply vessel');
              element.textContent = '✦';
              return element;
            }
            element.className = `globe-location-label ${marker.name.toLowerCase()}`;
            element.setAttribute('aria-label', `${marker.name} ${marker.detail}`);
            const name = document.createElement('strong');
            name.textContent = marker.name;
            const detail = document.createElement('small');
            detail.textContent = marker.detail;
            element.append(name, detail);
            return element;
          }}
        />
      ) : (
        <div className="globe-fallback">
          <div className="fallback-earth"><span>ANTARCTICA</span><i>✦</i></div>
          <p>Interactive globe texture unavailable. Simulation controls and forecasts remain active.</p>
        </div>
      )}
      <div className="globe-vignette" />
      <div className="globe-coordinates">70°46′S · 11°44′E &nbsp; / &nbsp; SOUTHERN OCEAN</div>
    </div>
  );
}
