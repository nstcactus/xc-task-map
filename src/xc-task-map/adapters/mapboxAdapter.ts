import { MapboxMap as VueMapboxMap } from '@studiometa/vue-mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';
import type { XcTaskMapAdapter } from './types';

export const mapboxAdapter: XcTaskMapAdapter = {
  component: VueMapboxMap,
  getCanvasProps: ({ accessToken, mapAdapterProps }) => ({
    accessToken,
    mapStyle: 'mapbox://styles/mapbox/outdoors-v9',
    cooperativeGestures: true,
    center: [6.705, 45.934],
    zoom: 13,
    ...(mapAdapterProps || {}),
  }),
  getMapInstance: (componentRef) => {
    const mapRef = componentRef as { map?: unknown } | null;
    return mapRef?.map ?? null;
  },
  onStyleLoad: (mapInstance, callback) => {
    const map = mapInstance as {
      on: (eventName: string, listener: () => void) => void;
      off: (eventName: string, listener: () => void) => void;
    };

    map.on('style.load', callback);
    return () => map.off('style.load', callback);
  },
  isStyleLoaded: (mapInstance) => {
    const map = mapInstance as { isStyleLoaded?: () => boolean };
    return Boolean(map?.isStyleLoaded?.());
  },
  createBounds: () => new mapboxgl.LngLatBounds(),
  fitBounds: (mapInstance, bounds, options) => {
    const map = mapInstance as { fitBounds: (boundsArg: unknown, optionsArg: Record<string, unknown>) => void };
    map.fitBounds(bounds as unknown, options);
  },
  getSource: (mapInstance, sourceId) => {
    const map = mapInstance as { getSource: (id: string) => unknown };
    return map.getSource(sourceId);
  },
  addSource: (mapInstance, sourceId, source) => {
    const map = mapInstance as { addSource: (id: string, sourceArg: Record<string, unknown>) => void };
    map.addSource(sourceId, source);
  },
  setSourceData: (source, data) => {
    const mapSource = source as { setData?: (value: Record<string, unknown>) => void };
    mapSource.setData?.(data);
  },
  getLayer: (mapInstance, layerId) => {
    const map = mapInstance as { getLayer: (id: string) => unknown };
    return map.getLayer(layerId);
  },
  addLayer: (mapInstance, layerConfig) => {
    const map = mapInstance as { addLayer: (value: Record<string, unknown>) => void };
    map.addLayer(layerConfig);
  },
  setLayoutProperty: (mapInstance, layerId, property, value) => {
    const map = mapInstance as {
      setLayoutProperty: (id: string, propertyName: string, propertyValue: unknown) => void;
    };
    map.setLayoutProperty(layerId, property, value);
  },
  setPaintProperty: (mapInstance, layerId, property, value) => {
    const map = mapInstance as {
      setPaintProperty: (id: string, propertyName: string, propertyValue: unknown) => void;
    };
    map.setPaintProperty(layerId, property, value);
  },
};
