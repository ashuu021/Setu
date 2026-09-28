// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import MissionGlobe, { GLOBE_HOME } from './Globe';
import { simulate } from './simulation';
// @ts-ignore Node built-ins are available in Vitest's jsdom runtime.
import { readFileSync } from 'node:fs';

vi.mock('react-globe.gl', async () => {
  const ReactModule = await import('react');
  const MockGlobe = ReactModule.forwardRef((props: any, _ref) => ReactModule.createElement('div', {
    'data-testid': 'mock-globe',
    'data-width': props.width,
    'data-height': props.height,
    'data-image-url': props.globeImageUrl,
    'data-paths': JSON.stringify(props.pathsData),
    'data-path-stroke': props.pathStroke,
    'data-path-resolution': props.pathResolution,
    'data-has-elevated-arcs': String(Boolean(props.arcsData?.length)),
    'data-station-point-radius': props.pointRadius({ name: 'MAITRI' }),
    'data-points': JSON.stringify(props.pointsData.map((point: any) => ({ name: point.name, lat: point.lat, lng: point.lng }))),
    'data-label-altitude': props.htmlAltitude,
    'data-labels': JSON.stringify(props.htmlElementsData.filter((point: any) => point.markerType === 'label').map((point: any) => ({ name: point.name, lat: point.lat, lng: point.lng }))),
    'data-auto-rotate': 'disabled-by-default',
  }));
  return { default: MockGlobe };
});

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.instances.push(this);
  }

  observe(target: Element) {
    this.callback([{ target, contentRect: { width: 640, height: 260 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }

  disconnect() {}

  resize(width: number, height: number) {
    const target = document.querySelector('.globe-wrap')!;
    this.callback([{ target, contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

beforeEach(() => {
  ResizeObserverMock.instances = [];
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const forecast = simulate(0);
// @ts-ignore process.cwd is provided by the Vitest Node runner.
const stylesheet = readFileSync(`${process.cwd()}/src/style.css`, 'utf8');

describe('Mission Control globe', () => {
  it('renders the existing route and geographic markers on a locally loaded, interactive globe', () => {
    render(<MissionGlobe forecast={forecast} delay={7} />);
    const globe = screen.getByTestId('mock-globe');
    const paths = JSON.parse(globe.getAttribute('data-paths')!);
    const points = JSON.parse(globe.getAttribute('data-points')!);
    const labels = JSON.parse(globe.getAttribute('data-labels')!);

    expect(globe.getAttribute('data-image-url')).toBe('/earth-night.jpg');
    expect(paths).toEqual([[
      [19.076, 72.8777], [-25, 62], [-48, 48], [-68, 35],
    ]]);
    expect(Number(globe.getAttribute('data-path-stroke'))).toBeGreaterThan(0);
    expect(globe.getAttribute('data-path-resolution')).toBe('1');
    expect(globe.getAttribute('data-has-elevated-arcs')).toBe('false');
    expect(Number(globe.getAttribute('data-station-point-radius'))).toBe(1.05);
    expect(globe.getAttribute('data-label-altitude')).toBe('altitude');
    expect(points).toEqual(expect.arrayContaining([
      { name: 'MUMBAI', lat: 19.076, lng: 72.8777 },
      { name: 'MAITRI', lat: -70.7644, lng: 11.7342 },
      { name: 'BHARATI', lat: -69.40683, lng: 76.19533 },
    ]));
    expect(labels).toEqual(points);
    expect(globe.getAttribute('data-width')).toBe('640');
    expect(globe.getAttribute('data-height')).toBe('260');
    expect(GLOBE_HOME).toEqual({ lat: -66, lng: 45, altitude: 1.75 });
    expect(document.querySelectorAll('.map-tag')).toHaveLength(0);
  });

  it('resizes the globe to the Route Overview card instead of keeping a fixed-height canvas', () => {
    render(<MissionGlobe forecast={forecast} delay={0} />);
    const observer = ResizeObserverMock.instances[0];
    act(() => observer.resize(480, 212));

    const globe = screen.getByTestId('mock-globe');
    expect(globe.getAttribute('data-width')).toBe('480');
    expect(globe.getAttribute('data-height')).toBe('212');
    expect(stylesheet).toContain('.globe-wrap canvas{display:block;max-width:100%;max-height:100%}');
    expect(stylesheet).toContain('.globe-wrap{display:flex;align-items:center;justify-content:center');
    expect(stylesheet).toContain('.globe-location-label.maitri{margin-left:-60px');
  });

  it('keeps font and map texture assets local for offline startup', () => {
    render(<MissionGlobe forecast={forecast} delay={0} />);
    expect(screen.getByTestId('mock-globe').getAttribute('data-image-url')).toMatch(/^\//);
    expect(stylesheet).not.toContain('fonts.googleapis.com');
    expect(stylesheet).not.toContain('fonts.gstatic.com');
  });
});
